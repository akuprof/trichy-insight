import { Router } from "express";
import { getSupabase } from "../lib/supabase";

const router = Router();

const TAMIL_RSS_SOURCES = [
  { name: "Dinamalar",         url: "https://www.dinamalar.com/rss/news.xml",                 category: "செய்திகள்" },
  { name: "Dinamani",          url: "https://www.dinamani.com/latest-news?rss=1",               category: "செய்திகள்" },
  { name: "OneIndia Tamil",    url: "https://tamil.oneindia.com/rss/tamil-news.xml",            category: "தேசியம்"   },
  { name: "Vikatan",           url: "https://www.vikatan.com/feed",                              category: "பொது"      },
  { name: "Puthiya Thalaimurai", url: "https://puthiyathalaimurai.com/feed/",                   category: "செய்திகள்" },
  { name: "Maalaimalar",       url: "https://www.maalaimalar.com/rss/news.xml",                 category: "செய்திகள்" },
  { name: "Tamil Murasu",      url: "https://www.tamilmurasu.com.sg/feed",                      category: "சர்வதேசம்" },
];

// ── Trichy hyper-local keyword sets ──────────────────────────────────────────

const TRICHY_PRIMARY = [
  "trichy", "tiruchirappalli", "திருச்சி", "திருச்சிராப்பள்ளி",
];

const TRICHY_AREAS = [
  "srirangam", "ஸ்ரீரங்கம்",
  "thillai nagar", "தில்லை நகர்",
  "chatram", "sathram", "சத்திரம்",
  "kk nagar", "kknagar", "கேகே நகர்",
  "woraiyur", "uraiyur", "வோராியூர்", "உறையூர்",
  "ponmalai", "போன்மலை",
  "airport", "விமான நிலையம்",
  "samayapuram", "சமயபுரம்",
  "ariyamangalam", "ஆரியமங்கலம்",
  "rockfort", "மலைக்கோட்டை",
  "palpannai", "பாலபன்னை",
  "cantonment", "கேண்டோன்மென்ட்",
];

// Category detection keyword sets (Tamil + English)
const CATEGORY_RULES: { keywords: string[]; category: string }[] = [
  {
    keywords: [
      "விபத்து", "accident", "விபத்தில்", "பலி", "மரணம்", "death", "killed",
      "injured", "காயம்", "காயமடைந்த", "crash", "மோதல்", "collision",
      "road accident", "பாதிக்கப்பட்ட", "உயிரிழந்த",
    ],
    category: "விபத்து",
  },
  {
    keywords: [
      "கைது", "arrest", "arrested", "குற்றம்", "crime", "murder", "கொலை",
      "திருட்டு", "theft", "robbery", "கொள்ளை", "police", "போலீஸ்",
      "FIR", "case filed", "வழக்கு", "நீதிமன்றம்", "court",
      "சிறை", "jail", "detention", "custody",
    ],
    category: "குற்றம்",
  },
  {
    keywords: [
      "minister", "அமைச்சர்", "govt", "government", "அரசு", "cm", "chief minister",
      "முதல்வர்", "mp", "mla", "மப", "எம்எல்ஏ", "election", "தேர்தல்",
      "party", "கட்சி", "bjp", "dmk", "aiadmk", "congress",
      "பாஜக", "திமுக", "அதிமுக", "president", "pm",
    ],
    category: "அரசியல்",
  },
  {
    keywords: [
      "breaking", "அவசரம்", "flash", "urgent", "alert", "emergency",
      "உடனடி", "சிறப்பு செய்தி", "latest update", "just in",
    ],
    category: "அவசரம்",
  },
];

// Sensitive content — flag for manual review
const SENSITIVE_KEYWORDS = [
  "communal", "riot", "religious violence", "மதக்கலவரம்", "caste violence",
  "சாதி வன்முறை", "மசூதி", "temple attack", "church attack", "mob lynching",
  "unverified", "rumour", "rumor", "fake", "hoax",
  "கும்பல் தாக்குதல்",
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractTag(xml: string, tag: string): string {
  const cdataMatch = new RegExp(`<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*<\\/${tag}>`, "i").exec(xml);
  if (cdataMatch) return cdataMatch[1].trim();
  const plain = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i").exec(xml);
  return plain ? plain[1].replace(/<[^>]+>/g, "").trim() : "";
}

interface RssItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  source: string;
  category: string;
}

function parseItems(xml: string, source: string, category: string): RssItem[] {
  const items: RssItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match: RegExpExecArray | null;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    items.push({
      title:       extractTag(block, "title"),
      link:        extractTag(block, "link"),
      description: extractTag(block, "description").slice(0, 500),
      pubDate:     extractTag(block, "pubDate"),
      source,
      category,
    });
  }
  return items.filter((i) => i.title && i.link);
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim()
    .slice(0, 80) + "-" + Date.now().toString(36);
}

