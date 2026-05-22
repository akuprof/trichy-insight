import { Router } from "express";
import crypto from "node:crypto";

const router = Router();

interface FBConfig {
  pageId: string;
  accessToken: string;
  enabled: boolean;
}

interface IGConfig {
  igUserId: string;
  accessToken: string;
  enabled: boolean;
}

interface WAConfig {
  provider: "greenapi" | "wati" | "meta";
  instanceId?: string;
  apiToken?: string;
  groupId?: string;
  phoneId?: string;
  wabaToken?: string;
  apiUrl?: string;
  enabled: boolean;
}

interface TwitterConfig {
  enabled: boolean;
  bearerToken: string;
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessTokenSecret: string;
}

interface BlueskyConfig {
  enabled: boolean;
  handle: string;
  appPassword: string;
}

interface PublishPayload {
  article: {
    id: string;
    title: string;
    slug: string;
    category: string;
    excerpt: string | null;
    cover_image_url: string | null;
    video_url: string | null;
    published_at: string | null;
  };
  siteUrl: string;
  facebook?: FBConfig;
  instagram?: IGConfig;
  whatsapp?: WAConfig;
  twitter?: TwitterConfig;
  bluesky?: BlueskyConfig;
}

interface ChannelResult {
  success: boolean;
  error?: string;
  postId?: string;
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + "…";
}

async function postToFacebook(cfg: FBConfig, articleUrl: string, title: string, excerpt: string | null, imageUrl?: string | null): Promise<ChannelResult> {
  const safeExcerpt = excerpt ? truncate(excerpt, 300) : null;
  const caption = truncate([
    `📰 ${title}`,
    safeExcerpt ? `\n${safeExcerpt}` : "",
    `\n🔗 ${articleUrl}`,
    `\n\n— Trichy Insight`,
  ].filter(Boolean).join(""), 2000);

  if (imageUrl) {
    // Post with image via /photos endpoint
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${cfg.pageId}/photos`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: imageUrl,
          caption,
          access_token: cfg.accessToken,
        }),
      }
    );
    const json = await res.json() as { id?: string; post_id?: string; error?: { message: string } };
    if (!res.ok || json.error) {
      return { success: false, error: json.error?.message || `HTTP ${res.status}` };
    }
    return { success: true, postId: json.post_id ?? json.id };
  }

  // Text + link fallback when no image
  const res = await fetch(
    `https://graph.facebook.com/v21.0/${cfg.pageId}/feed`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: caption,
        link: articleUrl,
        access_token: cfg.accessToken,
      }),
    }
  );
  const json = await res.json() as { id?: string; error?: { message: string } };
  if (!res.ok || json.error) {
    return { success: false, error: json.error?.message || `HTTP ${res.status}` };
  }
  return { success: true, postId: json.id };
}

async function postFacebookReel(cfg: FBConfig, videoUrl: string, title: string, excerpt: string | null): Promise<ChannelResult> {
  const safeExcerpt = excerpt ? truncate(excerpt, 300) : null;
  const description = truncate([
    `📰 ${title}`,
    safeExcerpt ? `\n${safeExcerpt}` : "",
    `\n\n— Trichy Insight`,
  ].filter(Boolean).join(""), 2000);

  // Phase 1: start upload session
  const startRes = await fetch(
    `https://graph.facebook.com/v21.0/${cfg.pageId}/video_reels`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        upload_phase: "start",
        access_token: cfg.accessToken,
      }),
    }
  );
  const startJson = await startRes.json() as { video_id?: string; error?: { message: string } };
  if (!startRes.ok || startJson.error || !startJson.video_id) {
    return { success: false, error: startJson.error?.message || `Reel start failed: HTTP ${startRes.status}` };
  }

  // Phase 2: finish with file_url (URL-based upload)
  const finishRes = await fetch(
    `https://graph.facebook.com/v21.0/${cfg.pageId}/video_reels`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        upload_phase: "finish",
        video_id: startJson.video_id,
        video_state: "PUBLISHED",
        file_url: videoUrl,
        description,
        access_token: cfg.accessToken,
      }),
    }
  );
  const finishJson = await finishRes.json() as { success?: boolean; error?: { message: string } };
  if (!finishRes.ok || finishJson.error) {
    return { success: false, error: finishJson.error?.message || `Reel finish failed: HTTP ${finishRes.status}` };
  }
  return { success: true, postId: startJson.video_id };
}

