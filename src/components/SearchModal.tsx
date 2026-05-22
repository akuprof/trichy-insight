import { useEffect, useRef, useState } from "react";
import { Search, X, Clock, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface SearchResult {
  id: string;
  slug: string;
  title: string;
  category: string;
  published_at: string | null;
  cover_image_url: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

const SearchModal = ({ open, onClose }: Props) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [open]);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const q = query.trim();
    if (q.length < 2) { setResults([]); setLoading(false); return; }

    setLoading(true);
    timerRef.current = setTimeout(async () => {
      const { data } = await supabase
        .from("news_posts")
        .select("id,slug,title,category,published_at,cover_image_url")
        .eq("is_published", true)
        .ilike("title", `%${q}%`)
        .order("published_at", { ascending: false, nullsFirst: false })
        .limit(8);

      setResults((data as SearchResult[]) || []);
      setLoading(false);
    }, 300);
  }, [query]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex flex-col">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full bg-[#0F172A] border-b-2 border-[#DC2626] shadow-2xl">
        {/* Input row */}
        <div className="container mx-auto px-4 py-4 flex items-center gap-3">
          <Search className="h-5 w-5 text-[#DC2626] shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="செய்திகளை தேடுங்கள்… (Search news)"
            className="flex-1 bg-transparent text-white placeholder-slate-400 text-lg outline-none font-heading"
            autoComplete="off"
          />
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white transition-colors rounded"
            aria-label="Close search"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Results */}
        {query.trim().length >= 2 && (
          <div className="container mx-auto px-4 pb-4 max-h-[60vh] overflow-y-auto">
            {loading ? (
              <p className="text-slate-400 text-sm py-4">தேடுகிறது...</p>
            ) : results.length === 0 ? (
              <p className="text-slate-400 text-sm py-4">
                "{query}" க்கான செய்திகள் கிடைக்கவில்லை.
              </p>
            ) : (
              <div className="divide-y divide-white/10">
                {results.map((r) => (
                  <Link
                    key={r.id}
                    to={`/news/${r.slug}`}
                    onClick={onClose}
                    className="flex items-center gap-3 py-3 group hover:bg-white/5 -mx-2 px-2 rounded transition-colors"
                  >
                    {r.cover_image_url ? (
                      <img
                        src={r.cover_image_url}
                        alt={r.title}
                        className="w-14 h-10 object-cover rounded shrink-0 opacity-80"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-14 h-10 bg-slate-700 rounded shrink-0 flex items-center justify-center">
                        <Search className="h-4 w-4 text-slate-500" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <span className="text-[10px] text-[#DC2626] font-heading uppercase tracking-wider block">
                        {r.category}
                      </span>
                      <p className="text-sm text-white font-semibold leading-snug line-clamp-1 group-hover:text-[#DC2626] transition-colors">
                        {r.title}
                      </p>
                      {r.published_at && (
                        <span className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                          <Clock className="h-3 w-3" />
                          {new Date(r.published_at).toLocaleDateString("ta-IN")}
                        </span>
                      )}
                    </div>
                    <ArrowRight className="h-4 w-4 text-slate-600 group-hover:text-[#DC2626] transition-colors shrink-0" />
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchModal;
