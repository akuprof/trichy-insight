import { X, Bookmark, BookmarkX, Clock, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { useBookmarks } from "@/hooks/use-bookmarks";

interface Props {
  open: boolean;
  onClose: () => void;
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("ta-IN", { day: "numeric", month: "short" });

const BookmarksDrawer = ({ open, onClose }: Props) => {
  const { bookmarks, toggle, clear } = useBookmarks();

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed top-0 right-0 h-full w-full sm:w-96 z-[210] bg-[#0F172A] text-white shadow-2xl border-l border-white/10 flex flex-col transform transition-transform duration-300 ease-in-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Bookmark className="h-5 w-5 text-[#DC2626]" />
            <h2 className="font-heading uppercase tracking-wider text-sm">
              சேமித்த செய்திகள்
            </h2>
            {bookmarks.length > 0 && (
              <span className="bg-[#DC2626] text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full">
                {bookmarks.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {bookmarks.length > 0 && (
              <button
                onClick={clear}
                className="text-xs text-slate-400 hover:text-white transition-colors uppercase tracking-wider font-heading"
              >
                அனைத்தும் நீக்க
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {bookmarks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
              <Bookmark className="h-12 w-12 text-slate-700" />
              <p className="text-slate-400 text-sm leading-relaxed">
                நீங்கள் இன்னும் எந்த செய்தியையும் சேமிக்கவில்லை.
                <br />
                <span className="text-slate-500 text-xs">
                  செய்தி அட்டைகளில் ❤️ அழுத்தி சேமிக்கவும்.
                </span>
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-white/5">
              {bookmarks.map((b) => (
                <li key={b.id} className="flex gap-3 p-4 hover:bg-white/5 group transition-colors">
                  {b.cover_image_url && (
                    <img
                      src={b.cover_image_url}
                      alt={b.title}
                      className="w-16 h-14 object-cover shrink-0 rounded-sm opacity-80 group-hover:opacity-100 transition-opacity"
                      loading="lazy"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] text-[#DC2626] font-heading uppercase tracking-wider block mb-0.5">
                      {b.category}
                    </span>
                    <Link
                      to={`/news/${b.slug}`}
                      onClick={onClose}
                      className="text-sm text-white font-semibold leading-snug line-clamp-2 hover:text-[#DC2626] transition-colors block"
                    >
                      {b.title}
                    </Link>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="text-[10px] text-slate-500 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDate(b.savedAt)}
                      </span>
                      <Link
                        to={`/news/${b.slug}`}
                        onClick={onClose}
                        className="text-[10px] text-slate-500 hover:text-white flex items-center gap-1 transition-colors"
                      >
                        <ExternalLink className="h-3 w-3" /> படிக்க
                      </Link>
                    </div>
                  </div>
                  <button
                    onClick={() => toggle(b)}
                    className="p-1 text-slate-500 hover:text-[#DC2626] transition-colors shrink-0 mt-0.5"
                    aria-label="Remove bookmark"
                  >
                    <BookmarkX className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </>
  );
};

export default BookmarksDrawer;
