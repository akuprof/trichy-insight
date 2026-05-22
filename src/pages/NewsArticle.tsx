import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Calendar, Clock, Heart, Share2, Tags, ThumbsUp } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ReadingProgressBar from "@/components/ReadingProgressBar";
import AdBanner from "@/components/AdBanner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

type NewsPost = Tables<"news_posts"> & {
  video_url?: string | null;
  meta_title?: string | null;
  meta_description?: string | null;
  meta_keywords?: string[] | null;
};

type Reaction = "like" | "insightful" | "support";

const REACTIONS: { type: Reaction; label: string; icon: React.ReactNode; activeColor: string }[] = [
  { type: "like", label: "பயனுள்ளது", icon: <ThumbsUp className="h-4 w-4" />, activeColor: "bg-blue-100 text-blue-700 border-blue-300" },
  { type: "insightful", label: "முக்கியமானது", icon: <Heart className="h-4 w-4" />, activeColor: "bg-red-100 text-red-700 border-red-300" },
  { type: "support", label: "ஆதரவு", icon: <Share2 className="h-4 w-4" />, activeColor: "bg-green-100 text-green-700 border-green-300" },
];

const ensureMetaTag = (attr: "name" | "property", key: string, value: string) => {
  let tag = document.head.querySelector(`meta[${attr}='${key}']`) as HTMLMetaElement | null;
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute(attr, key);
    document.head.appendChild(tag);
  }
  tag.content = value;
};

const ensureCanonical = (url: string) => {
  let link = document.head.querySelector("link[rel='canonical']") as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement("link");
    link.rel = "canonical";
    document.head.appendChild(link);
  }
  link.href = url;
};

const ensureHreflang = (lang: string, url: string) => {
  const id = `hreflang-${lang}`;
  let link = document.head.querySelector(`link[hreflang='${lang}']`) as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement("link");
    link.rel = "alternate";
    link.setAttribute("hreflang", lang);
    link.id = id;
    document.head.appendChild(link);
  }
  link.href = url;
};

