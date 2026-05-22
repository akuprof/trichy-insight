import { Router } from "express";

const router = Router();

const getCredentials = () => ({
  clientId: process.env.YOUTUBE_CLIENT_ID ?? "",
  clientSecret: process.env.YOUTUBE_CLIENT_SECRET ?? "",
  redirectUri: "https://trichyinsight.online/api/oauth/youtube/callback",
});

router.get("/oauth/youtube/start", (_req, res) => {
  const { clientId, redirectUri } = getCredentials();
  if (!clientId) {
    return res.status(500).send("YOUTUBE_CLIENT_ID not configured");
  }
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  return res.redirect(url.toString());
});

router.get("/oauth/youtube/callback", async (req, res) => {
  const code = req.query.code as string | undefined;
  const error = req.query.error as string | undefined;

  if (error || !code) {
    return res.status(400).send(`
      <html><body style="font-family:sans-serif;padding:2rem;background:#fff3f3">
        <h2 style="color:#c0392b">❌ Authorization failed</h2>
        <p>${error ?? "No code received"}</p>
      </body></html>
    `);
  }

  try {
    const { clientId, clientSecret, redirectUri } = getCredentials();
    console.info(`[youtube-oauth] exchanging code, clientId=${clientId.slice(0, 20)}... redirectUri=${redirectUri}`);
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const data = await tokenRes.json() as {
      access_token?: string;
      refresh_token?: string;
      error?: string;
      error_description?: string;
    };

    if (!data.refresh_token) {
      throw new Error(data.error_description ?? data.error ?? "No refresh token returned");
    }

    const token = data.refresh_token;

    return res.send(`
      <html>
      <head><title>YouTube Connected ✅</title></head>
      <body style="font-family:sans-serif;max-width:640px;margin:3rem auto;padding:1rem">
        <h2 style="color:#27ae60">✅ YouTube Authorization Successful!</h2>
        <p>Your refresh token has been generated. Copy it and add it as a secret named <strong>YOUTUBE_REFRESH_TOKEN</strong> in your Replit project.</p>
        <div style="background:#f4f4f4;border:1px solid #ddd;border-radius:6px;padding:1rem;margin:1rem 0;word-break:break-all;font-family:monospace;font-size:14px">
          ${token}
        </div>
        <button onclick="navigator.clipboard.writeText('${token}');this.textContent='Copied!';this.style.background='#27ae60'" 
          style="background:#2563eb;color:#fff;border:none;padding:0.6rem 1.4rem;border-radius:6px;cursor:pointer;font-size:15px">
          Copy Token
        </button>
        <p style="margin-top:2rem;color:#666;font-size:13px">
          Once copied, go to your Replit project → Secrets → set <code>YOUTUBE_REFRESH_TOKEN</code> to this value.
        </p>
      </body>
      </html>
    `);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).send(`
      <html><body style="font-family:sans-serif;padding:2rem;background:#fff3f3">
        <h2 style="color:#c0392b">❌ Token exchange failed</h2>
        <p>${msg}</p>
      </body></html>
    `);
  }
});

export default router;