async function postToInstagram(cfg: IGConfig, imageUrl: string, title: string, excerpt: string | null, articleUrl: string): Promise<ChannelResult> {
  const safeExcerpt = excerpt ? truncate(excerpt, 300) : null;
  const caption = truncate([
    `📰 ${title}`,
    safeExcerpt ? `\n${safeExcerpt}` : "",
    `\n\n🔗 ${articleUrl}`,
    `\n\n#TrichyInsight #Trichy #TamilNews #திருச்சி`,
  ].filter(Boolean).join(""), 2000);

  // IGAA... tokens (Instagram Business Login) use graph.instagram.com
  // EAA...  tokens (Facebook Login)          use graph.facebook.com
  const base = cfg.accessToken.startsWith("IGAA")
    ? "https://graph.instagram.com/v22.0"
    : "https://graph.facebook.com/v21.0";

  const containerRes = await fetch(
    `${base}/${cfg.igUserId}/media`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image_url: imageUrl,
        caption,
        access_token: cfg.accessToken,
      }),
    }
  );

  const container = await containerRes.json() as { id?: string; error?: { message: string; code?: number } };
  if (!containerRes.ok || container.error || !container.id) {
    const msg = container.error?.message || `HTTP ${containerRes.status}`;
    console.error("Instagram container error:", container);
    return { success: false, error: `Container creation failed: ${msg}` };
  }

  // Poll for container to reach FINISHED status (required by Meta)
  const maxAttempts = 10;
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const statusRes = await fetch(
      `${base}/${container.id}?fields=status_code&access_token=${cfg.accessToken}`
    );
    const statusData = await statusRes.json() as { status_code?: string; error?: { message: string } };
    if (statusData.status_code === "FINISHED") break;
    if (statusData.status_code === "ERROR") {
      return { success: false, error: "Instagram media processing error — try a different image URL" };
    }
    if (i === maxAttempts - 1) {
      return { success: false, error: "Instagram media container timed out — try again" };
    }
  }

  const publishRes = await fetch(
    `${base}/${cfg.igUserId}/media_publish`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        creation_id: container.id,
        access_token: cfg.accessToken,
      }),
    }
  );

  const published = await publishRes.json() as { id?: string; error?: { message: string } };
  if (!publishRes.ok || published.error) {
    return { success: false, error: published.error?.message || `HTTP ${publishRes.status}` };
  }
  return { success: true, postId: published.id };
}

async function postInstagramReel(cfg: IGConfig, videoUrl: string, title: string, excerpt: string | null, articleUrl: string): Promise<ChannelResult> {
  const safeExcerpt = excerpt ? truncate(excerpt, 300) : null;
  const caption = truncate([
    `📰 ${title}`,
    safeExcerpt ? `\n${safeExcerpt}` : "",
    `\n\n🔗 ${articleUrl}`,
    `\n\n#TrichyInsight #Trichy #TamilNews #திருச்சி`,
  ].filter(Boolean).join(""), 2000);

  const base = cfg.accessToken.startsWith("IGAA")
    ? "https://graph.instagram.com/v22.0"
    : "https://graph.facebook.com/v21.0";

  // Step 1: Create Reels container with video_url
  const containerRes = await fetch(
    `${base}/${cfg.igUserId}/media`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        media_type: "REELS",
        video_url: videoUrl,
        caption,
        share_to_feed: true,
        access_token: cfg.accessToken,
      }),
    }
  );

  const container = await containerRes.json() as { id?: string; error?: { message: string; code?: number } };
  if (!containerRes.ok || container.error || !container.id) {
    return { success: false, error: `Reel container failed: ${container.error?.message || `HTTP ${containerRes.status}`}` };
  }

  // Step 2: Poll for FINISHED status (video processing can take longer than image)
  const maxAttempts = 20;
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const statusRes = await fetch(
      `${base}/${container.id}?fields=status_code&access_token=${cfg.accessToken}`
    );
    const statusData = await statusRes.json() as { status_code?: string; error?: { message: string } };
    if (statusData.status_code === "FINISHED") break;
    if (statusData.status_code === "ERROR") {
      return { success: false, error: "Instagram Reel processing failed — check video format (MP4, H.264, vertical preferred)" };
    }
    if (i === maxAttempts - 1) {
      return { success: false, error: "Instagram Reel processing timed out — video may be too long or unsupported format" };
    }
  }

  // Step 3: Publish the reel
  const publishRes = await fetch(
    `${base}/${cfg.igUserId}/media_publish`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        creation_id: container.id,
        access_token: cfg.accessToken,
      }),
    }
  );

  const published = await publishRes.json() as { id?: string; error?: { message: string } };
  if (!publishRes.ok || published.error) {
    return { success: false, error: published.error?.message || `Reel publish failed: HTTP ${publishRes.status}` };
  }
  return { success: true, postId: published.id };
}