/** Returns true if the item is Trichy-relevant */
function isTrichyRelevant(title: string, description: string): boolean {
  const haystack = (title + " " + description.slice(0, 200)).toLowerCase();
  const allKeywords = [...TRICHY_PRIMARY, ...TRICHY_AREAS];
  return allKeywords.some((kw) => haystack.includes(kw.toLowerCase()));
}

/** Auto-detects category from title + description */
function detectCategory(title: string, description: string): string {
  const haystack = (title + " " + description).toLowerCase();
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((kw) => haystack.includes(kw.toLowerCase()))) {
      return rule.category;
    }
  }
  return "பொது";
}

/** Returns true if content should be held for manual review */
function isSensitive(title: string, description: string): boolean {
  const haystack = (title + " " + description).toLowerCase();
  return SENSITIVE_KEYWORDS.some((kw) => haystack.includes(kw.toLowerCase()));
}

async function requireAuth(req: import("express").Request, res: import("express").Response): Promise<boolean> {
  const authHeader = req.headers["authorization"];
  const configuredSecret = process.env.AGGREGATOR_SECRET;

  if (configuredSecret) {
    const incomingSecret = req.headers["x-aggregator-secret"];
    if (incomingSecret !== configuredSecret) {
      res.status(401).json({ error: "Unauthorized — invalid aggregator secret" });
      return false;
    }
    return true;
  }

  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const { data: { user }, error } = await getSupabase().auth.getUser(token);
    if (error || !user) {
      res.status(401).json({ error: "Unauthorized — invalid session token" });
      return false;
    }
    return true;
  }

  console.warn("[aggregator] Request received without auth — set AGGREGATOR_SECRET env var");
  return true;
}

// ── Routes ───────────────────────────────────────────────────────────────────

router.get("/aggregator/sources", (_req, res) => {
  return res.json({ sources: TAMIL_RSS_SOURCES });
});

router.post("/aggregator/fetch", async (req, res) => {
  const authorized = await requireAuth(req, res);
  if (!authorized) return;

  const { sourceUrls, trichyOnly = true } = req.body as {
    sourceUrls?: string[];
    trichyOnly?: boolean;
  };

  const sourcesToFetch = sourceUrls
    ? TAMIL_RSS_SOURCES.filter((s) => sourceUrls.includes(s.url))
    : TAMIL_RSS_SOURCES;

  const results: {
    source: string;
    fetched: number;
    saved: number;
    filtered: number;
    held: number;
    errors: string[];
  }[] = [];

  for (const source of sourcesToFetch) {
    const result = {
      source: source.name,
      fetched: 0,
      saved: 0,
      filtered: 0,
      held: 0,
      errors: [] as string[],
    };

    try {
      const response = await fetch(source.url, {
        headers: { "User-Agent": "TrichyInsight-Aggregator/1.0" },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        result.errors.push(`HTTP ${response.status}`);
        results.push(result);
        continue;
      }

      const xml = await response.text();
      const items = parseItems(xml, source.name, source.category);
      result.fetched = items.length;

      for (const item of items.slice(0, 10)) {
        // 1. Trichy location filter
        if (trichyOnly && !isTrichyRelevant(item.title, item.description)) {
          result.filtered++;
          continue;
        }

        // 2. Duplicate check
        const { data: existing } = await getSupabase()
          .from("news_posts")
          .select("id")
          .ilike("title", `%${item.title.slice(0, 40)}%`)
          .limit(1);

        if (existing && existing.length > 0) continue;

        // 3. Category auto-detect
        const detectedCategory = detectCategory(item.title, item.description);

        // 4. Sensitive content flag
        const sensitive = isSensitive(item.title, item.description);
        const excerptPrefix = sensitive ? "⚠️ HOLD: " : "";

        const slug = slugify(item.title);

        const content = [
          `**மூலம்:** [${item.source}](${item.link})`,
          "",
          item.description || item.title,
          "",
          `*இந்த செய்தி ${item.source} இலிருந்து தொகுக்கப்பட்டது. [முழு செய்தி படிக்க இங்கே கிளிக் செய்யவும்](${item.link})*`,
        ].join("\n");

        const { error } = await getSupabase().from("news_posts").insert({
          title: item.title,
          slug,
          category: detectedCategory,
          excerpt: excerptPrefix + (item.description.slice(0, 200) || item.title),
          content,
          is_published: false,
          cover_image_url: null,
          meta_title: item.title,
          meta_description: item.description.slice(0, 160) || item.title,
        });

        if (error) {
          result.errors.push(error.message);
        } else {
          result.saved++;
          if (sensitive) result.held++;
        }
      }
    } catch (err) {
      result.errors.push(String(err));
    }
    results.push(result);
  }

  const totalSaved = results.reduce((s, r) => s + r.saved, 0);
  const totalFiltered = results.reduce((s, r) => s + r.filtered, 0);
  const totalHeld = results.reduce((s, r) => s + r.held, 0);

  console.log(`[aggregator] trichyOnly=${trichyOnly} saved=${totalSaved} filtered=${totalFiltered} held=${totalHeld}`);

  return res.json({ ok: true, totalSaved, totalFiltered, totalHeld, results });
});

export default router;
