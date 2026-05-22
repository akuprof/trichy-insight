import { Router } from "express";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { getSupabaseAdmin } from "../lib/supabase";

const router = Router();

// ── Google API shared JWT helper ──────────────────────────────────────────────
async function getGoogleToken(scope: string): Promise<string | null> {
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!json) return null;
  try {
    const sa = JSON.parse(json);
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(JSON.stringify({
      iss: sa.client_email,
      sub: sa.client_email,
      scope,
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })).toString("base64url");
    const signingInput = `${header}.${payload}`;
    const privateKey = crypto.createPrivateKey(sa.private_key);
    const signature = crypto.sign("SHA256", Buffer.from(signingInput), privateKey).toString("base64url");
    const jwt = `${signingInput}.${signature}`;
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
    });
    const tokenJson = await tokenRes.json() as { access_token?: string };
    return tokenJson.access_token ?? null;
  } catch (err) {
    console.error("[google-api] token error:", err);
    return null;
  }
}

async function getIndexingToken(): Promise<string | null> {
  return getGoogleToken("https://www.googleapis.com/auth/indexing");
}

async function notifyGoogleIndexing(articleUrl: string, type: "URL_UPDATED" | "URL_DELETED" = "URL_UPDATED") {
  try {
    const token = await getIndexingToken();
    if (!token) {
      console.info("[indexing-api] skipped — GOOGLE_SERVICE_ACCOUNT_JSON not set");
      return;
    }
    const res = await fetch("https://indexing.googleapis.com/v3/urlNotifications:publish", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url: articleUrl, type }),
    });
    const body = await res.json();
    if (res.ok) {
      console.info(`[indexing-api] notified ${type} ${articleUrl}`);
    } else {
      console.warn("[indexing-api] warn:", res.status, JSON.stringify(body).slice(0, 200));
    }
  } catch (err) {
    console.error("[indexing-api] error:", err);
  }
}

function authenticate(req: any, res: any): boolean {
  const apiKey = req.headers["x-api-key"];
  const configured = process.env.AUTOMATION_API_KEY;
  if (!configured) {
    res.status(500).json({ error: "AUTOMATION_API_KEY not configured on server" });
    return false;
  }
  if (apiKey !== configured) {
    res.status(401).json({ error: "Unauthorized — invalid API key" });
    return false;
  }
  return true;
}

const buildSlug = (v: string) =>
  v.toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

// ── GET /api/publish/test ─────────────────────────────────────────────────────
router.get("/publish/test", (_req, res) => {
  return res.json({
    ok: true,
    message: "Trichy Insight Custom Automation API is live",
    endpoints: {
      "POST /api/publish":   "Create a new article",
      "PATCH /api/publish/:id": "Update an existing article",
      "DELETE /api/publish/:id": "Delete an article",
      "GET /api/publish/list": "List recent articles",
    },
    auth: "Header: x-api-key: <your-key>",
    required_fields: ["title", "category", "content"],
    optional_fields: [
      "slug", "excerpt", "cover_image_url", "video_url",
      "meta_title", "meta_description", "meta_keywords",
      "publish", "published_at",
    ],
  });
});