async function postToWhatsAppGreenAPI(cfg: WAConfig, title: string, excerpt: string | null, articleUrl: string): Promise<ChannelResult> {
  if (!cfg.instanceId || !cfg.apiToken || !cfg.groupId) {
    return { success: false, error: "Green API: instanceId, apiToken, and groupId required" };
  }

  const message = [
    `📰 *${title}*`,
    excerpt ? `\n_${excerpt}_` : "",
    `\n🔗 ${articleUrl}`,
    `\n\n— *Trichy Insight*`,
  ].filter(Boolean).join("");

  const endpoint = `https://api.green-api.com/waInstance${cfg.instanceId}/sendMessage/${cfg.apiToken}`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chatId: cfg.groupId,
      message,
    }),
  });

  const json = await res.json() as { idMessage?: string; error?: string };
  if (!res.ok || json.error) {
    return { success: false, error: json.error || `HTTP ${res.status}` };
  }
  return { success: true, postId: json.idMessage };
}

async function postToWhatsAppWATI(cfg: WAConfig, title: string, excerpt: string | null, articleUrl: string): Promise<ChannelResult> {
  if (!cfg.apiUrl || !cfg.apiToken || !cfg.groupId) {
    return { success: false, error: "WATI: apiUrl, apiToken, and groupId required" };
  }

  const message = [
    `📰 *${title}*`,
    excerpt ? `_${excerpt}_` : "",
    `🔗 ${articleUrl}`,
    `— *Trichy Insight*`,
  ].filter(Boolean).join("\n");

  const endpoint = `${cfg.apiUrl.replace(/\/$/, "")}/api/v1/sendSessionMessage/${cfg.groupId}`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.apiToken}`,
    },
    body: JSON.stringify({ messageText: message }),
  });

  const json = await res.json() as { id?: string; error?: string };
  if (!res.ok) {
    return { success: false, error: json.error || `HTTP ${res.status}` };
  }
  return { success: true, postId: json.id };
}

async function postToWhatsAppMeta(cfg: WAConfig, title: string, excerpt: string | null, articleUrl: string): Promise<ChannelResult> {
  if (!cfg.phoneId || !cfg.wabaToken || !cfg.groupId) {
    return { success: false, error: "Meta WA: phoneId, wabaToken, and recipient phone required" };
  }

  const text = [
    `📰 *${title}*`,
    excerpt ? `_${excerpt}_` : "",
    `🔗 ${articleUrl}`,
    `— Trichy Insight`,
  ].filter(Boolean).join("\n");

  const res = await fetch(
    `https://graph.facebook.com/v19.0/${cfg.phoneId}/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.wabaToken}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: cfg.groupId,
        type: "text",
        text: { body: text, preview_url: true },
      }),
    }
  );

  const json = await res.json() as { messages?: { id: string }[]; error?: { message: string } };
  if (!res.ok || json.error) {
    return { success: false, error: json.error?.message || `HTTP ${res.status}` };
  }
  return { success: true, postId: json.messages?.[0]?.id };
}

