import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Layers, Clock, ArrowRight, Loader2 } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

interface Post {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  cover_image_url: string | null;
  category: string | null;
  published_at: string | null;
}

interface Category {
  name: string;
  count: number;
}

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

function timeAgo(iso: string | null) {
  if (!iso) return "";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 3600) return `${Math.floor(diff / 60)} நிமிடம் முன்பு`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} மணி முன்பு`;
  return `${Math.floor(diff / 86400)} நாள் முன்பு`;
}

const CATEGORY_COLORS: Record<string, string> = {
  "திருச்சி செய்திகள்": "bg-red-600",
  "அரசியல்": "bg-orange-600",
  "குடிமை": "bg-blue-600",
  "வணிகம்": "bg-emerald-600",
  "வீரம்": "bg-purple-600",
  "வைரல்": "bg-pink-600",
};

function getCategoryColor(cat: string) {
  return CATEGORY_COLORS[cat] ?? "bg-primary";
}

const PostCard = ({ post }: { post: Post }) => (
  <Link to={`/news/${post.slug}`} className="group flex gap-3 py-3 border-b border-muted-foreground/10 last:border-0 hover:bg-muted/30 px-2 -mx-2 rounded transition-colors">
    {post.cover_image_url && (
      <img
        src={post.cover_image_url}
        alt={post.title}
        className="w-20 h-14 object-cover rounded shrink-0"
      />
    )}
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium leading-snug line-clamp-2 group-hover:text-primary transition-colors">
        {post.title}
      </p>
      {post.published_at && (
        <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {timeAgo(post.published_at)}
        </p>
      )}
    </div>
  </Link>
);

const Categories = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedCategory = searchParams.get("cat") ?? null;

  const [categories, setCategories] = useState<Category[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetch(`${API_BASE}/api/categories`)
      .then(r => r.json())
      .then(d => {
        const cats: Category[] = (d.categories ?? []).filter((c: Category) => c.count > 0);
        setCategories(cats);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setPage(1);
    loadPosts(1, selectedCategory);
  }, [selectedCategory]);

  const loadPosts = async (p: number, cat: string | null) => {
    setLoadingPosts(true);
    const url = `${API_BASE}/api/posts?limit=12&page=${p}${cat ? `&category=${encodeURIComponent(cat)}` : ""}`;
    try {
      const r = await fetch(url);
      const d = await r.json();
      setPosts(p === 1 ? (d.posts ?? []) : prev => [...prev, ...(d.posts ?? [])]);
      setTotalPages(d.totalPages ?? 1);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingPosts(false);
    }
  };

  const handleLoadMore = () => {
    const next = page + 1;
    setPage(next);
    loadPosts(next, selectedCategory);
  };

  const topCategories = categories.slice(0, 12);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 container py-10 max-w-5xl">

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2 rounded-lg bg-primary/10">
            <Layers className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="font-heading text-2xl uppercase tracking-wide">
              {selectedCategory ?? "அனைத்து பிரிவுகளும்"}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {selectedCategory ? "பிரிவு செய்திகள்" : "Browse All Categories"}
            </p>
          </div>
        </div>

        {/* Category pills */}
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="flex flex-wrap gap-2 mb-8">
            <button
              onClick={() => setSearchParams({})}
              className={`text-xs font-heading uppercase tracking-wider px-4 py-2 rounded-full border transition-colors ${
                !selectedCategory
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-muted-foreground/20 text-muted-foreground hover:border-primary hover:text-primary"
              }`}
            >
              அனைத்தும்
            </button>
            {topCategories.map(cat => (
              <button
                key={cat.name}
                onClick={() => setSearchParams({ cat: cat.name })}
                className={`text-xs font-heading uppercase tracking-wider px-4 py-2 rounded-full border transition-colors ${
                  selectedCategory === cat.name
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-muted-foreground/20 text-muted-foreground hover:border-primary hover:text-primary"
                }`}
              >
                {cat.name}
                <span className="ml-1.5 opacity-60">({cat.count})</span>
              </button>
            ))}
          </div>
        )}

        {/* Category stats overview */}
        {!selectedCategory && !loading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-10">
            {topCategories.map(cat => (
              <button
                key={cat.name}
                onClick={() => setSearchParams({ cat: cat.name })}
                className="group text-left border border-muted-foreground/15 p-4 rounded-lg hover:border-primary/50 hover:bg-primary/5 transition-all"
              >
                <div className={`w-2 h-2 rounded-full mb-2 ${getCategoryColor(cat.name)}`} />
                <p className="font-heading text-sm uppercase tracking-wide line-clamp-1 group-hover:text-primary transition-colors">
                  {cat.name}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{cat.count} செய்திகள்</p>
                <div className="flex items-center gap-1 mt-2 text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-[10px] font-heading uppercase tracking-wider">பார்க்க</span>
                  <ArrowRight className="h-3 w-3" />
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Posts grid */}
        <div className="grid md:grid-cols-2 gap-x-8">
          <div>
            {posts.slice(0, Math.ceil(posts.length / 2)).map(p => <PostCard key={p.id} post={p} />)}
          </div>
          <div>
            {posts.slice(Math.ceil(posts.length / 2)).map(p => <PostCard key={p.id} post={p} />)}
          </div>
        </div>

        {loadingPosts && (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loadingPosts && page < totalPages && (
          <div className="flex justify-center mt-6">
            <button
              onClick={handleLoadMore}
              className="text-xs font-heading uppercase tracking-widest px-6 py-2.5 border border-primary text-primary hover:bg-primary hover:text-primary-foreground rounded transition-colors"
            >
              மேலும் ஏற்றுக →
            </button>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default Categories;
