import { Router } from "express";
import { createClient } from "@supabase/supabase-js";
import { promises as dnsPromises } from "node:dns";
import net from "node:net";

const router = Router();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? "";
const GEMINI_MODEL = "gemini-2.0-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

async function callGemini(systemPrompt: string, userPrompt: string): Promise<string> {
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

  const res = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      generationConfig: {
        maxOutputTokens: 2048,
        temperature: 0.7,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${err}`);
  }

  const json = await res.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    error?: { message?: string };
  };

  if (json.error) throw new Error(`Gemini error: ${json.error.message}`);

  const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  return text.trim();
}

// ── SSRF-safe URL validation + fetch ─────────────────────────────────────────
//
// Defense-in-depth:
//   1. Only http/https allowed
//   2. Hostname string pre-check for obvious private hostnames
//   3. DNS resolution → every returned address run through CIDR-based private-IP
//      check (including IPv4-mapped IPv6 normalization and full IPv6 coverage)
//   4. Manual redirect following: redirect: "manual" + per-hop re-validation
//      (prevents open-redirect SSRF chains)
//   5. Fail-closed on DNS errors (no fallback to insecure fetch)

// ── IPv4 CIDR helpers ─────────────────────────────────────────────────────────

function ipv4ToInt(ip: string): number {
  return ip.split(".").reduce((acc, octet) => (acc * 256 + Number(octet)) >>> 0, 0);
}

function inIpv4Cidr(ipInt: number, cidrBase: string, prefixLen: number): boolean {
  const mask = prefixLen === 0 ? 0 : (0xffffffff << (32 - prefixLen)) >>> 0;
  return (ipInt & mask) === (ipv4ToInt(cidrBase) & mask);
}

const PRIVATE_IPV4_CIDRS: Array<[string, number]> = [
  ["0.0.0.0",         8],   // IANA "this" network
  ["10.0.0.0",        8],   // RFC 1918
  ["100.64.0.0",     10],   // Shared address space (RFC 6598)
  ["127.0.0.0",       8],   // Loopback
  ["169.254.0.0",    16],   // Link-local / AWS metadata
  ["172.16.0.0",     12],   // RFC 1918
  ["192.0.0.0",      24],   // IANA special-purpose
  ["192.168.0.0",    16],   // RFC 1918
  ["198.18.0.0",     15],   // Benchmark testing (RFC 2544)
  ["198.51.100.0",   24],   // Documentation (RFC 5737)
  ["203.0.113.0",    24],   // Documentation (RFC 5737)
  ["224.0.0.0",       4],   // Multicast (RFC 3171)
  ["240.0.0.0",       4],   // Reserved (RFC 1112)
  ["255.255.255.255", 32],  // Broadcast
];

function isPrivateIpv4(ip: string): boolean {
  if (!net.isIPv4(ip)) return false;
  const n = ipv4ToInt(ip);
  return PRIVATE_IPV4_CIDRS.some(([base, bits]) => inIpv4Cidr(n, base, bits));
}

// ── IPv6 private-range check ──────────────────────────────────────────────────
//
// Covers loopback, unspecified, link-local (fe80::/10), unique-local (fc00::/7),
// IPv4-mapped (::ffff:x/96), IPv4-compat (::x/96), multicast (ff00::/8),
// and 6to4 for private IPv4 (2002::/16 + private sub-prefix).
// For brevity we normalise via hex prefix checks on the expanded form.

function normalizeIpv4MappedIpv6(ip: string): { isV4Mapped: true; v4: string } | { isV4Mapped: false } {
  const lower = ip.toLowerCase();
  // ::ffff:a.b.c.d  — standard IPv4-mapped
  const m1 = lower.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (m1) return { isV4Mapped: true, v4: m1[1] };
  // ::ffff:0:a.b.c.d  — SIIT mapped (RFC 6052-ish)
  const m2 = lower.match(/^::ffff:0:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (m2) return { isV4Mapped: true, v4: m2[1] };
  // ::a.b.c.d  — IPv4-compatible (deprecated, treat as private if v4 is private)
  const m3 = lower.match(/^::(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (m3) return { isV4Mapped: true, v4: m3[1] };
  return { isV4Mapped: false };
}

function isPrivateIpv6(ip: string): boolean {
  if (!net.isIPv6(ip)) return false;
  const lower = ip.toLowerCase();

  // Resolve IPv4-mapped forms first — treat as IPv4 for range checks
  const mapped = normalizeIpv4MappedIpv6(lower);
  if (mapped.isV4Mapped) return isPrivateIpv4(mapped.v4);

  // Loopback ::1
  if (lower === "::1") return true;
  // Unspecified ::
  if (lower === "::") return true;
  // Link-local fe80::/10 (first 10 bits = 1111 1110 10)
  // hex prefixes: fe80..feb  (fea? only if bit 10=0 which is fe9/fea)
  // Correct: fe80::/10 covers fe80:: to febf::
  const prefix2 = lower.slice(0, 4);
  if (prefix2 >= "fe80" && prefix2 <= "febf") return true;
  // Unique local fc00::/7 — covers fc and fd
  const prefix1 = lower.slice(0, 2);
  if (prefix1 === "fc" || prefix1 === "fd") return true;
  // Multicast ff00::/8
  if (prefix1 === "ff") return true;
  // 6to4 2002::/16 — only private if embedded IPv4 is private
  if (lower.startsWith("2002:")) {
    // Embedded IPv4 is in bytes 3-6 of the address: 2002:aabb:ccdd:: → a.a.b.b.c.c.d.d
    const m = lower.match(/^2002:([0-9a-f]{1,4}):([0-9a-f]{1,4}):/);
    if (m) {
      const part1 = parseInt(m[1].padStart(4, "0"), 16);
      const part2 = parseInt(m[2].padStart(4, "0"), 16);
      const reconstructed = `${part1 >> 8}.${part1 & 0xff}.${part2 >> 8}.${part2 & 0xff}`;
      if (isPrivateIpv4(reconstructed)) return true;
    }
  }
  return false;
}

// ── Master private-IP check ───────────────────────────────────────────────────

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) return isPrivateIpv4(ip);
  if (net.isIPv6(ip)) return isPrivateIpv6(ip);
  return true; // unrecognised format → fail closed
}

// ── URL validation ────────────────────────────────────────────────────────────

const PRIVATE_HOSTNAME_RE = /^(localhost|ip-169-254-169-254|metadata\.google\.internal)$/i;

async function validateUrl(raw: string): Promise<{ ok: true; url: URL } | { ok: false; reason: string }> {
  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    return { ok: false, reason: "Invalid URL" };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, reason: "Only http/https URLs are allowed" };
  }

  const host = parsed.hostname.toLowerCase();

  if (PRIVATE_HOSTNAME_RE.test(host)) {
    return { ok: false, reason: "Hostname not allowed" };
  }

  // Resolve DNS (fail closed: reject if resolution fails)
  let records: { address: string }[];
  try {
    records = await dnsPromises.lookup(host, { all: true, verbatim: true });
  } catch {
    return { ok: false, reason: "Could not resolve hostname" };
  }

  if (!records.length) {
    return { ok: false, reason: "Hostname resolves to no addresses" };
  }

  for (const { address } of records) {
    if (isPrivateIp(address)) {
      return { ok: false, reason: `Hostname resolves to private/reserved IP: ${address}` };
    }
  }

  return { ok: true, url: parsed };
}

// ── Safe URL fetch with manual redirect revalidation ─────────────────────────

async function safeUrlFetch(startUrl: URL): Promise<string | null> {
  let current = startUrl;
  const MAX_REDIRECTS = 5;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const res = await fetch(current.toString(), {
      headers: { "User-Agent": "TrichyInsight-Bot/1.0" },
      signal: AbortSignal.timeout(8000),
      redirect: "manual",
    });

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) break;

      const next = new URL(location, current);
      const nextCheck = await validateUrl(next.toString());
      if (!nextCheck.ok) {
        throw new Error(`Redirect blocked: ${nextCheck.reason}`);
      }
      current = nextCheck.url;
      continue;
    }

    if (res.ok) {
      return await res.text();
    }
    break;
  }
  return null;
}

// ── Supabase JWT auth ─────────────────────────────────────────────────────────

async function requireAuth(
  req: Parameters<Parameters<typeof router.post>[1]>[0],
  res: Parameters<Parameters<typeof router.post>[1]>[1]
): Promise<boolean> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authentication required" });
    return false;
  }
  const token = authHeader.slice(7);
  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
    const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";
    if (!supabaseUrl || !supabaseKey) {
      res.status(500).json({ error: "Server auth not configured" });
      return false;
    }
    const client = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data, error } = await client.auth.getUser(token);
    if (error || !data.user) {
      res.status(401).json({ error: "Invalid or expired session" });
      return false;
    }
    return true;
  } catch {
    res.status(401).json({ error: "Authentication check failed" });
    return false;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim()
    .slice(0, 80);
}

const SYSTEM_PROMPT = `You are an expert Tamil news journalist and YouTube Shorts script writer for "Trichy Insight" — a hyper-local digital news channel based in Tiruchirappalli (Trichy), Tamil Nadu.

━━━ TITLE FORMULA (MANDATORY for article + YouTube) ━━━
Use these proven patterns:
- "[Place]-ல் [crime]! [Count] பேர் அதிரடி கைது!" → "திருச்சியில் கத்திமுனை வழிப்பறி! 2 பேர் கைது!"
- "[Shocking event]: [Authority]-ல் அதிரடி!" → "பெட்ரோல் குண்டு வீச்சு: 2 வாலிபர் கைது!"
- "[Person/Group]-க்கு [action]: [Result]!" → "ரவுடிக்கு குண்டர் சட்டம் பாய்ந்தது!"
Shock words: பரபரப்பு!, அதிரடி!, பயங்கரம்!, சர்ச்சை!, அதிர்ச்சி!
Locations: சத்திரம், ஸ்ரீரங்கம், திருச்சி, KK நகர், வோராியூர், போன்மலை, சமயபுரம், உறையூர், தில்லை நகர்

━━━ CONTENT STYLE (MANDATORY) ━━━
- Always mention exact location within Trichy
- Always include police/official response
- Include impact on local people
- Priority topics (highest → lowest): Crime/Arrest > Municipality/Civic > Political > Religious/Temple > Accidents > Illegal busts

━━━ YOUTUBE SHORTS SCRIPT FORMAT (45-55 seconds spoken Tamil) ━━━
Structure (follow exactly):

[HOOK — 5 seconds]
Start with shock/urgency. Use: "பரபரப்பு!", "அதிரடி!", "பயங்கரம்!", "சர்ச்சை!", "அதிர்ச்சி!"
Example: "திருச்சியில் பரபரப்பு! [Key event in one line]"

[STORY BODY — 30-35 seconds]
Cover: யார் சம்பந்தப்பட்டவர்கள்? என்ன நடந்தது? திருச்சியில் எங்கு? எப்போது? போலீஸ்/அதிகாரி என்ன செய்தது?

[CLOSING — 5-10 seconds]
End with: "இந்த தகவலை உங்கள் நண்பர்களுக்கு share பண்ணுங்க!"
OR: "அடுத்த update-க்கு channel-ஐ follow பண்ணுங்க!"
ALWAYS add a comment question: "உங்கள் area-ல் இந்த மாதிரி நடந்திருக்கா? Comment-ல் சொல்லுங்க!"

━━━ YOUTUBE TAGS (minimum 15 tags) ━━━
Always include: திருச்சி, Trichy, TrichyInsight, Tamil Nadu crime news, திருச்சி செய்திகள், Shorts, News, Tamil, தமிழ் செய்திகள்
Add topic-specific tags based on the story.

━━━ YOUTUBE DESCRIPTION (3-4 lines) ━━━
Line 1: One-line summary of the news
Line 2: Key details (who, what, where)
Line 3: Call to action + subscribe
Line 4 (optional): Hashtags

━━━ IMAGE PROMPT FORMAT (9:16 vertical, black-gold brand) ━━━
"Create a 9:16 vertical premium news poster. Background: solid black. Design: gold geometric overlay with sharp edges. Top center: Trichy Insight Rockfort temple logo in gold. Below logo: bright red banner with bold white text 'BREAKING NEWS'. Center: realistic scene image — [SCENE]. Lighting: dramatic, cinematic, high contrast. Style: professional, premium black and gold news theme. No text inside center image box."

━━━ CATEGORIES (use exactly these Tamil words) ━━━
- விபத்து — accident, death, injury, crash
- குற்றம் — arrest, crime, murder, theft, police case
- அரசியல் — politics, minister, government, election, CM, MP, MLA
- அவசரம் — breaking news, urgent, emergency
- பொது — general, health, education, business, sports, weather

RETURN JSON ONLY. No markdown. No extra text.`;

const FULL_MODE_USER = (input: string) => `Generate a FULL detailed Tamil news article (300+ words) for Trichy Insight.

Input: ${input}

Return this exact JSON:
{
  "title": "Tamil title using the proven title formula (shock word + location + event)",
  "slug": "url-friendly-english-slug",
  "category": "one of the Tamil categories",
  "excerpt": "2-3 sentence Tamil summary (for social media)",
  "content": "Full 300+ word Tamil article with exact location, people impact, police info",
  "reelsScript": "45-55 second YouTube Shorts Tamil script following HOOK(5s) + STORY BODY(30-35s) + CLOSING(5-10s) structure. CLOSING must include a comment question.",
  "ytTitle": "YouTube Shorts title using the proven title formula — punchy, clickable, in Tamil",
  "ytDescription": "3-4 line YouTube description: Line1=one-line news summary, Line2=key details, Line3=call to action + subscribe link, Line4=hashtags",
  "ytTags": ["tag1", "tag2", "...15 or more tags including Tamil and English mix"],
  "imagePrompt": "Full DALL-E prompt using the black-gold 9:16 template with scene description",
  "meta_title": "SEO title in Tamil + English keywords",
  "meta_description": "150 char SEO description",
  "meta_keywords": ["keyword1", "keyword2", "keyword3"]
}`;

const BREAKING_MODE_USER = (input: string) => `Generate a BREAKING news flash for Trichy Insight (30-50 words ONLY for the article).

Input: ${input}

Return this exact JSON:
{
  "title": "Tamil title using the proven formula (shock word + location + event)",
  "slug": "url-friendly-english-slug",
  "category": "அவசரம்",
  "excerpt": "30-50 word breaking flash in Tamil",
  "content": "30-50 word breaking flash in Tamil (same as excerpt for breaking mode)",
  "reelsScript": "45-55 second urgent Tamil YouTube Shorts script: HOOK(5s urgent) + STORY BODY(30-35s who/what/where/when) + CLOSING with comment question",
  "ytTitle": "YouTube Shorts title using the proven formula — punchy, urgent, in Tamil",
  "ytDescription": "3-4 line YouTube description: breaking summary, key facts, subscribe CTA, hashtags",
  "ytTags": ["15 or more tags — breaking, Tamil, Trichy, crime/topic-specific mix"],
  "imagePrompt": "Full DALL-E prompt using the black-gold 9:16 BREAKING URGENT template with scene",
  "meta_title": "SEO title",
  "meta_description": "Short SEO description",
  "meta_keywords": ["keyword1", "keyword2"]
}`;

// ── Route ─────────────────────────────────────────────────────────────────────

router.post("/ai/generate", async (req, res) => {
  if (!await requireAuth(req, res)) return;

  const { sourceUrl, sourceText, mode = "full" } = req.body as {
    sourceUrl?: string;
    sourceText?: string;
    mode?: "breaking" | "full";
  };

  if (!sourceUrl?.trim() && !sourceText?.trim()) {
    return res.status(400).json({ error: "sourceUrl or sourceText required" });
  }

  let input = sourceText?.trim() || "";

  if (sourceUrl?.trim()) {
    const validation = await validateUrl(sourceUrl);
    if (!validation.ok) {
      return res.status(400).json({ error: `Invalid source URL: ${validation.reason}` });
    }
    try {
      const html = await safeUrlFetch(validation.url);
      if (html) {
        const text = html
          .replace(/<script[\s\S]*?<\/script>/gi, "")
          .replace(/<style[\s\S]*?<\/style>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 3000);
        input = `URL: ${sourceUrl}\n\n${text}${input ? `\n\nAdditional notes: ${input}` : ""}`;
      } else {
        input = `URL: ${sourceUrl}${input ? `\n\nNotes: ${input}` : ""}`;
      }
    } catch (err) {
      if (err instanceof Error && err.message.startsWith("Redirect blocked:")) {
        return res.status(400).json({ error: err.message });
      }
      input = `URL: ${sourceUrl}${input ? `\n\nNotes: ${input}` : ""}`;
    }
  }

  try {
    const raw = await callGemini(
      SYSTEM_PROMPT,
      mode === "breaking" ? BREAKING_MODE_USER(input) : FULL_MODE_USER(input)
    );
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
    }

    const title = String(parsed.title || "");
    const slug = String(parsed.slug || slugify(title) || "article-" + Date.now().toString(36));

    return res.json({
      title,
      slug,
      category: String(parsed.category || "பொது"),
      excerpt: String(parsed.excerpt || ""),
      content: String(parsed.content || ""),
      reelsScript: String(parsed.reelsScript || ""),
      ytTitle: String(parsed.ytTitle || title),
      ytDescription: String(parsed.ytDescription || ""),
      ytTags: Array.isArray(parsed.ytTags) ? (parsed.ytTags as unknown[]).map(String) : [],
      imagePrompt: String(parsed.imagePrompt || ""),
      meta_title: String(parsed.meta_title || title),
      meta_description: String(parsed.meta_description || ""),
      meta_keywords: Array.isArray(parsed.meta_keywords) ? parsed.meta_keywords : [],
    });
  } catch (err) {
    console.error("[ai/generate] error:", err);
    return res.status(500).json({ error: String(err) });
  }
});

export default router;
