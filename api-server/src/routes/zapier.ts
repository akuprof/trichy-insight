import { Router } from "express";
import { getSupabaseAdmin } from "../lib/supabase";

const router = Router();

const INBOUND_SECRET_HEADER = "x-zapier-inbound-secret";

router.post("/zapier/article", async (req, res) => {
  const secret = req.headers[INBOUND_SECRET_HEADER];
  const configuredSecret = process.env.ZAPIER_INBOUND_SECRET;

  if (configuredSecret && secret !== configuredSecret) {
    return res.status(401).json({ error: "Unauthorized — invalid secret" });
  }

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
  };

  if (!title?.trim() || !content?.trim() || !category?.trim()) {
    return res.status(400).json({ error: "title, category, and content are required" });
  }

  if (!cover_image_url?.trim() && !video_url?.trim()) {
    return res.status(400).json({ error: "Either cover_image_url or video_url is required" });
  }

  const buildSlug = (v: string) =>
    v.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-");

  const finalSlug = slug?.trim() || buildSlug(title.trim());

  const keywordsArray = Array.isArray(meta_keywords)
    ? meta_keywords
    : typeof meta_keywords === "string"
    ? meta_keywords.split(",").map((k) => k.trim()).filter(Boolean)
    : [];

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
    published_at: publish ? new Date().toISOString() : null,
  };

  const { data, error } = await getSupabaseAdmin()
    .from("news_posts")
    .insert(payload)
    .select("id, slug, title, is_published, created_at")
    .single();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(201).json({
    created: true,
    id: data.id,
    slug: data.slug,
    title: data.title,
    is_published: data.is_published,
    url: `/news/${data.slug}`,
  });
});

router.get("/zapier/test", (_req, res) => {
  return res.json({
    ok: true,
    message: "Trichy Insight Zapier inbound endpoint is live",
    endpoints: {
      create_article: "POST /api/zapier/article",
      required_fields: ["title", "category", "content"],
      optional_fields: [
        "slug", "excerpt", "cover_image_url", "video_url",
        "meta_title", "meta_description", "meta_keywords", "publish"
      ],
      auth: `Header: ${INBOUND_SECRET_HEADER}: <your-secret>`,
    },
  });
});

export default router;