// ── GET /api/publish/list ─────────────────────────────────────────────────────
router.get("/publish/list", async (req, res) => {
  if (!authenticate(req, res)) return;

  const limit = Math.min(Number(req.query.limit) || 20, 100);

  const { data, error } = await getSupabaseAdmin()
    .from("news_posts")
    .select("id, slug, title, category, is_published, published_at, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return res.status(500).json({ error: error.message });

  return res.json({ total: data.length, articles: data });
});

// ── POST /api/publish ─────────────────────────────────────────────────────────
router.post("/publish", async (req, res) => {
  if (!authenticate(req, res)) return;

  const {
    title,
    slug,
    category,
    excerpt,
    content,
    cover_image_url,
    video_url,
    meta_title,
    meta_description,
    meta_keywords,
    publish = false,
    published_at,
  } = req.body as {
    title?: string;
    slug?: string;
    category?: string;
    excerpt?: string;
    content?: string;
    cover_image_url?: string;
    video_url?: string;
    meta_title?: string;
    meta_description?: string;
    meta_keywords?: string | string[];
    publish?: boolean;
    published_at?: string;
  };

  if (!title?.trim() || !content?.trim() || !category?.trim()) {
    return res.status(400).json({
      error: "title, category, and content are required",
    });
  }

  const finalSlug = slug?.trim() || buildSlug(title.trim());

  const keywordsArray = Array.isArray(meta_keywords)
    ? meta_keywords
    : typeof meta_keywords === "string"
    ? meta_keywords.split(",").map((k) => k.trim()).filter(Boolean)
    : [];

  const pubAt = publish
    ? (published_at ? new Date(published_at).toISOString() : new Date().toISOString())
    : null;

  const payload = {
    title: title.trim(),
    slug: finalSlug,
    category: category.trim(),
    excerpt: excerpt?.trim() || null,
    content: content.trim(),
    cover_image_url: cover_image_url?.trim() || null,
    video_url: video_url?.trim() || null,
    meta_title: meta_title?.trim() || null,
    meta_description: meta_description?.trim() || null,
    meta_keywords: keywordsArray,
    is_published: Boolean(publish),
    published_at: pubAt,
  };

  const { data, error } = await getSupabaseAdmin()
    .from("news_posts")
    .insert(payload)
    .select("id, slug, title, category, is_published, published_at, created_at")
    .single();

  if (error) return res.status(500).json({ error: error.message });

  // Notify Google Indexing API when article is published
  if (data.is_published) {
    void notifyGoogleIndexing(`https://trichyinsight.online/news/${data.slug}`, "URL_UPDATED");
  }

  return res.status(201).json({
    success: true,
    action: "created",
    article: {
      id: data.id,
      slug: data.slug,
      title: data.title,
      category: data.category,
      is_published: data.is_published,
      published_at: data.published_at,
      url: `https://trichyinsight.online/news/${data.slug}`,
    },
  });
});

// ── PATCH /api/publish/:id ────────────────────────────────────────────────────
router.patch("/publish/:id", async (req, res) => {
  if (!authenticate(req, res)) return;

  const { id } = req.params;
  const updates = req.body as Record<string, any>;

  if (updates.publish !== undefined) {
    updates.is_published = Boolean(updates.publish);
    if (updates.is_published && !updates.published_at) {
      updates.published_at = new Date().toISOString();
    }
    delete updates.publish;
  }

  if (updates.meta_keywords && typeof updates.meta_keywords === "string") {
    updates.meta_keywords = updates.meta_keywords
      .split(",").map((k: string) => k.trim()).filter(Boolean);
  }

  const { data, error } = await getSupabaseAdmin()
    .from("news_posts")
    .update(updates)
    .eq("id", id)
    .select("id, slug, title, is_published, published_at")
    .single();

  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: "Article not found" });

  // Notify Google Indexing API on update (published or unpublished)
  if (data.is_published) {
    void notifyGoogleIndexing(`https://trichyinsight.online/news/${data.slug}`, "URL_UPDATED");
  }

  return res.json({
    success: true,
    action: "updated",
    article: {
      id: data.id,
      slug: data.slug,
      title: data.title,
      is_published: data.is_published,
      url: `https://trichyinsight.online/news/${data.slug}`,
    },
  });
});

