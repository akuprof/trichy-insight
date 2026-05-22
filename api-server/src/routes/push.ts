import { Router } from "express";
import webpush from "web-push";
import { getSupabaseAdmin } from "../lib/supabase";

const router = Router();

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY ?? "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? "";
const VAPID_EMAIL = "mailto:admin@trichyinsight.online";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

async function ensureTable() {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("push_subscriptions").select("id").limit(1);
  return !error;
}

router.get("/push/vapid-key", (_req, res) => {
  if (!VAPID_PUBLIC_KEY) {
    res.status(500).json({ error: "VAPID keys not configured" });
    return;
  }
  res.json({ publicKey: VAPID_PUBLIC_KEY });
});

router.post("/push/subscribe", async (req, res) => {
  const { endpoint, keys, expirationTime } = req.body as {
    endpoint: string;
    keys: { p256dh: string; auth: string };
    expirationTime?: number | null;
  };

  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    res.status(400).json({ error: "Invalid subscription object" });
    return;
  }

  const tableExists = await ensureTable();
  if (!tableExists) {
    res.status(503).json({ error: "push_subscriptions table not ready — run migration first" });
    return;
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("push_subscriptions").upsert(
    { endpoint, p256dh: keys.p256dh, auth: keys.auth, expiration_time: expirationTime ?? null },
    { onConflict: "endpoint" },
  );

  if (error) {
    console.error("[push] subscribe error:", error);
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ ok: true });
});

router.delete("/push/unsubscribe", async (req, res) => {
  const { endpoint } = req.body as { endpoint: string };
  if (!endpoint) { res.status(400).json({ error: "endpoint required" }); return; }

  const supabase = getSupabaseAdmin();
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  res.json({ ok: true });
});

router.post("/push/send", async (req, res) => {
  const { title, body, url, icon } = req.body as {
    title: string; body: string; url?: string; icon?: string;
  };

  if (!title || !body) { res.status(400).json({ error: "title and body required" }); return; }
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    res.status(503).json({ error: "VAPID keys not configured" });
    return;
  }

  const supabase = getSupabaseAdmin();
  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth");

  if (error) { res.status(500).json({ error: error.message }); return; }
  if (!subs || subs.length === 0) { res.json({ sent: 0, message: "No subscribers" }); return; }

  const payload = JSON.stringify({ title, body, url: url ?? "/", icon: icon ?? "/favicon.ico" });
  const stale: string[] = [];
  let sent = 0;

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        );
        sent++;
      } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 410 || status === 404) stale.push(sub.endpoint);
      }
    }),
  );

  if (stale.length > 0) {
    await supabase.from("push_subscriptions").delete().in("endpoint", stale);
  }

  res.json({ sent, stale: stale.length, total: subs.length });
});

export default router;
