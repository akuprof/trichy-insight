import { Router } from "express";

const router = Router();

const VERIFY_TOKEN = process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN || "trichy_insight_ig_webhook_2026";
const APP_ID = process.env.INSTAGRAM_APP_ID || "1976213376265645";
const APP_SECRET = process.env.INSTAGRAM_APP_SECRET || "";
const REDIRECT_URI = process.env.INSTAGRAM_REDIRECT_URI || "https://trichyinsight.online/admin";

/* ── Webhook verification (GET) ─────────────────────────────── */
router.get("/instagram/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Instagram webhook verified");
    return res.status(200).send(challenge);
  }

  console.warn("Instagram webhook verification failed", { mode, token });
  return res.status(403).json({ error: "Verification failed — check verify_token" });
});

/* ── Webhook events (POST) ──────────────────────────────────── */
router.post("/instagram/webhook", (req, res) => {
  const body = req.body as {
    object?: string;
    entry?: Array<{ id?: string; changes?: Array<{ field?: string; value?: unknown }> }>;
  };

  if (body.object === "instagram") {
    (body.entry ?? []).forEach((entry) => {
      (entry.changes ?? []).forEach((change) => {
        console.log("Instagram webhook event:", JSON.stringify({ field: change.field, value: change.value }));
      });
    });
  }

  return res.status(200).json({ received: true });
});

/* ── OAuth token exchange ────────────────────────────────────── */
router.get("/instagram/oauth", async (req, res) => {
  const code = req.query["code"] as string | undefined;

  if (!code) {
    return res.status(400).json({ error: "Missing code parameter" });
  }

  if (!APP_SECRET) {
    return res.status(500).json({ error: "INSTAGRAM_APP_SECRET env var not set" });
  }

  try {
    // Step 1: exchange code → short-lived token
    const tokenBody = new URLSearchParams({
      client_id: APP_ID,
      client_secret: APP_SECRET,
      grant_type: "authorization_code",
      redirect_uri: REDIRECT_URI,
      code,
    });

    const shortRes = await fetch("https://api.instagram.com/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenBody.toString(),
    });

    const shortData = (await shortRes.json()) as {
      access_token?: string;
      user_id?: number;
      error_message?: string;
    };

    if (!shortData.access_token) {
      console.error("Short-lived token error:", shortData);
      return res.status(400).json({ error: shortData.error_message ?? "Failed to get short-lived token", raw: shortData });
    }

    // Step 2: exchange short-lived → long-lived token (60-day expiry)
    const longUrl = new URL("https://graph.instagram.com/access_token");
    longUrl.searchParams.set("grant_type", "ig_exchange_token");
    longUrl.searchParams.set("client_secret", APP_SECRET);
    longUrl.searchParams.set("access_token", shortData.access_token);

    const longRes = await fetch(longUrl.toString());
    const longData = (await longRes.json()) as {
      access_token?: string;
      token_type?: string;
      expires_in?: number;
      error?: { message?: string };
    };

    if (!longData.access_token) {
      console.error("Long-lived token error:", longData);
      // Fall back to short-lived token
      return res.json({
        access_token: shortData.access_token,
        ig_user_id: String(shortData.user_id ?? "17841447727738548"),
        token_type: "short_lived",
        note: "Long-lived exchange failed; token expires in ~1 hour",
      });
    }

    console.log(`Instagram OAuth success — long-lived token obtained (expires in ${longData.expires_in}s)`);
    return res.json({
      access_token: longData.access_token,
      ig_user_id: String(shortData.user_id ?? "17841447727738548"),
      token_type: longData.token_type ?? "bearer",
      expires_in: longData.expires_in,
    });
  } catch (err) {
    console.error("Instagram OAuth error:", err);
    return res.status(500).json({ error: "OAuth exchange failed", detail: String(err) });
  }
});

/* ── Token validation ───────────────────────────────────────── */
router.post("/instagram/validate-token", async (req, res) => {
  const { access_token, ig_user_id } = req.body as { access_token?: string; ig_user_id?: string };

  const token = access_token || process.env.INSTAGRAM_ACCESS_TOKEN || "";
  const userId = ig_user_id || "17841447727738548";

  if (!token) {
    return res.json({ valid: false, error: "No access token provided" });
  }

  try {
    // Check token info
    const debugUrl = `https://graph.facebook.com/v22.0/debug_token?input_token=${token}&access_token=${token}`;
    const debugRes = await fetch(debugUrl);
    const debugData = (await debugRes.json()) as {
      data?: {
        is_valid?: boolean;
        expires_at?: number;
        scopes?: string[];
        error?: { message?: string; code?: number };
      };
      error?: { message?: string; code?: number };
    };

    if (debugData.error) {
      return res.json({ valid: false, error: `Token debug failed: ${debugData.error.message}` });
    }

    const tokenInfo = debugData.data;
    const isValid = tokenInfo?.is_valid ?? false;
    const expiresAt = tokenInfo?.expires_at;
    const scopes = tokenInfo?.scopes ?? [];
    const hasPublishScope = scopes.some((s) =>
      s.includes("content_publish") || s.includes("instagram_content_publish") || s.includes("business_content_publish")
    );

    // Try to fetch account info
    let accountInfo: { username?: string; name?: string } = {};
    try {
      const meRes = await fetch(`https://graph.facebook.com/v22.0/${userId}?fields=name,username&access_token=${token}`);
      accountInfo = (await meRes.json()) as { username?: string; name?: string };
    } catch {}

    return res.json({
      valid: isValid,
      expires_at: expiresAt,
      expires_human: expiresAt ? new Date(expiresAt * 1000).toLocaleDateString("ta-IN") : "never",
      is_expired: expiresAt ? Date.now() / 1000 > expiresAt : false,
      scopes,
      has_publish_scope: hasPublishScope,
      account: accountInfo,
      app_secret_set: !!APP_SECRET,
    });
  } catch (err) {
    return res.json({ valid: false, error: `Validation request failed: ${String(err)}` });
  }
});

/* ── Config info ─────────────────────────────────────────────── */
router.get("/instagram/config", (_req, res) => {
  const base = process.env.PUBLIC_API_URL ?? "https://trichyinsight.online";
  return res.json({
    webhook_callback_url: `${base}/api/instagram/webhook`,
    verify_token: VERIFY_TOKEN,
    ig_user_id: "17841447727738548",
    app_id: APP_ID,
    redirect_uri: REDIRECT_URI,
    permissions_needed: ["instagram_business_basic", "instagram_business_content_publish", "instagram_business_manage_comments", "instagram_business_manage_insights"],
    app_secret_set: !!APP_SECRET,
  });
});

export default router;
