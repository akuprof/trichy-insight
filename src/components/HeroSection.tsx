import { Clock, ChevronRight, Play, BookOpen } from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import heroBanner from "@/assets/hero-banner.png";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type NewsPost = Pick<Tables<"news_posts">, "id" | "slug" | "title" | "excerpt" | "category" | "published_at" | "created_at" | "cover_image_url">;

const formatTimeAgoTa = (dateString: string) => {
  const diffMs = Date.now() - new Date(dateString).getTime();
  const hour = 3_600_000;
  const day = 86_400_000;
  if (diffMs < hour) return `${Math.max(1, Math.floor(diffMs / 60000))} நிமிடம் முன்பு`;
  if (diffMs < day) return `${Math.floor(diffMs / hour)} மணி முன்பு`;
  return `${Math.floor(diffMs / day)} நாள் முன்பு`;
};

const CATEGORY_COLORS: Record<string, string> = {
  civic: "#3B82F6",
  political: "#8B5CF6",
  viral: "#DC2626",
  business: "#10B981",
};

function getCatColor(cat: string) {
  return CATEGORY_COLORS[cat] ?? "#DC2626";
}

const HeroSection = () => {
  const [featuredPost, setFeaturedPost] = useState<NewsPost | null>(null);
  const [sidePosts, setSidePosts] = useState<NewsPost[]>([]);
  const [storyPosts, setStoryPosts] = useState<NewsPost[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase
      .from("news_posts")
      .select("id,slug,title,excerpt,category,published_at,created_at,cover_image_url")
      .eq("is_published", true)
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(14)
      .then(({ data }) => {
        if (data && data.length > 0) {
          setFeaturedPost(data[0] as NewsPost);
          setSidePosts((data as NewsPost[]).slice(1, 4));
          setStoryPosts((data as NewsPost[]).slice(4, 14));
        }
      });
  }, []);

  const scroll = (dir: "left" | "right") => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({ left: dir === "left" ? -320 : 320, behavior: "smooth" });
  };

  return (
    <section>
      {/* ── Full-width Hero ─────────────────────────── */}
      <div className="relative h-[62vh] min-h-[480px] w-full bg-slate-900 overflow-hidden">
        <img
          src={featuredPost?.cover_image_url || heroBanner}
          alt="Hero"
          className="absolute inset-0 w-full h-full object-cover object-center opacity-60"
          style={{ objectPosition: "center 70%" }}
          fetchPriority="high"
          loading="eager"
          decoding="sync"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0F172A] via-[#0F172A]/70 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#DC2626]/60 to-transparent mix-blend-multiply" />

        <div className="relative h-full container mx-auto px-4 flex flex-col justify-end pb-12 sm:pb-16">
          <div className="max-w-3xl">
            <span className="inline-block bg-[#DC2626] text-white text-[11px] font-bold px-3 py-1 mb-4 uppercase tracking-widest">
              Breaking News
            </span>
            <h1
              className="font-heading text-white leading-tight mb-4 uppercase"
              style={{ fontSize: "clamp(1.6rem, 4.5vw, 3.25rem)", lineHeight: 1.08 }}
            >
              {featuredPost?.title || "உண்மையை நேராக கேட்கும் திருச்சி டிஜிட்டல் குரல்"}
            </h1>
            {featuredPost?.excerpt && (
              <p className="text-slate-200 text-sm sm:text-base leading-relaxed mb-6 max-w-2xl hidden sm:block line-clamp-2">
                {featuredPost.excerpt}
              </p>
            )}
            <div className="flex items-center gap-4 text-sm text-slate-300 mb-6">
              <span className="font-semibold text-white">Trichy Insight Desk</span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {featuredPost
                  ? formatTimeAgoTa(featuredPost.published_at || featuredPost.created_at)
                  : "இப்போது"}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {featuredPost ? (
                <Link
                  to={`/news/${featuredPost.slug}`}
                  className="inline-flex items-center gap-2 bg-[#DC2626] hover:bg-red-700 text-white px-5 py-2.5 font-heading uppercase tracking-wider text-sm font-bold transition-all active:scale-95"
                >
                  <Play className="h-4 w-4 fill-current" /> முழுமையாக படிக்க
                </Link>
              ) : (
                <a
                  href="#latest"
                  className="inline-flex items-center gap-2 bg-[#DC2626] hover:bg-red-700 text-white px-5 py-2.5 font-heading uppercase tracking-wider text-sm font-bold transition-all active:scale-95"
                >
                  <Play className="h-4 w-4 fill-current" /> சமீபத்தியதை பார்க்க
                </a>
              )}
              <Link
                to="/auth"
                className="inline-flex items-center gap-2 border border-white/30 text-white hover:border-[#DC2626] hover:text-[#DC2626] px-5 py-2.5 font-heading uppercase tracking-wider text-sm font-bold transition-all active:scale-95"
              >
                பதிவு செய்ய <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ── Side stories strip ───────────────────────── */}
      {sidePosts.length > 0 && (
        <div className="bg-[#0F172A] border-b border-white/5">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-white/10">
              {sidePosts.map((post) => (
                <Link
                  key={post.id}
                  to={`/news/${post.slug}`}
                  className="flex items-start gap-3 p-4 hover:bg-white/5 transition-colors group"
                >
                  {post.cover_image_url && (
                    <img
                      src={post.cover_image_url}
                      alt={post.title}
                      className="w-16 h-14 object-cover shrink-0 rounded-sm opacity-80 group-hover:opacity-100 transition-opacity"
                      loading="lazy"
                    />
                  )}
                  <div className="min-w-0">
                    <span className="text-[10px] text-[#DC2626] font-heading uppercase tracking-wider block mb-1">
                      {post.category}
                    </span>
                    <p className="text-white text-sm font-semibold leading-snug line-clamp-2 group-hover:text-[#DC2626] transition-colors">
                      {post.title}
                    </p>
                    <span className="text-slate-500 text-xs flex items-center gap-1 mt-1">
                      <Clock className="h-3 w-3" />
                      {formatTimeAgoTa(post.published_at || post.created_at)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Web Stories Showcase ─────────────────────── */}
      {storyPosts.length > 0 && (
        <div className="bg-[#060D1A] py-4 border-b border-white/5">
          <div className="container mx-auto px-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-[#DC2626]" />
                <span className="text-white font-heading font-bold text-sm uppercase tracking-widest">
                  Web Stories
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-sm bg-[#DC2626] text-white uppercase tracking-wide">
                  Live
                </span>
              </div>
              <Link
                to="/stories"
                className="text-xs text-slate-400 hover:text-[#DC2626] font-heading uppercase tracking-wider flex items-center gap-1 transition-colors"
              >
                அனைத்தும் <ChevronRight className="h-3 w-3" />
              </Link>
            </div>

            {/* Scroll wrapper */}
            <div className="relative group/strip">
              {/* Left arrow */}
              <button
                onClick={() => scroll("left")}
                aria-label="Scroll left"
                className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 z-10 w-7 h-7 rounded-full bg-[#0F172A] border border-white/10 text-white flex items-center justify-center opacity-0 group-hover/strip:opacity-100 transition-opacity hover:bg-[#DC2626] hover:border-[#DC2626]"
              >
                <ChevronRight className="h-4 w-4 rotate-180" />
              </button>

              {/* Story cards */}
              <div
                ref={scrollRef}
                className="flex gap-3 overflow-x-auto pb-1 scroll-smooth"
                style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
              >
                {storyPosts.map((post, i) => (
                  <Link
                    key={post.id}
                    to={`/news/${post.slug}`}
                    className="group/card flex-shrink-0 relative rounded-xl overflow-hidden cursor-pointer select-none"
                    style={{
                      width: "120px",
                      height: "190px",
                      background: "#1e293b",
                      boxShadow: "0 0 0 2px #DC2626, 0 0 0 4px #060D1A",
                    }}
                  >
                    {/* Background image */}
                    {post.cover_image_url ? (
                      <img
                        src={post.cover_image_url}
                        alt={post.title}
                        loading="lazy"
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover/card:scale-110"
                      />
                    ) : (
                      <div
                        className="absolute inset-0"
                        style={{
                          background: `linear-gradient(135deg, ${getCatColor(post.category)}, #0F172A)`,
                        }}
                      />
                    )}

                    {/* Gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />

                    {/* Progress bar (decorative) */}
                    <div className="absolute top-0 left-0 right-0 flex gap-0.5 p-1.5">
                      {storyPosts.slice(0, Math.min(storyPosts.length, 5)).map((_, j) => (
                        <div
                          key={j}
                          className="h-[2px] flex-1 rounded-full"
                          style={{
                            background: j === i % 5 ? "#DC2626" : "rgba(255,255,255,0.3)",
                          }}
                        />
                      ))}
                    </div>

                    {/* Category chip */}
                    <div className="absolute top-5 left-1.5 right-1.5">
                      <span
                        className="text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-sm text-white"
                        style={{ background: getCatColor(post.category) }}
                      >
                        {post.category}
                      </span>
                    </div>

                    {/* Title */}
                    <div className="absolute bottom-0 left-0 right-0 p-2">
                      <p className="text-white text-[11px] font-semibold leading-tight line-clamp-3 font-heading">
                        {post.title}
                      </p>
                      <p className="text-white/50 text-[9px] mt-1">
                        {formatTimeAgoTa(post.published_at || post.created_at)}
                      </p>
                    </div>

                    {/* Hover play indicator */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/card:opacity-100 transition-opacity">
                      <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30">
                        <Play className="h-3 w-3 text-white fill-current ml-0.5" />
                      </div>
                    </div>
                  </Link>
                ))}

                {/* View All card */}
                <Link
                  to="/stories"
                  className="flex-shrink-0 rounded-xl overflow-hidden flex flex-col items-center justify-center gap-2 border border-white/10 hover:border-[#DC2626]/60 transition-colors"
                  style={{ width: "120px", height: "190px", background: "#0F172A" }}
                >
                  <div className="w-10 h-10 rounded-full border-2 border-[#DC2626] flex items-center justify-center">
                    <ChevronRight className="h-5 w-5 text-[#DC2626]" />
                  </div>
                  <span className="text-white text-[10px] font-heading font-bold uppercase tracking-wider text-center px-2">
                    அனைத்தும் பார்க்க
                  </span>
                </Link>
              </div>

              {/* Right arrow */}
              <button
                onClick={() => scroll("right")}
                aria-label="Scroll right"
                className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 z-10 w-7 h-7 rounded-full bg-[#0F172A] border border-white/10 text-white flex items-center justify-center opacity-0 group-hover/strip:opacity-100 transition-opacity hover:bg-[#DC2626] hover:border-[#DC2626]"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default HeroSection;
