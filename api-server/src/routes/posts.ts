import { Router, type IRouter } from "express";
import { createClient } from "@supabase/supabase-js";

const router: IRouter = Router();

const getSupabase = () => {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase env vars not set");
  return createClient(url, key);
};

router.get("/posts", async (req, res) => {
  try {
    const supabase = getSupabase();
    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10));
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? "20"), 10)));
    const category = req.query.category as string | undefined;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from("news_posts")
      .select("id, title, slug, category, excerpt, cover_image_url, video_url, published_at, created_at", { count: "exact" })
      .eq("is_published", true)
      .order("published_at", { ascending: false })
      .range(from, to);

    if (category) {
      query = query.eq("category", category);
    }

    const { data, count, error } = await query;

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({
      posts: data ?? [],
      total: count ?? 0,
      page,
      limit,
      totalPages: Math.ceil((count ?? 0) / limit),
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

router.get("/posts/:slug", async (req, res) => {
  try {
    const supabase = getSupabase();
    const { slug } = req.params;

    const { data, error } = await supabase
      .from("news_posts")
      .select("id, title, slug, category, excerpt, content, cover_image_url, video_url, meta_title, meta_description, meta_keywords, published_at, created_at")
      .eq("slug", slug)
      .eq("is_published", true)
      .maybeSingle();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    if (!data) {
      res.status(404).json({ error: "Post not found" });
      return;
    }

    res.json({ post: data });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

router.get("/categories", async (_req, res) => {
  try {
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from("news_posts")
      .select("category")
      .eq("is_published", true);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    const categoryCounts = (data ?? []).reduce<Record<string, number>>((acc, row) => {
      acc[row.category] = (acc[row.category] ?? 0) + 1;
      return acc;
    }, {});

    const categories = Object.entries(categoryCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    res.json({ categories });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

export default router;
