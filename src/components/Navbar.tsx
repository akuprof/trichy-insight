import { useEffect, useState } from "react";
import { Bookmark, MapPin, Menu, Search, X, Zap } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import logo from "@/assets/logo.png";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import SearchModal from "@/components/SearchModal";
import BookmarksDrawer from "@/components/BookmarksDrawer";
import { useBookmarks } from "@/hooks/use-bookmarks";
import PushNotificationButton from "@/components/PushNotificationButton";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";

const FALLBACK_TICKER = [
  "திருச்சி மாநகராட்சி சாலை பணிகள் தொடக்கம்",
  "புதிய பேருந்து நிலையம் திறப்பு விழா",
  "தண்ணீர் பிரச்சனை: மக்கள் போராட்டம்",
  "உள்ளாட்சி தேர்தல் அறிவிப்பு எதிர்பார்ப்பு",
];

const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [bookmarksOpen, setBookmarksOpen] = useState(false);
  const [tickerItems, setTickerItems] = useState<string[]>(FALLBACK_TICKER);
  const { bookmarks } = useBookmarks();
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const location = useLocation();
  const { settings } = useSiteSettings();

  const navLinks = [
    { label: "முகப்பு", href: "/" },
    { label: "செய்திகள்", href: "#latest" },
    ...settings.categories.map(c => ({ label: c.label.split(" ")[0], href: `#${c.id}` })),
  ];

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    supabase
      .from("news_posts")
      .select("title")
      .eq("is_published", true)
      .order("published_at", { ascending: false })
      .limit(8)
      .then(({ data }) => {
        if (data && data.length > 0) {
          const headlines = data.map((p) => p.title);
          setTickerItems([...FALLBACK_TICKER.slice(0, 2), ...headlines]);
        }
      });
  }, []);

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  const handleLogout = async () => {
    await signOut();
    toast({ title: "வெற்றிகரமாக வெளியேறினீர்கள்" });
    setMobileOpen(false);
  };

  const pc = settings.primary_color;
  const siteName = settings.site_name;
  const [nameFirst, ...nameRest] = siteName.split(" ");

  return (
    <header className="sticky top-0 z-50">
      {/* Breaking news ticker */}
      <div className="bg-primary text-primary-foreground">
        <div className="flex items-center h-8">
          <div className="flex items-center gap-1.5 bg-black/30 px-3 h-full shrink-0 border-r border-white/20">
            <Zap className="h-3 w-3 fill-current animate-breaking-pulse" />
            <span className="font-heading text-[11px] font-bold uppercase tracking-widest hidden sm:inline">
              அவசர
            </span>
          </div>
          <div className="news-ticker-wrap">
            <div className="news-ticker-track text-xs sm:text-[13px] py-0">
              {tickerItems.map((item, i) => (
                <span key={`a-${i}`} className="px-6">
                  <span className="text-yellow-300 mr-2 text-[10px]">◆</span>
                  {item}
                </span>
              ))}
              {tickerItems.map((item, i) => (
                <span key={`b-${i}`} className="px-6">
                  <span className="text-yellow-300 mr-2 text-[10px]">◆</span>
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main nav */}
      <nav className={`bg-[#0F172A] text-white border-b-4 transition-shadow duration-200 ${scrolled ? "shadow-xl shadow-black/40" : ""}`}
        style={{ borderColor: pc }}>
        <div className="container flex items-center justify-between py-3 gap-4">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 shrink-0 group">
            {settings.logo_url ? (
              <img src={settings.logo_url} alt={siteName}
                className="h-9 w-auto transition-transform group-hover:scale-105"
                onError={e => { e.currentTarget.style.display = "none"; }} />
            ) : (
              <img src={logo} alt={siteName}
                className="h-9 w-auto transition-transform group-hover:scale-105" />
            )}
            <div>
              <div className="font-heading text-base sm:text-lg font-bold leading-none tracking-wide uppercase text-white">
                {nameFirst}{" "}
                {nameRest.length > 0 && <span style={{ color: pc }}>{nameRest.join(" ")}</span>}
              </div>
              <div className="text-[10px] text-slate-400 leading-none mt-0.5 flex items-center gap-1">
                <MapPin className="h-2.5 w-2.5" />
                {settings.location}
              </div>
            </div>
          </Link>

          {/* Desktop nav links */}
          <div className="hidden lg:flex items-center gap-6 text-xs font-heading uppercase tracking-wider">
            {navLinks.map((link) => (
              <a key={link.href} href={link.href}
                className="relative py-1 text-slate-300 transition-colors after:absolute after:bottom-0 after:left-0 after:w-0 after:h-0.5 after:transition-all hover:after:w-full"
                style={{ ["--tw-text-opacity" as string]: 1 }}
                onMouseEnter={e => (e.currentTarget.style.color = pc)}
                onMouseLeave={e => (e.currentTarget.style.color = "")}>
                {link.label}
              </a>
            ))}
            <Link to="/stories"
              className="relative py-1 text-slate-300 transition-colors"
              onMouseEnter={e => (e.currentTarget.style.color = pc)}
              onMouseLeave={e => (e.currentTarget.style.color = "")}>
              வீடியோ கதைகள்
            </Link>
            <Link to="/tools"
              className="relative py-1 text-slate-300 transition-colors"
              onMouseEnter={e => (e.currentTarget.style.color = pc)}
              onMouseLeave={e => (e.currentTarget.style.color = "")}>
              கருவிகள்
            </Link>
          </div>

          {/* Desktop right */}
          <div className="hidden lg:flex items-center gap-3">
            <button onClick={() => setSearchOpen(true)}
              className="text-slate-300 hover:text-white transition-colors p-1" aria-label="Search">
              <Search className="h-4 w-4" />
            </button>
            <button onClick={() => setBookmarksOpen(true)}
              className="relative text-slate-300 hover:text-white transition-colors p-1" aria-label="Bookmarks">
              <Bookmark className="h-4 w-4" />
              {bookmarks.length > 0 && (
                <span className="absolute -top-1 -right-1 text-white text-[9px] font-bold w-4 h-4 flex items-center justify-center rounded-full"
                  style={{ backgroundColor: pc }}>
                  {bookmarks.length > 9 ? "9+" : bookmarks.length}
                </span>
              )}
            </button>
            <PushNotificationButton className="text-slate-300 hover:text-white" />
            {user ? (
              <>
                <Link to="/admin"
                  className="text-xs font-heading uppercase tracking-wider text-slate-400 transition-colors"
                  onMouseEnter={e => (e.currentTarget.style.color = pc)}
                  onMouseLeave={e => (e.currentTarget.style.color = "")}>
                  Admin
                </Link>
                <button onClick={handleLogout}
                  className="text-xs font-heading uppercase tracking-wider text-slate-400 transition-colors"
                  onMouseEnter={e => (e.currentTarget.style.color = pc)}
                  onMouseLeave={e => (e.currentTarget.style.color = "")}>
                  வெளியேறு
                </button>
              </>
            ) : (
              <Link to="/auth"
                className="text-white text-xs font-heading font-bold uppercase tracking-wider px-4 py-2 transition-colors rounded-none"
                style={{ backgroundColor: pc }}>
                உள்நுழைவு
              </Link>
            )}
          </div>

          {/* Mobile hamburger */}
          <button className="lg:hidden p-2 -mr-2 transition-colors rounded"
            onClick={() => setMobileOpen(!mobileOpen)} aria-label="Menu"
            onMouseEnter={e => (e.currentTarget.style.color = pc)}
            onMouseLeave={e => (e.currentTarget.style.color = "")}>
            {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </nav>

      {/* Mobile menu overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 top-0 z-40 bg-black/70 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)} />
      )}

      {/* Mobile menu drawer */}
      <div className={`lg:hidden fixed top-0 right-0 h-full w-72 z-50 bg-[#0F172A] text-white transform transition-transform duration-300 ${
        mobileOpen ? "translate-x-0" : "translate-x-full"
      } flex flex-col border-l-4`} style={{ borderColor: pc }}>
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <span className="font-heading text-sm uppercase tracking-wider text-slate-300">மெனு</span>
          <button onClick={() => setMobileOpen(false)} className="p-1 hover:text-white"
            aria-label="Close menu" style={{ color: pc }}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4">
          {navLinks.map((link) => (
            <a key={link.href} href={link.href} onClick={() => setMobileOpen(false)}
              className="flex items-center gap-3 px-5 py-3.5 font-heading uppercase tracking-wider text-sm hover:bg-white/5 transition-colors border-b border-white/5 text-slate-300">
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: pc }} />
              {link.label}
            </a>
          ))}
          <Link to="/stories" onClick={() => setMobileOpen(false)}
            className="flex items-center gap-3 px-5 py-3.5 font-heading uppercase tracking-wider text-sm hover:bg-white/5 transition-colors border-b border-white/5 text-slate-300">
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: pc }} />
            வீடியோ கதைகள்
          </Link>
          <Link to="/tools" onClick={() => setMobileOpen(false)}
            className="flex items-center gap-3 px-5 py-3.5 font-heading uppercase tracking-wider text-sm hover:bg-white/5 transition-colors border-b border-white/5 text-slate-300">
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: pc }} />
            கருவிகள்
          </Link>
        </nav>

        <div className="border-t border-white/10 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <MapPin className="h-3.5 w-3.5" style={{ color: pc }} />
              {settings.location}
            </div>
            <PushNotificationButton variant="full" className="text-xs h-8" />
          </div>
          {user ? (
            <div className="flex flex-col gap-2">
              <Link to="/admin" onClick={() => setMobileOpen(false)}
                className="text-sm font-heading uppercase tracking-wider text-center py-2 border border-white/20 transition-colors text-white hover:text-white">
                Admin Dashboard
              </Link>
              <button onClick={handleLogout}
                className="text-sm font-heading uppercase tracking-wider text-center py-2 text-white transition-colors"
                style={{ backgroundColor: pc }}>
                வெளியேறு
              </button>
            </div>
          ) : (
            <Link to="/auth" onClick={() => setMobileOpen(false)}
              className="block text-sm font-heading uppercase tracking-wider text-center py-2.5 text-white transition-colors"
              style={{ backgroundColor: pc }}>
              உள்நுழைவு
            </Link>
          )}
        </div>
      </div>

      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
      <BookmarksDrawer open={bookmarksOpen} onClose={() => setBookmarksOpen(false)} />
    </header>
  );
};

export default Navbar;
