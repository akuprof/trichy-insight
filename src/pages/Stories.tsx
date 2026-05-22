import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, ExternalLink, Loader2, Play } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

interface Story {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  cover_image_url: string | null;
  category: string | null;
  published_at: string | null;
}

const PLACEHOLDER_COLORS = [
  "from-red-900 to-slate-900",
  "from-indigo-900 to-slate-900",
  "from-emerald-900 to-slate-900",
  "from-amber-900 to-slate-900",
  "from-purple-900 to-slate-900",
];

const Stories = () => {
  const [stories, setStories] = useState<Story[]>([]);
  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(true);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const touchStartX = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/posts?limit=20`)
      .then(r => r.json())
      .then(data => {
        const posts: Story[] = (Array.isArray(data) ? data : (data.posts ?? [])).filter(
          (p: Story) => p.cover_image_url
        );
        setStories(posts.slice(0, 20));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const go = (dir: 1 | -1) => {
    setCurrent(c => Math.max(0, Math.min(stories.length - 1, c + dir)));
    resetTimer();
  };

  const resetTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCurrent(c => {
        if (c >= stories.length - 1) { clearInterval(timerRef.current!); return c; }
        return c + 1;
      });
    }, 5000);
  };

  useEffect(() => {
    if (stories.length > 0 && !paused) resetTimer();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [stories.length, paused]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stories.length]);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    setPaused(true);
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const delta = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(delta) > 40) go(delta > 0 ? 1 : -1);
    setPaused(false);
  };

  const story = stories[current];

  return (
    <div className="min-h-screen flex flex-col bg-black">
      <Navbar />

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-white/50" />
        </div>
      ) : stories.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-white/50 text-sm">
          கதைகள் இல்லை
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center py-4">

          {/* Header */}
          <div className="w-full max-w-lg px-4 mb-3 flex items-center justify-between">
            <div>
              <h1 className="font-heading text-white text-sm uppercase tracking-widest">
                Web Stories · வீடியோ கதைகள்
              </h1>
              <p className="text-white/40 text-xs mt-0.5">{stories.length} கதைகள்</p>
            </div>
            <Link to="/" className="text-white/40 hover:text-white text-xs flex items-center gap-1 transition-colors">
              <ArrowLeft className="h-3 w-3" /> முகப்பு
            </Link>
          </div>

          {/* Progress bars */}
          <div className="w-full max-w-lg px-4 mb-3 flex gap-1">
            {stories.map((_, i) => (
              <button
                key={i}
                onClick={() => { setCurrent(i); resetTimer(); }}
                className="flex-1 h-0.5 rounded-full overflow-hidden bg-white/20"
                aria-label={`Story ${i + 1}`}
              >
                <div
                  className={`h-full rounded-full transition-all duration-300 ${i < current ? "w-full bg-white" : i === current ? "bg-white/80" : "w-0 bg-white"}`}
                  style={i === current ? { animation: paused ? "none" : "storyProgress 5s linear forwards" } : undefined}
                />
              </button>
            ))}
          </div>

          {/* Story card */}
          <div
            ref={containerRef}
            className="relative w-full max-w-lg mx-4 rounded-2xl overflow-hidden"
            style={{ aspectRatio: "9/16", maxHeight: "70vh" }}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
            onClick={() => setPaused(p => !p)}
          >
            {/* Background image */}
            {story.cover_image_url ? (
              <img
                src={story.cover_image_url}
                alt={story.title}
                className="absolute inset-0 w-full h-full object-cover"
                draggable={false}
              />
            ) : (
              <div className={`absolute inset-0 bg-gradient-to-b ${PLACEHOLDER_COLORS[current % PLACEHOLDER_COLORS.length]}`} />
            )}

            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/20 to-black/20" />

            {/* Category badge */}
            {story.category && (
              <div className="absolute top-4 left-4">
                <span className="bg-red-600 text-white text-[11px] font-heading uppercase tracking-widest px-2 py-0.5 rounded">
                  {story.category}
                </span>
              </div>
            )}

            {/* Pause indicator */}
            {paused && (
              <div className="absolute top-4 right-4">
                <div className="bg-black/60 rounded-full p-2">
                  <Play className="h-3 w-3 text-white fill-white" />
                </div>
              </div>
            )}

            {/* Content */}
            <div className="absolute bottom-0 left-0 right-0 p-5">
              <h2 className="font-heading text-white text-xl leading-snug mb-2 line-clamp-3">
                {story.title}
              </h2>
              {story.excerpt && (
                <p className="text-white/70 text-sm leading-relaxed line-clamp-2 mb-4">
                  {story.excerpt}
                </p>
              )}
              <Link
                to={`/news/${story.slug}`}
                onClick={e => e.stopPropagation()}
                className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-xs font-heading uppercase tracking-widest px-4 py-2 rounded transition-colors"
              >
                முழுவதும் படிக்க
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>

            {/* Side nav */}
            <button
              onClick={e => { e.stopPropagation(); go(-1); }}
              disabled={current === 0}
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/70 disabled:opacity-20 rounded-full p-2 transition-all"
            >
              <ArrowLeft className="h-4 w-4 text-white" />
            </button>
            <button
              onClick={e => { e.stopPropagation(); go(1); }}
              disabled={current === stories.length - 1}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/70 disabled:opacity-20 rounded-full p-2 transition-all"
            >
              <ArrowRight className="h-4 w-4 text-white" />
            </button>
          </div>

          {/* Thumbnails strip */}
          <div className="w-full max-w-lg px-4 mt-3 flex gap-2 overflow-x-auto pb-1">
            {stories.map((s, i) => (
              <button
                key={s.id}
                onClick={() => { setCurrent(i); resetTimer(); }}
                className={`shrink-0 w-14 h-20 rounded-lg overflow-hidden border-2 transition-all ${i === current ? "border-red-500 scale-105" : "border-transparent opacity-60 hover:opacity-100"}`}
              >
                {s.cover_image_url ? (
                  <img src={s.cover_image_url} alt={s.title} className="w-full h-full object-cover" />
                ) : (
                  <div className={`w-full h-full bg-gradient-to-b ${PLACEHOLDER_COLORS[i % PLACEHOLDER_COLORS.length]}`} />
                )}
              </button>
            ))}
          </div>

        </div>
      )}

      <Footer />

      <style>{`
        @keyframes storyProgress {
          from { width: 0% }
          to   { width: 100% }
        }
      `}</style>
    </div>
  );
};

export default Stories;