// ── POST /api/indexing/verify/start ──────────────────────────────────────────
// Calls Google Site Verification API to get a FILE token, writes the HTML file
// into artifacts/trichy-insight/public/ so it's served at the domain root.
router.post("/indexing/verify/start", async (_req, res) => {
  const siteToken = await getGoogleToken("https://www.googleapis.com/auth/siteverification");
  if (!siteToken) return res.status(503).json({ error: "GOOGLE_SERVICE_ACCOUNT_JSON not configured" });

  try {
    // 1. Get verification token
    const tokenRes = await fetch("https://www.googleapis.com/siteVerification/v1/token", {
      method: "POST",
      headers: { Authorization: `Bearer ${siteToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        site: { type: "SITE", identifier: "https://trichyinsight.online/" },
        verificationMethod: "FILE",
      }),
    });
    const tokenBody = await tokenRes.json() as { token?: string; error?: { message?: string } };
    if (!tokenRes.ok || !tokenBody.token) {
      return res.status(500).json({ error: tokenBody.error?.message ?? "Failed to get verification token" });
    }

    const filename = tokenBody.token; // e.g. "google1a2b3c4d5e.html"
    const fileContent = `google-site-verification: ${filename}`;

    // 2. Write the HTML file — try all plausible dirs across dev and production.
    // process.cwd() differs by environment:
    //   dev  = /home/runner/workspace/artifacts/api-server  (pnpm filter runs from package dir)
    //   prod = /home/runner/workspace                        (monorepo root, from artifact.toml cmd)
    // In production, static files are served from artifacts/trichy-insight/dist/public (note: /public subdir inside dist).
    const cwd = process.cwd();
    const candidates = [
      // Production (cwd = monorepo root)
      path.join(cwd, "artifacts/trichy-insight/dist/public"),
      path.join(cwd, "artifacts/trichy-insight/dist"),
      path.join(cwd, "artifacts/trichy-insight/public"),
      // Dev (cwd = artifacts/api-server)
      path.resolve(cwd, "../../artifacts/trichy-insight/public"),
      path.resolve(cwd, "../../artifacts/trichy-insight/dist/public"),
      path.resolve(cwd, "../../artifacts/trichy-insight/dist"),
    ];
    let written = false;
    const writtenTo: string[] = [];
    for (const dir of candidates) {
      try {
        if (fs.existsSync(dir)) {
          fs.writeFileSync(path.join(dir, filename), fileContent, "utf8");
          writtenTo.push(dir);
          written = true;
          console.info(`[verify] Wrote ${filename} to ${dir}`);
        }
      } catch (e) {
        console.warn(`[verify] Could not write to ${dir}:`, e);
      }
    }
    if (!written) {
      return res.status(500).json({
        error: `Could not write verification file. cwd=${cwd}. Tried: ${candidates.join(", ")}`,
      });
    }

    return res.json({ success: true, filename, fileContent, writtenTo, message: "Verification file written. Click Confirm to complete verification." });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ── POST /api/indexing/verify/confirm ─────────────────────────────────────────
// Calls siteVerification.webResource.insert to complete ownership verification.
router.post("/indexing/verify/confirm", async (_req, res) => {
  const siteToken = await getGoogleToken("https://www.googleapis.com/auth/siteverification");
  if (!siteToken) return res.status(503).json({ error: "GOOGLE_SERVICE_ACCOUNT_JSON not configured" });

  try {
    const insertRes = await fetch(
      "https://www.googleapis.com/siteVerification/v1/webResource?verificationMethod=FILE",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${siteToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          site: { type: "SITE", identifier: "https://trichyinsight.online/" },
        }),
      }
    );
    const insertBody = await insertRes.json() as Record<string, unknown>;
    if (insertRes.ok) {
      return res.json({ success: true, message: "Site verified! Service account is now an owner.", resource: insertBody });
    }
    return res.status(insertRes.status).json({ success: false, error: insertBody });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ── GET /api/indexing/status ──────────────────────────────────────────────────
router.get("/indexing/status", (_req, res) => {
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!json) return res.json({ configured: false });
  try {
    const sa = JSON.parse(json) as { client_email?: string; project_id?: string };
    return res.json({ configured: true, clientEmail: sa.client_email ?? "", projectId: sa.project_id ?? "" });
  } catch {
    return res.json({ configured: false, error: "Invalid JSON in GOOGLE_SERVICE_ACCOUNT_JSON" });
  }
});

// ── POST /api/indexing/notify ─────────────────────────────────────────────────
// Notify Google for a single slug. No API key needed (admin-only page calls this).
router.post("/indexing/notify", async (req, res) => {
  const { slug, url } = req.body as { slug?: string; url?: string };
  const target = url ?? (slug ? `https://trichyinsight.online/news/${slug}` : null);
  if (!target) return res.status(400).json({ error: "slug or url required" });

  const token = await getIndexingToken();
  if (!token) {
    return res.status(503).json({ error: "GOOGLE_SERVICE_ACCOUNT_JSON not configured" });
  }
  try {
    const r = await fetch("https://indexing.googleapis.com/v3/urlNotifications:publish", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url: target, type: "URL_UPDATED" }),
    });
    const body = await r.json() as Record<string, unknown>;
    if (r.ok) {
      return res.json({ success: true, url: target, response: body });
    }
    return res.status(r.status).json({ success: false, url: target, error: body });
  } catch (err) {
    return res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

// ── POST /api/indexing/batch ──────────────────────────────────────────────────
router.post("/indexing/batch", async (req, res) => {
  if (!authenticate(req, res)) return;

  const token = await getIndexingToken();
  if (!token) {
    return res.status(503).json({ error: "GOOGLE_SERVICE_ACCOUNT_JSON not configured" });
  }

  const { data, error } = await getSupabaseAdmin()
    .from("news_posts")
    .select("slug, title")
    .eq("is_published", true)
    .order("published_at", { ascending: false })
    .limit(200);

  if (error) return res.status(500).json({ error: error.message });

  const results: { url: string; title: string; status: "ok" | "error"; code?: number }[] = [];

  for (const post of data ?? []) {
    const postUrl = `https://trichyinsight.online/news/${post.slug}`;
    try {
      const r = await fetch("https://indexing.googleapis.com/v3/urlNotifications:publish", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ url: postUrl, type: "URL_UPDATED" }),
      });
      results.push({ url: postUrl, title: post.title, status: r.ok ? "ok" : "error", code: r.status });
    } catch {
      results.push({ url: postUrl, title: post.title, status: "error" });
    }
    // Respect Google's rate limit — 600 calls/minute = 10/sec; pause 120ms
    await new Promise(r => setTimeout(r, 120));
  }

  const submitted = results.filter(r => r.status === "ok").length;
  const failed    = results.filter(r => r.status === "error").length;
  return res.json({ submitted, failed, total: results.length, results });
});

// ── DELETE /api/publish/:id ───────────────────────────────────────────────────
router.delete("/publish/:id", async (req, res) => {
  if (!authenticate(req, res)) return;

  const { id } = req.params;

  const { error } = await getSupabaseAdmin()
    .from("news_posts")
    .delete()
    .eq("id", id);

  if (error) return res.status(500).json({ error: error.message });

  return res.json({ success: true, action: "deleted", id });
});

export default router;
