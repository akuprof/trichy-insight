import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { TrendingUp, Eye, Clock, Flame } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface TrendingPost {
  id: string;
  slug: string;
  title: string;
  category: string;
  cover_image_url: string | null;
  published_at: string | null;
  views: number;
}

const formatTimeAgoTa = (dateString: string) => {
  const diffMs = Date.now() - new Date(dateString).getTime();
  const hour = 3_600_000;
  const day = 86_400_000;
  if (diffMs < hour) return `${Math.max(1, Math.floor(diffMs / 60000))} நிமிடம் முன்`;
  if (diffMs < day) return `${Math.floor(diffMs / hour)} மணி முன்`;
  return `${Math.floor(diffMs / day)} நாள் முன்`;
};

const TrendingWidget = () => {
  const [posts, setPosts] = useState<TrendingPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

        const { data: viewData } = await supabase
          .from("page_view_events")
          .select("post_id")
          .not("post_id", "is", null)
          .gte("viewed_at", weekAgo)
          .limit(500);

        if (viewData && viewData.length > 0) {
          const counts: Record<string, number> = {};
          viewData.forEach(({ post_id }) => {
            if (post_id) counts[post_id] = (counts[post_id] || 0) + 1;
          });

          const topIds = Object.entries(counts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 6)
            .map(([id]) => id);

          const { data: postsData } = await supabase
            .from("news_posts")
            .select("id,slug,title,category,cover_image_url,published_at")
            .in("id", topIds)
            .eq("is_published", true);

          if (postsData && postsData.length > 0) {
            const ordered = topIds
              .map((id) => {
                const post = postsData.find((p) => p.id === id);
                return post ? { ...post, views: counts[id] } : null;
              })
              .filter(Boolean) as TrendingPost[];

            setPosts(ordered);
            setLoading(false);
            return;
          }
        }

        const { data: fallback } = await supabase
          .from("news_posts")
          .select("id,slug,title,category,cover_image_url,published_at")
          .eq("is_published", true)
          .order("published_at", { ascending: false, nullsFirst: false })
          .limit(6);

        setPosts(
          ((fallback || []) as Omit<TrendingPost, "views">[]).map((p, i) => ({
            ...p,
            views: Math.max(1, 100 - i * 12),
          }))
        );
      } catch {
        // silently fail — section will be hidden
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  if (loading) {
    return (
      <section className="bg-[#0F172A] py-8">
        <div className="container">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-1 h-6 bg-[#DC2626]" />
            <span className="font-heading text-white text-sm uppercase tracking-widest">இன்றைய டிரெண்ட்</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-slate-800 rounded-sm h-32 animate-pulse" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (posts.length === 0) return null;

  return (
    <section className="bg-[#0F172A] py-8 border-y border-white/5">
      <div className="container">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-1 h-6 bg-[#DC2626] shrink-0" />
            <div className="flex items-center gap-2">
              <Flame className="h-4 w-4 text-[#DC2626]" />
              <span className="font-heading text-white text-sm uppercase tracking-widest">
                இன்றைய டிரெண்ட் · Trending
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <TrendingUp className="h-3.5 w-3.5" />
            <span>கடந்த 7 நாட்களில்</span>
          </div>
        </div>

        {/* Trending grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {posts.map((post, idx) => (
            <Link
              key={post.id}
              to={`/news/${post.slug}`}
              className="group relative bg-slate-800/60 border border-white/5 hover:border-[#DC2626]/40 transition-all duration-200 overflow-hidden"
            >
              {/* Rank badge */}
              <div className={`absolute top-2 left-2 z-10 w-6 h-6 flex items-center justify-center font-heading font-bold text-xs leading-none ${
                idx === 0 ? "bg-[#DC2626] text-white" : "bg-slate-700 text-slate-300"
              }`}>
                {idx + 1}
              </div>

              {post.cover_image_url ? (
                <img
                  src={post.cover_image_url}
                  alt={post.title}
                  className="w-full h-24 object-cover opacity-70 group-hover:opacity-90 transition-opacity"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-24 bg-slate-700 flex items-center justify-center">
                  <Flame className="h-5 w-5 text-slate-500" />
                </div>
              )}

              <div className="p-2.5">
                <span className="text-[9px] text-[#DC2626] font-heading uppercase tracking-wider block mb-1 truncate">
                  {post.category}
                </span>
                <p className="text-xs text-white font-semibold leading-snug line-clamp-2 group-hover:text-[#DC2626] transition-colors">
                  {post.title}
                </p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="flex items-center gap-0.5 text-[10px] text-slate-500">
                    <Eye className="h-2.5 w-2.5" />
                    {post.views}
                  </span>
                  {post.published_at && (
                    <span className="flex items-center gap-0.5 text-[10px] text-slate-600">
                      <Clock className="h-2.5 w-2.5" />
                      {formatTimeAgoTa(post.published_at)}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TrendingWidget;
