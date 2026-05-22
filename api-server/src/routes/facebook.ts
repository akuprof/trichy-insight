import { Router } from "express";

const router = Router();

const FB_APP_ID = process.env.FACEBOOK_APP_ID || process.env.INSTAGRAM_APP_ID || "1976213376265645";
const FB_APP_SECRET = process.env.FACEBOOK_APP_SECRET || process.env.INSTAGRAM_APP_SECRET || "";
const REDIRECT_URI = process.env.FACEBOOK_REDIRECT_URI || "https://trichyinsight.online/admin";
const GRAPH = "https://graph.facebook.com/v21.0";

/* ── OAuth token exchange ─────────────────────────────────────── */
router.get("/facebook/oauth", async (req, res) => {
  const code = req.query["code"] as string | undefined;

  if (!code) {
    return res.status(400).json({ error: "Missing code parameter" });
  }

  if (!FB_APP_SECRET) {
    return res.status(500).json({
      error: "FACEBOOK_APP_SECRET (or INSTAGRAM_APP_SECRET) env var not set",
    });
  }

  try {
    // Step 1: exchange code → short-lived user access token
    const tokenUrl = new URL(`${GRAPH}/oauth/access_token`);
    tokenUrl.searchParams.set("client_id", FB_APP_ID);
    tokenUrl.searchParams.set("redirect_uri", REDIRECT_URI);
    tokenUrl.searchParams.set("client_secret", FB_APP_SECRET);
    tokenUrl.searchParams.set("code", code);

    const shortRes = await fetch(tokenUrl.toString());
    const shortData = (await shortRes.json()) as {
      access_token?: string;
      token_type?: string;
      error?: { message?: string; type?: string };
    };

    if (!shortData.access_token) {
      console.error("Facebook short-lived token error:", shortData);
      return res.status(400).json({
        error: shortData.error?.message ?? "Failed to get short-lived token",
        raw: shortData,
      });
    }

    // Step 2: exchange short-lived → long-lived user access token (~60 days)
    const longUrl = new URL(`${GRAPH}/oauth/access_token`);
    longUrl.searchParams.set("grant_type", "fb_exchange_token");
    longUrl.searchParams.set("client_id", FB_APP_ID);
    longUrl.searchParams.set("client_secret", FB_APP_SECRET);
    longUrl.searchParams.set("fb_exchange_token", shortData.access_token);

    const longRes = await fetch(longUrl.toString());
    const longData = (await longRes.json()) as {
      access_token?: string;
      token_type?: string;
      expires_in?: number;
      error?: { message?: string };
    };

    const userToken = longData.access_token ?? shortData.access_token;

    // Step 3: get user's managed Facebook Pages (never-expiring page tokens)
    const pagesUrl = new URL(`${GRAPH}/me/accounts`);
    pagesUrl.searchParams.set("access_token", userToken);
    pagesUrl.searchParams.set("fields", "id,name,access_token,category");

    const pagesRes = await fetch(pagesUrl.toString());
    const pagesData = (await pagesRes.json()) as {
      data?: Array<{
        id: string;
        name: string;
        access_token: string;
        category?: string;
      }>;
      error?: { message?: string };
    };

    if (!pagesData.data?.length) {
      return res.status(400).json({
        error: pagesData.error?.message ?? "No Facebook Pages found. Make sure you manage at least one Page.",
        raw: pagesData,
      });
    }

    const pages = pagesData.data.map((p) => ({
      id: p.id,
      name: p.name,
      access_token: p.access_token,
      category: p.category ?? "",
    }));

    console.log(`Facebook OAuth success — ${pages.length} page(s) found`);

    return res.json({
      pages,
      // Convenience: return first page directly
      page_id: pages[0].id,
      page_name: pages[0].name,
      page_access_token: pages[0].access_token,
      expires_in: longData.expires_in,
    });
  } catch (err) {
    console.error("Facebook OAuth error:", err);
    return res.status(500).json({ error: "OAuth exchange failed", detail: String(err) });
  }
});

export default router;
