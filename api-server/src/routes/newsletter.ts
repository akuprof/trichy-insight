import { Router } from "express";
import crypto from "node:crypto";
import pg from "pg";

const router = Router();

const DATABASE_URL = process.env.DATABASE_URL ?? "";
const RESEND_API_KEY = process.env.RESEND_API_KEY ?? "";
const FROM_EMAIL = process.env.NEWSLETTER_FROM_EMAIL ?? "newsletter@trichyinsight.online";

const pool = DATABASE_URL
  ? new pg.Pool({ connectionString: DATABASE_URL, max: 3 })
  : null;

async function query(sql: string, params: unknown[] = []) {
  if (!pool) throw new Error("DATABASE_URL not configured");
  const client = await pool.connect();
  try {
    return await client.query(sql, params);
  } finally {
    client.release();
  }
}

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.warn("[newsletter] RESEND_API_KEY not set — email skipped");
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error("[newsletter] Resend error:", res.status, err.slice(0, 200));
      return false;
    }
    return true;
  } catch (err) {
    console.error("[newsletter] sendEmail error:", err);
    return false;
  }
}

// GET /api/newsletter/count (public — returns active subscriber count only)
router.get("/newsletter/count", async (_req, res) => {
  try {
    const result = await query("SELECT COUNT(*) FROM newsletter_subscribers WHERE is_active = true");
    return res.json({ count: parseInt(result.rows[0].count, 10) });
  } catch {
    return res.json({ count: 0 });
  }
});

// POST /api/newsletter/subscribe
router.post("/newsletter/subscribe", async (req, res) => {
  const { email, name } = req.body as { email?: string; name?: string };

  if (!email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return res.status(400).json({ error: "Valid email is required" });
  }

  const emailLower = email.trim().toLowerCase();

  try {
    const existing = await query(
      "SELECT id, is_active FROM newsletter_subscribers WHERE email = $1",
      [emailLower]
    );

    if (existing.rows.length > 0) {
      if (existing.rows[0].is_active) {
        return res.json({ success: true, message: "Already subscribed" });
      }
      await query(
        "UPDATE newsletter_subscribers SET is_active = true WHERE email = $1",
        [emailLower]
      );
    } else {
      const token = crypto.randomUUID();
      await query(
        "INSERT INTO newsletter_subscribers (email, name, unsubscribe_token) VALUES ($1, $2, $3)",
        [emailLower, name?.trim() || null, token]
      );

      const siteUrl = "https://trichyinsight.online";
      void sendEmail(
        email.trim(),
        "Trichy Insight செய்திகள் — வரவேற்கிறோம்!",
        `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
          <h2 style="color:#DC2626">Trichy Insight நியூஸ்லெட்டர்</h2>
          <p>வணக்கம்${name ? ` ${name}` : ""}!</p>
          <p>திருச்சி இன்சைட் நியூஸ்லெட்டரில் உங்களை வரவேற்கிறோம். திருச்சிராப்பள்ளியின் முக்கியமான செய்திகள் உங்கள் மின்னஞ்சலுக்கு நேரடியாக வரும்.</p>
          <p><a href="${siteUrl}" style="color:#DC2626">trichyinsight.online</a> பார்வையிட மறக்காதீர்கள்.</p>
          <hr style="margin:24px 0;border:none;border-top:1px solid #eee"/>
          <p style="font-size:12px;color:#888">சந்தா நிறுத்த: <a href="${siteUrl}/api/newsletter/unsubscribe/${token}">இங்கே கிளிக் செய்யுங்கள்</a></p>
        </div>`
      );
    }

    return res.json({ success: true, message: "Subscribed successfully" });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[newsletter] subscribe error:", msg);
    return res.status(500).json({ error: "Database error: " + msg });
  }
});

// GET /api/newsletter/unsubscribe/:token
router.get("/newsletter/unsubscribe/:token", async (req, res) => {
  const { token } = req.params;
  try {
    await query(
      "UPDATE newsletter_subscribers SET is_active = false WHERE unsubscribe_token = $1",
      [token]
    );
  } catch (err) {
    console.error("[newsletter] unsubscribe error:", err);
  }
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  return res.send(`<!doctype html><html lang="ta"><head><meta charset="UTF-8"><title>சந்தா நிறுத்தப்பட்டது</title></head>
    <body style="font-family:sans-serif;text-align:center;padding:60px">
      <h2>✓ சந்தா நிறுத்தப்பட்டது</h2>
      <p>Trichy Insight நியூஸ்லெட்டரிலிருந்து நீங்கள் வெற்றிகரமாக நீக்கப்பட்டீர்கள்.</p>
      <a href="https://trichyinsight.online">முகப்புக்கு திரும்பு</a>
    </body></html>`);
});

// POST /api/newsletter/send  (admin — requires x-api-key)
router.post("/newsletter/send", async (req, res) => {
  const apiKey = req.headers["x-api-key"];
  const configured = process.env.AUTOMATION_API_KEY;
  if (!configured || apiKey !== configured) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { subject, html } = req.body as { subject?: string; html?: string };
  if (!subject?.trim() || !html?.trim()) {
    return res.status(400).json({ error: "subject and html are required" });
  }

  try {
    const result = await query(
      "SELECT email, unsubscribe_token FROM newsletter_subscribers WHERE is_active = true"
    );
    const list = result.rows as { email: string; unsubscribe_token: string }[];

    let sent = 0;
    let failed = 0;
    for (const sub of list) {
      const unsubUrl = `https://trichyinsight.online/api/newsletter/unsubscribe/${sub.unsubscribe_token}`;
      const fullHtml =
        html +
        `<hr style="margin:24px 0;border:none;border-top:1px solid #eee"/>
        <p style="font-size:12px;color:#888">சந்தா நிறுத்த: <a href="${unsubUrl}">இங்கே கிளிக் செய்யுங்கள்</a></p>`;
      const ok = await sendEmail(sub.email, subject, fullHtml);
      ok ? sent++ : failed++;
    }
    return res.json({ success: true, sent, failed, total: list.length });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: msg });
  }
});

// GET /api/newsletter/subscribers  (admin)
router.get("/newsletter/subscribers", async (req, res) => {
  const apiKey = req.headers["x-api-key"];
  const configured = process.env.AUTOMATION_API_KEY;
  if (!configured || apiKey !== configured) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const result = await query(
      "SELECT id, email, name, subscribed_at, is_active FROM newsletter_subscribers ORDER BY subscribed_at DESC"
    );
    return res.json({ total: result.rows.length, subscribers: result.rows });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: msg });
  }
});

export default router;
