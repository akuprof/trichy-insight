import { Router } from "express";

const router = Router();

// Google deprecated the sitemap ping endpoint in June 2023 (always returns 404).
// Modern approach: keep sitemap <lastmod> accurate and Google crawls it automatically.
// This endpoint logs the intent and returns skipped=true so no error toast is shown.
router.post("/google-news/ping", (req, res) => {
  const { postId, publicBaseUrl } = req.body as {
    postId?: string;
    publicBaseUrl?: string;
  };

  const base = (publicBaseUrl ?? "").replace(/\/$/, "");
  const sitemapUrl = base ? `${base}/sitemap.xml` : null;

  console.info(`[google-news] sitemap ping skipped (deprecated by Google) postId=${postId} sitemap=${sitemapUrl}`);

  return res.json({ success: true, skipped: true, sitemap_url: sitemapUrl });
});

export default router;