// ── Twitter / X (OAuth 1.0a) ─────────────────────────────────────
function buildOAuthHeader(
  method: string,
  url: string,
  params: Record<string, string>,
  apiKey: string,
  apiSecret: string,
  accessToken: string,
  accessTokenSecret: string
): string {
  const nonce = crypto.randomBytes(16).toString("hex");
  const timestamp = Math.floor(Date.now() / 1000).toString();

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: apiKey,
    oauth_nonce: nonce,
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: timestamp,
    oauth_token: accessToken,
    oauth_version: "1.0",
  };

  const allParams = { ...params, ...oauthParams };
  const sorted = Object.keys(allParams)
    .sort()
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(allParams[k])}`)
    .join("&");

  const sigBase = [method.toUpperCase(), encodeURIComponent(url), encodeURIComponent(sorted)].join("&");
  const sigKey = `${encodeURIComponent(apiSecret)}&${encodeURIComponent(accessTokenSecret)}`;
  const signature = crypto.createHmac("sha1", sigKey).update(sigBase).digest("base64");

  const headerParts: Record<string, string> = {
    ...oauthParams,
    oauth_signature: signature,
  };

  const header = "OAuth " + Object.keys(headerParts)
    .sort()
    .map((k) => `${encodeURIComponent(k)}="${encodeURIComponent(headerParts[k])}"`)
    .join(", ");

  return header;
}

async function postToTwitter(cfg: TwitterConfig, title: string, excerpt: string | null, articleUrl: string): Promise<ChannelResult> {
  const maxLen = 270 - articleUrl.length - 2;
  const text = `${title.slice(0, maxLen)}\n${articleUrl}`;

  const url = "https://api.twitter.com/2/tweets";
  const body = JSON.stringify({ text });

  const authHeader = buildOAuthHeader(
    "POST",
    url,
    {},
    cfg.apiKey,
    cfg.apiSecret,
    cfg.accessToken,
    cfg.accessTokenSecret
  );

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader,
    },
    body,
  });

  const json = await res.json() as { data?: { id: string }; errors?: { message: string }[]; detail?: string };
  if (!res.ok || json.errors) {
    return { success: false, error: json.errors?.[0]?.message ?? json.detail ?? `HTTP ${res.status}` };
  }
  return { success: true, postId: json.data?.id };
}

// ── Bluesky (AT Protocol) ────────────────────────────────────────
async function postToBluesky(cfg: BlueskyConfig, title: string, excerpt: string | null, articleUrl: string): Promise<ChannelResult> {
  // 1. Create session
  const sessionRes = await fetch("https://bsky.social/xrpc/com.atproto.server.createSession", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: cfg.handle, password: cfg.appPassword }),
  });

  const session = await sessionRes.json() as { accessJwt?: string; did?: string; error?: string; message?: string };
  if (!sessionRes.ok || !session.accessJwt || !session.did) {
    return { success: false, error: session.message ?? session.error ?? `Auth failed: HTTP ${sessionRes.status}` };
  }

  // 2. Build post text (300 char limit on Bluesky)
  const snippet = excerpt ? ` — ${excerpt}` : "";
  const fullText = `${title}${snippet}\n${articleUrl}`.slice(0, 300);
  const linkStart = Buffer.byteLength(fullText.slice(0, fullText.lastIndexOf("\n") + 1), "utf8");
  const linkEnd = Buffer.byteLength(fullText, "utf8");

  const record = {
    $type: "app.bsky.feed.post",
    text: fullText,
    createdAt: new Date().toISOString(),
    facets: [
      {
        index: { byteStart: linkStart, byteEnd: linkEnd },
        features: [{ $type: "app.bsky.richtext.facet#link", uri: articleUrl }],
      },
    ],
  };

  // 3. Create record
  const postRes = await fetch("https://bsky.social/xrpc/com.atproto.repo.createRecord", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.accessJwt}`,
    },
    body: JSON.stringify({ repo: session.did, collection: "app.bsky.feed.post", record }),
  });

  const posted = await postRes.json() as { uri?: string; error?: string; message?: string };
  if (!postRes.ok || !posted.uri) {
    return { success: false, error: posted.message ?? posted.error ?? `HTTP ${postRes.status}` };
  }
  return { success: true, postId: posted.uri };
}