const ensureJsonLd = (data: object) => {
  const id = "article-jsonld";
  let script = document.getElementById(id) as HTMLScriptElement | null;
  if (!script) {
    script = document.createElement("script");
    script.id = id;
    script.type = "application/ld+json";
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(data);
};

type SwgBasicHandler = {
  init: (config: {
    type: "NewsArticle";
    isPartOfType: ["Product"];
    isPartOfProductId: "CAowx7nGDA:openaccess";
    clientOptions: { theme: "light"; lang: "ta" };
  }) => void;
};

const COMMUNITY_ALERT_LINES = [
  "சாமானியனின் குரல் – உண்மையின் வெளிச்சம்",
  "உங்கள் பகுதியில் நடைபெறும் அநீதி, ஊழல் அல்லது சட்டவிரோத செயல்கள் குறித்து ஆதாரத்துடன் எங்களுக்கு தகவல் அனுப்புங்கள்.",
  "✔ தகவல்கள் முழுமையாக சரிபார்க்கப்பட்ட பிறகே செய்தியாக வெளியிடப்படும்.",
  "✔ தகவல் அளிப்பவரின் பெயர் மற்றும் தொடர்பு விபரங்கள் ரகசியமாக பாதுகாக்கப்படும்.",
];

const getReadingTime = (content: string): string => {
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  const mins = Math.max(1, Math.ceil(words / 200));
  return mins === 1 ? "1 நிமிடம்" : `${mins} நிமிடங்கள்`;
};

const REACTION_STORAGE_KEY = (slug: string) => `trichy_reactions_${slug}`;

const NewsArticle = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [post, setPost] = useState<NewsPost | null>(null);
  const [relatedPosts, setRelatedPosts] = useState<NewsPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeReactions, setActiveReactions] = useState<Set<Reaction>>(new Set());
  const [reactionCounts, setReactionCounts] = useState<Record<Reaction, number>>({ like: 0, insightful: 0, support: 0 });

  const readingTime = useMemo(() => (post ? getReadingTime(post.content) : ""), [post]);

  useEffect(() => {
    if (!slug) return;

    const loadPostAndRelated = async () => {
      const { data, error } = await supabase
        .from("news_posts")
        .select("*")
        .eq("slug", slug)
        .eq("is_published", true)
        .maybeSingle();

      if (error || !data) {
        toast({ title: "செய்தி கிடைக்கவில்லை", description: error?.message || "Invalid article slug", variant: "destructive" });
        navigate("/", { replace: true });
        setLoading(false);
        return;
      }

      const currentPost = data as NewsPost;
      setPost(currentPost);

      const { data: relatedData } = await supabase
        .from("news_posts")
        .select("id,title,slug,excerpt,cover_image_url,category,published_at,created_at")
        .eq("is_published", true)
        .eq("category", currentPost.category)
        .neq("id", currentPost.id)
        .order("published_at", { ascending: false, nullsFirst: false })
        .limit(4);

      let related = (relatedData as NewsPost[]) || [];

      if (related.length < 2) {
        const { data: fallback } = await supabase
          .from("news_posts")
          .select("id,title,slug,excerpt,cover_image_url,category,published_at,created_at")
          .eq("is_published", true)
          .neq("id", currentPost.id)
          .not("id", "in", `(${related.map((r) => r.id).join(",") || currentPost.id})`)
          .order("published_at", { ascending: false, nullsFirst: false })
          .limit(4 - related.length);
        related = [...related, ...((fallback as NewsPost[]) || [])];
      }

      setRelatedPosts(related);
      setLoading(false);

      void supabase.from("page_view_events").insert({
        path: window.location.pathname,
        post_id: currentPost.id,
        referrer: document.referrer || null,
        user_agent: navigator.userAgent || null,
        viewer_id: user?.id ?? null,
      });

      try {
        const stored = localStorage.getItem(REACTION_STORAGE_KEY(currentPost.slug));
        if (stored) {
          const parsed = JSON.parse(stored) as { active: Reaction[]; counts: Record<Reaction, number> };
          setActiveReactions(new Set(parsed.active));
          setReactionCounts(parsed.counts);
        }
      } catch {
      }
    };

    void loadPostAndRelated();
  }, [slug, navigate, toast, user?.id]);

  useEffect(() => {
    if (!post) return;

    const pageTitle = post.meta_title?.trim() || post.title;
    const pageDescription = post.meta_description?.trim() || post.excerpt || post.title;
    const canonical = `${window.location.origin}/news/${post.slug}`;
    const keywords = post.meta_keywords?.length ? post.meta_keywords.join(", ") : `${post.category}, Trichy Insight`;

    const datePublished = new Date(post.published_at ?? post.created_at).toISOString();
    const dateModified = new Date((post as Record<string, unknown>).updated_at as string ?? post.published_at ?? post.created_at).toISOString();

    document.title = `${pageTitle} | Trichy Insight`;
    ensureMetaTag("name", "description", pageDescription.slice(0, 160));
    ensureMetaTag("name", "keywords", keywords);
    ensureMetaTag("name", "robots", "index, follow");

    // Open Graph
    ensureMetaTag("property", "og:title", pageTitle);
    ensureMetaTag("property", "og:description", pageDescription.slice(0, 160));
    ensureMetaTag("property", "og:type", "article");
    ensureMetaTag("property", "og:url", canonical);
    ensureMetaTag("property", "og:site_name", "Trichy Insight");
    ensureMetaTag("property", "og:locale", "ta_IN");
    if (post.cover_image_url) ensureMetaTag("property", "og:image", post.cover_image_url);

    // Article timestamps
    ensureMetaTag("property", "article:published_time", datePublished);
    ensureMetaTag("property", "article:modified_time", dateModified);
    ensureMetaTag("property", "article:section", post.category);
    ensureMetaTag("property", "article:author", "Trichy Insight");

    // Twitter / X
    ensureMetaTag("name", "twitter:card", "summary_large_image");
    ensureMetaTag("name", "twitter:title", pageTitle);
    ensureMetaTag("name", "twitter:description", pageDescription.slice(0, 160));
    if (post.cover_image_url) ensureMetaTag("name", "twitter:image", post.cover_image_url);

    // Canonical + hreflang
    ensureCanonical(canonical);
    ensureHreflang("ta", canonical);
    ensureHreflang("x-default", canonical);

    // NewsArticle JSON-LD structured data
    ensureJsonLd({
      "@context": "https://schema.org",
      "@type": "NewsArticle",
      "headline": pageTitle.slice(0, 110),
      "description": pageDescription.slice(0, 160),
      "url": canonical,
      "datePublished": datePublished,
      "dateModified": dateModified,
      "inLanguage": "ta",
      "image": post.cover_image_url
        ? [{ "@type": "ImageObject", "url": post.cover_image_url }]
        : undefined,
      "author": [{ "@type": "Organization", "name": "Trichy Insight", "url": "https://trichyinsight.online" }],
      "publisher": {
        "@type": "NewsMediaOrganization",
        "name": "Trichy Insight",
        "url": "https://trichyinsight.online",
        "logo": {
          "@type": "ImageObject",
          "url": "https://trichyinsight.online/favicon.svg",
        },
      },
      "isAccessibleForFree": true,
      "keywords": keywords,
      "articleSection": post.category,
      "isPartOf": {
        "@type": ["CreativeWork", "Product"],
        "name": "Trichy Insight",
        "productID": "CAowx7nGDA:openaccess",
      },
    });
  }, [post]);

  useEffect(() => {
    if (!post) return;

    const swgGlobal = globalThis as typeof globalThis & {
      SWG_BASIC?: Array<(basicSubscriptions: SwgBasicHandler) => void>;
    };

    (swgGlobal.SWG_BASIC ??= []).push((basicSubscriptions) => {
      basicSubscriptions.init({
        type: "NewsArticle",
        isPartOfType: ["Product"],
        isPartOfProductId: "CAowx7nGDA:openaccess",
        clientOptions: { theme: "light", lang: "ta" },
      });
    });

    if (!import.meta.env.PROD || document.getElementById("swg-basic-script")) return;
    const script = document.createElement("script");
    script.id = "swg-basic-script";
    script.async = true;
    script.type = "application/javascript";
    script.src = "https://news.google.com/swg/js/v1/swg-basic.js";
    document.head.appendChild(script);
  }, [post]);

  const handleReaction = (type: Reaction) => {
    if (!post) return;
    setActiveReactions((prev) => {
      const next = new Set(prev);
      const nextCounts = { ...reactionCounts };
      if (next.has(type)) {
        next.delete(type);
        nextCounts[type] = Math.max(0, nextCounts[type] - 1);
      } else {
        next.add(type);
        nextCounts[type] = nextCounts[type] + 1;
      }
      setReactionCounts(nextCounts);
      try {
        localStorage.setItem(REACTION_STORAGE_KEY(post.slug), JSON.stringify({ active: [...next], counts: nextCounts }));
      } catch {
      }
      return next;
    });
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">செய்தி ஏற்றப்படுகிறது...</p>
      </main>
    );
  }

  if (!post) return null;

  const shareUrl = `${window.location.origin}/news/${post.slug}`;
  const shareTitle = `${post.title} | Trichy Insight`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast({ title: "லிங்க் நகலெடுக்கப்பட்டது" });
    } catch {
      toast({ title: "லிங்க் நகலெடுக்க முடியவில்லை", variant: "destructive" });
    }
  };

  const handleNativeShare = async () => {
    if (!navigator.share) { await handleCopyLink(); return; }
    try {
      await navigator.share({ title: shareTitle, text: post.excerpt || post.title, url: shareUrl });
    } catch {
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <ReadingProgressBar />
      <Navbar />
      <main className="container py-8 max-w-4xl mx-auto">
        <Button type="button" variant="outline" size="sm" onClick={() => navigate("/")}>
          <ArrowLeft className="h-4 w-4" /> முகப்புக்கு திரும்ப
        </Button>

        <article className="mt-6 space-y-6">
          <header className="space-y-4">
            <Badge variant="outline" className="text-primary border-primary font-heading uppercase tracking-wider">
              {post.category}
            </Badge>
            <h1 className="font-heading text-3xl md:text-4xl uppercase leading-tight">{post.title}</h1>
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                {new Date(post.published_at || post.created_at).toLocaleString("ta-IN")}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-4 w-4" />
                {readingTime} படிக்க
              </span>
              {(post.meta_keywords || []).slice(0, 3).length > 0 && (
                <span className="inline-flex items-center gap-1.5">
                  <Tags className="h-4 w-4" />
                  {(post.meta_keywords || []).slice(0, 3).join(", ")}
                </span>
              )}
            </div>
          </header>

          <Card className="border-border">
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" size="sm" variant="outline" onClick={handleNativeShare}>
                  <Share2 className="h-4 w-4" /> Share
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={handleCopyLink}>
                  Copy link
                </Button>
                <Button type="button" size="sm" variant="outline" asChild>
                  <a href={`https://wa.me/?text=${encodeURIComponent(`${shareTitle} ${shareUrl}`)}`} target="_blank" rel="noreferrer">
                    WhatsApp
                  </a>
                </Button>
                <Button type="button" size="sm" variant="outline" asChild>
                  <a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareTitle)}&url=${encodeURIComponent(shareUrl)}`} target="_blank" rel="noreferrer">
                    X
                  </a>
                </Button>
                <Button type="button" size="sm" variant="outline" asChild>
                  <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`} target="_blank" rel="noreferrer">
                    Facebook
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>

          <AdBanner slot="article_top" className="rounded border border-border overflow-hidden" />

          <Card>
            <CardContent className="p-0 overflow-hidden rounded-lg">
              {post.video_url ? (
                <video src={post.video_url} controls className="w-full max-h-[480px] object-cover" preload="metadata" />
              ) : (
                <img
                  src={post.cover_image_url || "/placeholder.svg"}
                  alt={post.title}
                  className="w-full max-h-[480px] object-cover"
                  loading="eager"
                  fetchPriority="high"
                  decoding="sync"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/placeholder.svg"; }}
                />
              )}
            </CardContent>
          </Card>

          <section className="space-y-5">
            {post.excerpt && (
              <p className="text-lg text-muted-foreground leading-8 font-medium border-l-4 border-primary pl-4">
                {post.excerpt}
              </p>
            )}
            {post.content.split("\n").filter(Boolean).map((paragraph, index) => (
              <p key={index} className="text-base leading-9 text-foreground">
                {paragraph}
              </p>
            ))}
          </section>

          <Separator />

          <Card className="bg-muted/30">
            <CardContent className="p-4">
              <p className="text-sm font-medium mb-3">இந்த செய்தி எப்படி இருந்தது?</p>
              <div className="flex flex-wrap gap-2">
                {REACTIONS.map(({ type, label, icon, activeColor }) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => handleReaction(type)}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium transition-all ${
                      activeReactions.has(type) ? activeColor : "bg-background text-muted-foreground border-border hover:bg-muted"
                    }`}
                  >
                    {icon}
                    {label}
                    {reactionCounts[type] > 0 && (
                      <span className="text-xs font-bold">{reactionCounts[type]}</span>
                    )}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/30 bg-muted/40">
            <CardContent className="space-y-2 p-4">
              {COMMUNITY_ALERT_LINES.map((line, index) => (
                <p
                  key={index}
                  className={index === 0 ? "font-heading text-base uppercase text-primary" : "text-sm leading-7 text-foreground"}
                >
                  {line}
                </p>
              ))}
            </CardContent>
          </Card>
        </article>

        <AdBanner slot="article_bottom" className="mt-6 rounded border border-border overflow-hidden" />

        {relatedPosts.length > 0 && (
          <section className="mt-10">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="font-heading text-xl uppercase flex items-center gap-2">
                  <span className="w-1 h-5 bg-primary rounded-full shrink-0" />
                  தொடர்புடைய செய்திகள்
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {relatedPosts.map((item) => (
                    <Link
                      key={item.id}
                      to={`/news/${item.slug}`}
                      className="flex flex-col border border-border rounded-lg overflow-hidden hover:border-primary/40 hover:shadow-sm transition-all group"
                    >
                      {item.cover_image_url ? (
                        <div className="relative h-36 overflow-hidden bg-muted shrink-0">
                          <img
                            src={item.cover_image_url}
                            alt={item.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                            decoding="async"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).parentElement!.style.display = "none";
                            }}
                          />
                          <span className="absolute top-2 left-2 bg-primary text-primary-foreground text-[10px] font-heading uppercase tracking-wider px-1.5 py-0.5 rounded">
                            {item.category}
                          </span>
                        </div>
                      ) : (
                        <div className="h-2 bg-primary/20 shrink-0" />
                      )}
                      <div className="p-3 min-w-0 flex flex-col gap-1">
                        {!item.cover_image_url && (
                          <p className="text-[10px] text-primary font-heading uppercase tracking-wider">{item.category}</p>
                        )}
                        <h3 className="font-heading text-sm uppercase leading-snug group-hover:text-primary transition-colors line-clamp-2">
                          {item.title}
                        </h3>
                        {item.excerpt && (
                          <p className="text-xs text-muted-foreground line-clamp-1">{item.excerpt}</p>
                        )}
                        <p className="text-[10px] text-muted-foreground mt-auto pt-1">
                          {new Date(item.published_at ?? item.created_at).toLocaleDateString("ta-IN", {
                            day: "numeric", month: "long", year: "numeric",
                          })}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          </section>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default NewsArticle;
