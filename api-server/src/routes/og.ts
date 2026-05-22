import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const router = Router();

const SITE_URL = "https://trichyinsight.online";
const SITE_NAME = "Trichy Insight";
const DEFAULT_IMAGE =
  "https://storage.googleapis.com/gpt-engineer-file-uploads/RSBfbRIP0OfNtFacwoxs6KENmZl2/social-images/social-1773261542996-84B179D6-848E-4759-B7BF-E7E10ADFB753-removebg-preview.webp";

// Social media crawlers that need server-rendered OG tags
const BOT_UA =
  /WhatsApp|facebookexternalhit|Facebot|Twitterbot|TelegramBot|LinkedInBot|Slackbot|Discordbot|Googlebot|Google-InspectionTool|Chrome-Lighthouse|Lighthouse|bingbot|DuckDuckBot|Applebot|YandexBot|Baidu|crawler|spider|bot/i;

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function findIndexHtml(): string | null {
  const cwd = process.cwd();
  const candidates = [
    // Production: static/ (new output dir, not gitignored)
    path.join(cwd, "artifacts/trichy-insight/static/public/index.html"),
    path.join(cwd, "artifacts/trichy-insight/static/index.html"),
    // Production: dist/ (legacy)
    path.join(cwd, "artifacts/trichy-insight/dist/public/index.html"),
    path.join(cwd, "artifacts/trichy-insight/dist/index.html"),
    // Dev: cwd is artifacts/api-server
    path.resolve(cwd, "../../artifacts/trichy-insight/static/public/index.html"),
    path.resolve(cwd, "../../artifacts/trichy-insight/dist/public/index.html"),
    path.resolve(cwd, "../../artifacts/trichy-insight/dist/index.html"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

router.get("/news/:slug", async (req, res) => {
  const ua = req.headers["user-agent"] ?? "";
  const { slug } = req.params;
  const articleUrl = `${SITE_URL}/news/${slug}`;

  if (!BOT_UA.test(ua)) {
    if (process.env.NODE_ENV === "production") {
      // Production: serve the pre-built index.html — React Router handles the route client-side
      const indexPath = findIndexHtml();
      if (indexPath) return res.sendFile(indexPath);
      return res.redirect(302, "/");
    }
    // Dev: ALWAYS proxy to the Vite dev server — never serve the stale dist build,
    // because dist assets aren't served by Vite and cause 404s.
    try {
      const viteResp = await fetch(`http://localhost:5173/news/${req.params.slug}`);
      const body = await viteResp.text();
      const ct = viteResp.headers.get("content-type") ?? "text/html; charset=utf-8";
      res.setHeader("Content-Type", ct);
      return res.status(viteResp.status).send(body);
    } catch {
      return res.redirect(302, "/");
    }
  }

  // Social bot — fetch article data and return OG-rich HTML
  let data: Record<string, string> | null = null;
  try {
    const url = process.env.VITE_SUPABASE_URL || "";
    const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";
    if (!url || !key) throw new Error("Supabase env vars not set");
    const result = await createClient(url, key)
      .from("news_posts")
      .select("title, slug, excerpt, cover_image_url, category, published_at")
      .eq("slug", slug)
      .eq("is_published", true)
      .maybeSingle();
    data = result.data;
    if (result.error) {
      console.error("[og] Supabase error:", result.error.message);
    }
  } catch (err) {
    console.error("[og] Supabase threw:", err);
  }

  const title = data?.title ?? SITE_NAME;
  const description =
    data?.excerpt ??
    "திருச்சிராப்பள்ளி மாவட்டத்தின் நம்பகமான தமிழ் செய்தி தளம்.";
  const image = data?.cover_image_url ?? DEFAULT_IMAGE;
  const publishedAt = data?.published_at ?? new Date().toISOString();
  const category = data?.category ?? "News";

  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    "headline": title,
    "description": description,
    "image": [image],
    "datePublished": publishedAt,
    "dateModified": publishedAt,
    "author": { "@type": "Organization", "name": SITE_NAME, "url": SITE_URL },
    "publisher": {
      "@type": "Organization",
      "name": SITE_NAME,
      "url": SITE_URL,
      "logo": { "@type": "ImageObject", "url": `${SITE_URL}/favicon.svg` }
    },
    "mainEntityOfPage": { "@type": "WebPage", "@id": articleUrl },
    "articleSection": category,
    "inLanguage": "ta",
    "url": articleUrl,
  });

  const html = `<!DOCTYPE html>
<html lang="ta">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} | ${SITE_NAME}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
  <link rel="canonical" href="${articleUrl}" />

  <!-- Open Graph -->
  <meta property="og:type" content="article" />
  <meta property="og:site_name" content="${SITE_NAME}" />
  <meta property="og:url" content="${articleUrl}" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:image" content="${escapeHtml(image)}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:locale" content="ta_IN" />
  <meta property="article:published_time" content="${publishedAt}" />
  <meta property="article:section" content="${escapeHtml(category)}" />

  <!-- Twitter / X -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:site" content="@trichyinsight" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${escapeHtml(image)}" />

  <!-- JSON-LD structured data -->
  <script type="application/ld+json">${jsonLd}</script>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p>${escapeHtml(description)}</p>
  <a href="${articleUrl}">Read the full article on ${SITE_NAME}</a>
</body>
</html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300");
  return res.send(html);
});

export default router;