const ENV_IG_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN ?? "";
const ENV_IG_USER_ID = "17841447727738548";

router.post("/social/publish", async (req, res) => {
  const body = req.body as PublishPayload;
  if (!body?.article) {
    return res.status(400).json({ error: "article payload required" });
  }

  const { article, siteUrl, facebook, instagram, whatsapp } = body;
  const articleUrl = `${siteUrl.replace(/\/$/, "")}/news/${article.slug}`;

  const { twitter, bluesky } = body;

  // Log what channels are being requested
  console.log(`[social/publish] article="${article.title}" url="${articleUrl}"`);
  console.log(`[social/publish] channels received: fb=${!!facebook} ig=${!!instagram} wa=${!!whatsapp} tw=${!!twitter} bs=${!!bluesky}`);
  if (facebook) console.log(`[social/publish] FB: enabled=${facebook.enabled} pageId=${facebook.pageId ? "✓" : "✗"} token=${facebook.accessToken ? "✓" : "✗"}`);
  if (instagram) console.log(`[social/publish] IG: enabled=${instagram.enabled} userId=${instagram.igUserId ? "✓" : "✗"} token=${instagram.accessToken ? "✓" : "✗"}`);

  const results: Record<string, ChannelResult | null> = {
    facebook: null,
    instagram: null,
    whatsapp: null,
    twitter: null,
    bluesky: null,
  };

  const tasks: Promise<void>[] = [];

  const hasVideo = !!article.video_url;

  if (facebook?.enabled && facebook.pageId && facebook.accessToken) {
    if (hasVideo) {
      console.log(`[social/publish] FB: posting as Reel (video_url present)`);
      tasks.push(
        postFacebookReel(facebook, article.video_url!, article.title, article.excerpt)
          .then((r) => { results.facebook = r; })
          .catch((e) => { results.facebook = { success: false, error: String(e) }; })
      );
    } else {
      tasks.push(
        postToFacebook(facebook, articleUrl, article.title, article.excerpt, article.cover_image_url)
          .then((r) => { results.facebook = r; })
          .catch((e) => { results.facebook = { success: false, error: String(e) }; })
      );
    }
  }

  const igToken = instagram?.accessToken || ENV_IG_TOKEN;
  const igUserId = instagram?.igUserId || ENV_IG_USER_ID;
  const igEnabled = instagram?.enabled ?? (!!ENV_IG_TOKEN);

  if (igEnabled && igUserId && igToken) {
    const igCfg: IGConfig = { enabled: true, igUserId, accessToken: igToken };
    if (hasVideo) {
      console.log(`[social/publish] IG: posting as Reel (video_url present)`);
      tasks.push(
        postInstagramReel(igCfg, article.video_url!, article.title, article.excerpt, articleUrl)
          .then((r) => { results.instagram = r; })
          .catch((e) => { results.instagram = { success: false, error: String(e) }; })
      );
    } else if (article.cover_image_url) {
      tasks.push(
        postToInstagram(igCfg, article.cover_image_url, article.title, article.excerpt, articleUrl)
          .then((r) => { results.instagram = r; })
          .catch((e) => { results.instagram = { success: false, error: String(e) }; })
      );
    } else {
      results.instagram = { success: false, error: "Instagram requires a cover image or video URL" };
    }
  }

  if (whatsapp?.enabled) {
    const wa = whatsapp;
    let task: Promise<ChannelResult>;
    if (wa.provider === "greenapi") task = postToWhatsAppGreenAPI(wa, article.title, article.excerpt, articleUrl);
    else if (wa.provider === "wati") task = postToWhatsAppWATI(wa, article.title, article.excerpt, articleUrl);
    else task = postToWhatsAppMeta(wa, article.title, article.excerpt, articleUrl);
    tasks.push(
      task
        .then((r) => { results.whatsapp = r; })
        .catch((e) => { results.whatsapp = { success: false, error: String(e) }; })
    );
  }

  if (twitter?.enabled && twitter.apiKey && twitter.accessToken) {
    tasks.push(
      postToTwitter(twitter, article.title, article.excerpt, articleUrl)
        .then((r) => { results.twitter = r; })
        .catch((e) => { results.twitter = { success: false, error: String(e) }; })
    );
  }

  if (bluesky?.enabled && bluesky.handle && bluesky.appPassword) {
    tasks.push(
      postToBluesky(bluesky, article.title, article.excerpt, articleUrl)
        .then((r) => { results.bluesky = r; })
        .catch((e) => { results.bluesky = { success: false, error: String(e) }; })
    );
  }

  await Promise.allSettled(tasks);

  const anySuccess = Object.values(results).some((r) => r?.success);
  console.log(`[social/publish] results:`, JSON.stringify(
    Object.fromEntries(Object.entries(results).filter(([, v]) => v !== null))
  ));
  return res.json({ ok: true, anySuccess, results });
});

