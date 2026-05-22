import { Router } from "express";
import { getSupabase } from "../lib/supabase";

const router = Router();

const escapeXml = (str: string) =>
  str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

async function getSiteUrl() {
  const { data } = await getSupabase()
    .from("site_settings")
    .select("settings")
    .eq("id", 1)
    .maybeSingle();
  const s = (data?.settings ?? {}) as Record<string, unknown>;
  const domain = (s.domain as string | undefined) ?? "trichyinsight.online";
  const siteName = (s.site_name as string | undefined) ?? "Trichy Insight";
  return { siteUrl: `https://${domain}`, siteName };
}

// ── Standard sitemap ─────────────────────────────────────────────────────────
router.get("/sitemap.xml", async (_req, res) => {
  const { siteUrl } = await getSiteUrl();

  const { data: posts } = await getSupabase()
    .from("news_posts")
    .select("slug, published_at, created_at, updated_at")
    .eq("is_published", true)
    .order("published_at", { ascending: false })
    .limit(500);

  const staticPages = [
    { loc: siteUrl, priority: "1.0", changefreq: "hourly" },
    { loc: `${siteUrl}/categories`, priority: "0.8", changefreq: "daily" },
    { loc: `${siteUrl}/stories`, priority: "0.8", changefreq: "daily" },
    { loc: `${siteUrl}/tools`, priority: "0.6", changefreq: "monthly" },
    { loc: `${siteUrl}/about`, priority: "0.5", changefreq: "monthly" },
  ];

  const staticUrls = staticPages.map(
    (p) => `  <url>
    <loc>${p.loc}</loc>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`,
  ).join("\n");

  const articleUrls = (posts ?? []).map((p) => {
    const lastmod = new Date(p.updated_at ?? p.published_at ?? p.created_at)
      .toISOString()
      .split("T")[0];
    return `  <url>
    <loc>${siteUrl}/news/${escapeXml(p.slug)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`;
  }).join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticUrls}
${articleUrls}
</urlset>`;

  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=600");
  return res.send(xml);
});

// ── Google News sitemap (articles published within last 48 hours) ─────────────
router.get("/sitemap-news.xml", async (_req, res) => {
  const { siteUrl, siteName } = await getSiteUrl();
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

  const { data: posts } = await getSupabase()
    .from("news_posts")
    .select("slug, title, published_at, created_at")
    .eq("is_published", true)
    .gte("published_at", cutoff)
    .order("published_at", { ascending: false })
    .limit(1000);

  const urls = (posts ?? []).map((p) => {
    const pubDate = new Date(p.published_at ?? p.created_at).toISOString();
    return `  <url>
    <loc>${siteUrl}/news/${escapeXml(p.slug)}</loc>
    <news:news>
      <news:publication>
        <news:name>${escapeXml(siteName)}</news:name>
        <news:language>ta</news:language>
      </news:publication>
      <news:publication_date>${pubDate}</news:publication_date>
      <news:title>${escapeXml(p.title)}</news:title>
    </news:news>
  </url>`;
  }).join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${urls}
</urlset>`;

  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300");
  return res.send(xml);
});

export default router;
