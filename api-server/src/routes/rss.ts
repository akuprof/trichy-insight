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

async function getSiteSettings() {
  const { data } = await getSupabase()
    .from("site_settings")
    .select("settings")
    .eq("id", 1)
    .maybeSingle();
  const s = (data?.settings ?? {}) as Record<string, unknown>;
  return {
    siteUrl: `https://${(s.domain as string | undefined) ?? "trichyinsight.online"}`,
    siteName: (s.site_name as string | undefined) ?? "Trichy Insight",
    rssDescription: (s.rss_description as string | undefined) ?? "Tamil local news",
  };
}

router.get("/rss.xml", async (_req, res) => {
  const { siteUrl, siteName, rssDescription } = await getSiteSettings();

  const { data: posts } = await getSupabase()
    .from("news_posts")
    .select("id, title, slug, excerpt, category, cover_image_url, published_at, created_at")
    .eq("is_published", true)
    .order("published_at", { ascending: false })
    .limit(50);

  const items = (posts ?? []).map((p) => {
    const url = `${siteUrl}/news/${p.slug}`;
    const pubDate = new Date(p.published_at ?? p.created_at).toUTCString();
    const image = p.cover_image_url
      ? `<enclosure url="${escapeXml(p.cover_image_url)}" type="image/jpeg" length="0"/>`
      : "";
    return `
    <item>
      <title>${escapeXml(p.title)}</title>
      <link>${escapeXml(url)}</link>
      <guid isPermaLink="true">${escapeXml(url)}</guid>
      <description>${escapeXml(p.excerpt ?? p.title)}</description>
      <category>${escapeXml(p.category)}</category>
      <pubDate>${pubDate}</pubDate>
      ${image}
    </item>`;
  }).join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>${escapeXml(siteName)} — செய்திகள்</title>
    <link>${siteUrl}</link>
    <description>${escapeXml(rssDescription)}</description>
    <language>ta</language>
    <atom:link href="${siteUrl}/api/rss.xml" rel="self" type="application/rss+xml"/>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <ttl>30</ttl>
    <image>
      <url>${siteUrl}/favicon.svg</url>
      <title>${escapeXml(siteName)}</title>
      <link>${siteUrl}</link>
      <width>144</width>
      <height>144</height>
    </image>
    ${items}
  </channel>
</rss>`;

  res.setHeader("Content-Type", "application/rss+xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300");
  return res.send(xml);
});

// ── Atom 1.0 feed ─────────────────────────────────────────────────────────────
router.get("/atom.xml", async (_req, res) => {
  const { siteUrl, siteName, rssDescription } = await getSiteSettings();

  const { data: posts } = await getSupabase()
    .from("news_posts")
    .select("id, title, slug, excerpt, category, cover_image_url, published_at, created_at, updated_at")
    .eq("is_published", true)
    .order("published_at", { ascending: false })
    .limit(50);

  const updated = posts?.[0]
    ? new Date(posts[0].published_at ?? posts[0].created_at).toISOString()
    : new Date().toISOString();

  const entries = (posts ?? []).map((p) => {
    const url = `${siteUrl}/news/${p.slug}`;
    const pub = new Date(p.published_at ?? p.created_at).toISOString();
    const mod = new Date(p.updated_at ?? p.published_at ?? p.created_at).toISOString();
    const image = p.cover_image_url
      ? `\n    <link rel="enclosure" href="${escapeXml(p.cover_image_url)}" type="image/jpeg"/>`
      : "";
    return `  <entry>
    <title>${escapeXml(p.title)}</title>
    <link href="${escapeXml(url)}"/>
    <id>${escapeXml(url)}</id>
    <published>${pub}</published>
    <updated>${mod}</updated>
    <summary type="text">${escapeXml(p.excerpt ?? p.title)}</summary>
    <category term="${escapeXml(p.category)}"/>${image}
  </entry>`;
  }).join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="ta">
  <title>${escapeXml(siteName)} — செய்திகள்</title>
  <subtitle>${escapeXml(rssDescription)}</subtitle>
  <link href="${siteUrl}/api/atom.xml" rel="self" type="application/atom+xml"/>
  <link href="${siteUrl}/" rel="alternate" type="text/html"/>
  <id>${siteUrl}/</id>
  <updated>${updated}</updated>
  <rights>Copyright ${new Date().getFullYear()} ${escapeXml(siteName)}</rights>
  <icon>${siteUrl}/favicon.svg</icon>
  <logo>${siteUrl}/favicon.svg</logo>
  <author>
    <name>${escapeXml(siteName)}</name>
    <uri>${siteUrl}</uri>
  </author>
${entries}
</feed>`;

  res.setHeader("Content-Type", "application/atom+xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300");
  return res.send(xml);
});

export default router;
