import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Bookmark, Clock, ChevronRight, Share2 } from "lucide-react";
import NewsCard from "./NewsCard";
import AdBanner from "./AdBanner";
import strayDogs from "@/assets/stray-dogs-uraiyur.png";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useToast } from "@/hooks/use-toast";
import { useBookmarks } from "@/hooks/use-bookmarks";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

type NewsPost = Tables<"news_posts"> & { video_url?: string | null };

const PAGE_SIZE = 12;

const CATEGORY_TABS = [
  { id: "all", label: "அனைத்தும்" },
  { id: "திருச்சி", label: "செய்திகள்" },
  { id: "குடிமை", label: "குடிமை" },
  { id: "அரசியல்", label: "அரசியல்" },
  { id: "வைரல்", label: "வைரல்" },
  { id: "வணிகம்", label: "வணிகம்" },
];

const estimateReadMins = (text: string): string => {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const mins = Math.max(1, Math.ceil((words * 5) / 200));
  return `${mins} நிமிட வாசிப்பு`;
};

const formatTimeAgoTa = (dateString: string) => {
  const diffMs = Date.now() - new Date(dateString).getTime();
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diffMs < hour) return `${Math.max(1, Math.floor(diffMs / minute))} நிமிடம் முன்பு`;
  if (diffMs < day) return `${Math.floor(diffMs / hour)} மணி முன்பு`;
  return `${Math.floor(diffMs / day)} நாள் முன்பு`;
};

const shareToWhatsApp = (title: string, slug: string) => {
  const url = `${window.location.origin}/news/${slug}`;
  window.open(`https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`, "_blank");
};

