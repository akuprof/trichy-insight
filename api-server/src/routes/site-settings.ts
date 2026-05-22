import { Router } from "express";
import { getSupabase, getSupabaseAdmin } from "../lib/supabase";

const router = Router();

router.get("/site-settings", async (_req, res) => {
  try {
    const { data, error } = await getSupabase()
      .from("site_settings")
      .select("settings")
      .eq("id", 1)
      .maybeSingle();

    if (error) throw error;
    res.json(data?.settings ?? {});
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

router.put("/site-settings", async (req, res) => {
  try {
    const admin = getSupabaseAdmin();
    const { error } = await admin
      .from("site_settings")
      .upsert({ id: 1, settings: req.body }, { onConflict: "id" });

    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

export default router;