router.post("/social/test/:channel", async (req, res) => {
  const { channel } = req.params;
  const body = req.body as Partial<PublishPayload>;

  const testArticle = {
    id: "test-001",
    title: "TEST: Trichy Insight Auto-Post",
    slug: "test-auto-post",
    category: "Test",
    excerpt: "This is a test post from Trichy Insight CMS.",
    cover_image_url: null,
    published_at: new Date().toISOString(),
  };

  const siteUrl = body.siteUrl || "https://trichyinsight.online";
  const articleUrl = `${siteUrl}/news/test-auto-post`;
  let result: ChannelResult;

  try {
    if (channel === "facebook" && body.facebook) {
      const testImageUrl = "https://images.unsplash.com/photo-1582510003544-4d00b7f74220?w=1080&q=80";
      result = await postToFacebook(body.facebook, articleUrl, testArticle.title, testArticle.excerpt, testImageUrl);
    } else if (channel === "instagram" && body.instagram) {
      const igCfg = {
        ...body.instagram,
        accessToken: body.instagram.accessToken || process.env.INSTAGRAM_ACCESS_TOKEN || "",
        igUserId: body.instagram.igUserId || "17841447727738548",
      };
      const testImageUrl = "https://images.unsplash.com/photo-1582510003544-4d00b7f74220?w=1080&q=80";
      result = await postToInstagram(igCfg, testImageUrl, testArticle.title, testArticle.excerpt, articleUrl);
    } else if (channel === "whatsapp" && body.whatsapp) {
      const wa = body.whatsapp;
      if (wa.provider === "greenapi") result = await postToWhatsAppGreenAPI(wa, testArticle.title, testArticle.excerpt, articleUrl);
      else if (wa.provider === "wati") result = await postToWhatsAppWATI(wa, testArticle.title, testArticle.excerpt, articleUrl);
      else result = await postToWhatsAppMeta(wa, testArticle.title, testArticle.excerpt, articleUrl);
    } else if (channel === "twitter" && body.twitter) {
      result = await postToTwitter(body.twitter, testArticle.title, testArticle.excerpt, articleUrl);
    } else if (channel === "bluesky" && body.bluesky) {
      result = await postToBluesky(body.bluesky, testArticle.title, testArticle.excerpt, articleUrl);
    } else {
      result = { success: false, error: `Unknown channel: ${channel}` };
    }
  } catch (e) {
    result = { success: false, error: String(e) };
  }

  return res.json(result);
});

// ── Server config status (which env secrets are present) ─────────
// Returns only booleans — never exposes actual secret values
router.get("/channels/server-config", (_req, res) => {
  const igToken = process.env.INSTAGRAM_ACCESS_TOKEN || "";
  const igUserId = process.env.INSTAGRAM_USER_ID || "17841447727738548";

  return res.json({
    instagram: {
      hasToken: igToken.length > 0,
      igUserId,
      tokenPrefix: igToken.length > 6 ? igToken.slice(0, 6) + "…" : "(none)",
    },
    facebook: {
      hasToken: (process.env.FACEBOOK_ACCESS_TOKEN || "").length > 0,
    },
    whatsapp: {
      hasToken: (process.env.WHATSAPP_TOKEN || process.env.WA_API_TOKEN || "").length > 0,
    },
  });
});

export default router;