const LatestNews = () => {
  const { toast } = useToast();
  const { toggle, isBookmarked } = useBookmarks();
  const [posts, setPosts] = useState<NewsPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const sentinelRef = useRef<HTMLDivElement>(null);

  const fetchPublishedPosts = useCallback(async ({
    offset,
    append,
    category,
  }: {
    offset: number;
    append: boolean;
    category: string;
  }) => {
    let query = supabase
      .from("news_posts")
      .select("id,slug,title,excerpt,category,published_at,created_at,cover_image_url,video_url")
      .eq("is_published", true)
      .order("published_at", { ascending: false, nullsFirst: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (category !== "all") {
      query = query.ilike("category", `%${category}%`);
    }

    const { data, error } = await query;

    if (error) {
      toast({ title: "செய்திகள் ஏற்ற முடியவில்லை", description: error.message, variant: "destructive" });
      return;
    }

    const nextPosts = (data as NewsPost[]) || [];
    setPosts((prev) => (append ? [...prev, ...nextPosts] : nextPosts));
    setHasMore(nextPosts.length === PAGE_SIZE);
  }, [toast]);

  useEffect(() => {
    setLoading(true);
    setPosts([]);
    setHasMore(true);
    fetchPublishedPosts({ offset: 0, append: false, category: selectedCategory })
      .then(() => setLoading(false));
  }, [selectedCategory, fetchPublishedPosts]);

  const handleLoadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    await fetchPublishedPosts({ offset: posts.length, append: true, category: selectedCategory });
    setLoadingMore(false);
  }, [loadingMore, hasMore, posts.length, fetchPublishedPosts, selectedCategory]);

  // Infinite scroll sentinel
  useEffect(() => {
    if (!hasMore || loading) return;
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) void handleLoadMore();
      },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loading, handleLoadMore]);

  const mappedItems = useMemo(
    () =>
      posts.map((post, index) => ({
        id: post.id,
        slug: post.slug,
        category: post.category,
        title: post.title,
        excerpt: post.excerpt || "",
        time: formatTimeAgoTa(post.published_at || post.created_at),
        views: "—",
        imageUrl: post.cover_image_url || (!post.video_url && index === 0 ? strayDogs : undefined),
        videoUrl: post.video_url || undefined,
        link: `/news/${post.slug}`,
      })),
    [posts],
  );

  const featured   = mappedItems.slice(0, 2);
  const sidebarA   = mappedItems.slice(2, 8);
  const gridRow1   = mappedItems.slice(8, 14);
  const gridRow2   = mappedItems.slice(14, 20);
  const miniGrid   = mappedItems.slice(20, 28);
  const tickerList = mappedItems.slice(28);

  const isFiltered = selectedCategory !== "all";

  return (
    <section id="latest" className="container py-10 space-y-6">

      {/* Section header */}
      <div className="flex items-center justify-between pb-3 border-b-2 border-slate-200">
        <div className="flex items-center gap-3">
          <div className="h-8 w-1.5 bg-[#DC2626]" />
          <div>
            <h2 className="font-heading text-2xl sm:text-3xl uppercase text-[#0F172A]">
              சமீபத்திய செய்திகள்
            </h2>
            <p className="text-xs text-muted-foreground uppercase tracking-widest mt-0.5">Latest News</p>
          </div>
        </div>
        <a href="#latest" className="text-xs font-heading uppercase tracking-wider text-[#DC2626] hover:underline hidden sm:block">
          அனைத்தும் பார்க்க →
        </a>
      </div>

      {/* Category filter tabs */}
      <div className="flex items-center gap-1 flex-wrap">
        {CATEGORY_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSelectedCategory(tab.id)}
            className={`px-3.5 py-1.5 text-xs font-heading uppercase tracking-wider transition-all border ${
              selectedCategory === tab.id
                ? "bg-[#DC2626] text-white border-[#DC2626]"
                : "bg-transparent text-slate-600 border-slate-200 hover:border-[#DC2626] hover:text-[#DC2626]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:col-span-2">
              {[0, 1].map((i) => (
                <div key={i} className="border border-border bg-card overflow-hidden">
                  <Skeleton className="w-full h-44" />
                  <div className="p-3 space-y-2">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-4/5" />
                    <Skeleton className="h-3 w-24 mt-1" />
                  </div>
                </div>
              ))}
            </div>
            <div className="border border-border bg-card">
              <Skeleton className="h-9 w-full rounded-none" />
              <div className="divide-y divide-border">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex gap-3 p-3">
                    <Skeleton className="w-16 h-12 shrink-0" />
                    <div className="flex-1 space-y-1.5 py-0.5">
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-3/4" />
                      <Skeleton className="h-2.5 w-16 mt-1" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="border border-border bg-card overflow-hidden">
                <Skeleton className="w-full h-28" />
                <div className="p-2.5 space-y-1.5">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-2.5 w-16 mt-1" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : mappedItems.length === 0 ? (
        <div className="border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          <p className="mb-2">
            {isFiltered
              ? `"${CATEGORY_TABS.find((t) => t.id === selectedCategory)?.label}" பிரிவில் செய்திகள் இல்லை.`
              : "வெளியிடப்பட்ட செய்திகள் இன்னும் இல்லை."}
          </p>
          {isFiltered && (
            <button
              onClick={() => setSelectedCategory("all")}
              className="text-[#DC2626] hover:underline text-xs font-heading uppercase"
            >
              அனைத்து செய்திகளும் பார்க்க →
            </button>
          )}
        </div>
      ) : isFiltered ? (
        /* ── FILTERED VIEW: flat 3-col grid ────────────────────────── */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {mappedItems.map((item) => (
            <div key={item.id} className="group relative flex flex-col border border-border bg-card hover:border-[#DC2626]/50 hover:shadow-sm transition-all">
              {/* Bookmark + Share hover actions */}
              <div className="absolute top-2 right-2 z-10 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => { e.preventDefault(); toggle({ id: item.id, slug: item.slug, title: item.title, category: item.category, cover_image_url: item.imageUrl || null, excerpt: item.excerpt }); }}
                  className={`p-1.5 rounded-full shadow-md transition-colors ${isBookmarked(item.id) ? "bg-[#DC2626] text-white" : "bg-white text-slate-600 hover:text-[#DC2626]"}`}
                  aria-label="Bookmark"
                >
                  <Bookmark className="h-3.5 w-3.5" fill={isBookmarked(item.id) ? "currentColor" : "none"} />
                </button>
                <button
                  onClick={(e) => { e.preventDefault(); shareToWhatsApp(item.title, item.slug); }}
                  className="p-1.5 rounded-full bg-white text-slate-600 hover:text-green-600 shadow-md transition-colors"
                  aria-label="Share on WhatsApp"
                >
                  <Share2 className="h-3.5 w-3.5" />
                </button>
              </div>

              <Link to={item.link} className="flex flex-col flex-1">
                {item.imageUrl ? (
                  <div className="overflow-hidden">
                    <img src={item.imageUrl} alt={item.title} className="w-full h-40 object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" decoding="async" width={400} height={160} />
                  </div>
                ) : (
                  <div className="w-full h-40 bg-muted flex items-center justify-center shrink-0">
                    <span className="text-xs text-muted-foreground">படம் இல்லை</span>
                  </div>
                )}
                <div className="p-3 flex flex-col flex-1">
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 self-start mb-1.5 font-heading uppercase">
                    {item.category.slice(0, 20)}
                  </Badge>
                  <p className="text-sm font-semibold leading-snug line-clamp-3 group-hover:text-primary transition-colors flex-1">{item.title}</p>
                  {item.excerpt && <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">{item.excerpt}</p>}
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> {item.time}</span>
                    {item.excerpt && <span className="text-[10px] text-[#DC2626] font-heading uppercase tracking-wider">{estimateReadMins(item.excerpt)}</span>}
                  </div>
                </div>
              </Link>
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* ══ ZONE 1: Hero + Sidebar ═══════════════════════════════════ */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:col-span-2">
              {featured.map((item, i) => (
                <NewsCard key={i} {...item} featured />
              ))}
            </div>
            <div className="border border-border bg-card">
              <h3 className="px-4 py-2.5 border-b border-border font-heading text-xs uppercase tracking-wider text-primary bg-muted/40">
                சமீபத்திய
              </h3>
              <div className="divide-y divide-border">
                {sidebarA.map((item) => (
                  <Link key={item.id} to={item.link} className="flex gap-3 p-3 hover:bg-muted/30 transition-colors group">
                    {item.imageUrl && (
                      <img src={item.imageUrl} alt={item.title} className="w-16 h-12 object-cover shrink-0" loading="lazy" decoding="async" width={64} height={48} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                    )}
                    <div className="min-w-0">
                      <p className="text-xs text-primary font-heading uppercase leading-none mb-1 truncate">{item.category}</p>
                      <p className="text-sm font-medium leading-snug line-clamp-2 group-hover:text-primary transition-colors">{item.title}</p>
                      <span className="text-xs text-muted-foreground flex items-center gap-1 mt-1"><Clock className="h-3 w-3" /> {item.time}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* AD */}
          <AdBanner slot="homepage_mid" className="w-full rounded overflow-hidden border border-border" />

          {/* ══ ZONE 2: 3-column grid with bookmarks + share ════════════ */}
          {gridRow1.length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="h-5 w-0.5 bg-primary" />
                <h3 className="font-heading text-sm uppercase tracking-wider">மேலும் செய்திகள்</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {[...gridRow1, ...gridRow2].map((item) => (
                  <div key={item.id} className="group relative flex flex-col border border-border bg-card hover:border-primary/50 hover:shadow-sm transition-all">
                    {/* Hover action buttons */}
                    <div className="absolute top-2 right-2 z-10 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => { e.preventDefault(); toggle({ id: item.id, slug: item.slug, title: item.title, category: item.category, cover_image_url: item.imageUrl || null, excerpt: item.excerpt }); }}
                        className={`p-1.5 rounded-full shadow-md transition-colors ${isBookmarked(item.id) ? "bg-[#DC2626] text-white" : "bg-white text-slate-600 hover:text-[#DC2626]"}`}
                        aria-label="Bookmark"
                      >
                        <Bookmark className="h-3.5 w-3.5" fill={isBookmarked(item.id) ? "currentColor" : "none"} />
                      </button>
                      <button
                        onClick={(e) => { e.preventDefault(); shareToWhatsApp(item.title, item.slug); }}
                        className="p-1.5 rounded-full bg-white text-slate-600 hover:text-green-600 shadow-md transition-colors"
                        aria-label="WhatsApp share"
                      >
                        <Share2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <Link to={item.link} className="flex flex-col flex-1">
                      {item.imageUrl ? (
                        <div className="overflow-hidden">
                          <img src={item.imageUrl} alt={item.title} className="w-full h-40 object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" decoding="async" width={400} height={160} onError={(e) => { (e.currentTarget as HTMLImageElement).closest("div")!.remove(); }} />
                        </div>
                      ) : (
                        <div className="w-full h-40 bg-muted flex items-center justify-center shrink-0">
                          <span className="text-xs text-muted-foreground">படம் இல்லை</span>
                        </div>
                      )}
                      <div className="p-3 flex flex-col flex-1">
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 self-start mb-1.5 font-heading uppercase">
                          {item.category.slice(0, 20)}
                        </Badge>
                        <p className="text-sm font-semibold leading-snug line-clamp-3 group-hover:text-primary transition-colors flex-1">{item.title}</p>
                        {item.excerpt && <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">{item.excerpt}</p>}
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> {item.time}</span>
                          {item.excerpt && <span className="text-[10px] text-[#DC2626] font-heading uppercase tracking-wider">{estimateReadMins(item.excerpt)}</span>}
                        </div>
                      </div>
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ══ ZONE 3: 4-column mini grid ══════════════════════════════ */}
          {miniGrid.length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="h-5 w-0.5 bg-primary" />
                <h3 className="font-heading text-sm uppercase tracking-wider text-muted-foreground">தொடர்ச்சியான செய்திகள்</h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {miniGrid.map((item) => (
                  <Link key={item.id} to={item.link} className="group flex flex-col border border-border bg-card hover:border-primary/50 transition-all">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.title} className="w-full h-28 object-cover" loading="lazy" decoding="async" width={200} height={112} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                    ) : (
                      <div className="w-full h-28 bg-muted" />
                    )}
                    <div className="p-2 flex-1 flex flex-col gap-1">
                      <span className="text-[10px] text-primary font-heading uppercase truncate">{item.category.slice(0, 16)}</span>
                      <p className="text-xs font-semibold leading-snug line-clamp-3 group-hover:text-primary transition-colors">{item.title}</p>
                      <span className="text-[10px] text-muted-foreground mt-auto">{item.time}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* ══ ZONE 4: Compact ticker list ══════════════════════════════ */}
          {tickerList.length > 0 && (
            <div className="border border-border bg-card">
              <h3 className="px-4 py-2.5 border-b border-border font-heading text-xs uppercase tracking-wider text-primary bg-muted/40">
                அனைத்து செய்திகள்
              </h3>
              <div className="divide-y divide-border">
                {tickerList.map((item) => (
                  <Link key={item.id} to={item.link} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors group">
                    {item.imageUrl && <img src={item.imageUrl} alt={item.title} className="w-14 h-10 object-cover shrink-0 hidden sm:block" loading="lazy" />}
                    <span className="text-xs text-primary font-heading uppercase shrink-0 w-20 truncate hidden md:block">{item.category.split("/")[0].trim()}</span>
                    <span className="text-sm font-medium flex-1 line-clamp-1 group-hover:text-primary transition-colors">{item.title}</span>
                    <span className="text-xs text-muted-foreground shrink-0 flex items-center gap-1"><Clock className="h-3 w-3" /> {item.time}</span>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0 hidden sm:block" />
                  </Link>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Infinite scroll sentinel */}
      <div ref={sentinelRef} className="h-4" />
      {loadingMore && (
        <div className="flex justify-center py-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="w-4 h-4 border-2 border-[#DC2626] border-t-transparent rounded-full animate-spin" />
            மேலும் செய்திகள் ஏற்றப்படுகின்றன...
          </div>
        </div>
      )}
    </section>
  );
};

export default LatestNews;
