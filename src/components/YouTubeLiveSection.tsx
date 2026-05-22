import { useEffect, useState } from "react";
import { Youtube, ChevronRight } from "lucide-react";
import { extractYouTubeId, loadSiteSettingsDB } from "@/lib/site-settings";

export default function YouTubeLiveSection() {
  const [videoId, setVideoId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSiteSettingsDB()
      .then((s) => {
        setVideoId(s.youtubeLiveUrl ? extractYouTubeId(s.youtubeLiveUrl) : null);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading || !videoId) return null;

  return (
    <section className="bg-[#0F172A] py-10 px-4">
      <div className="container mx-auto">
        {/* Red accent line top */}
        <div className="h-1 w-full bg-[#DC2626] mb-8 rounded-sm" />

        <div className="grid md:grid-cols-3 gap-8 items-center">
          {/* Player — 2/3 width */}
          <div className="md:col-span-2">
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              <span className="relative flex h-3.5 w-3.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-[#DC2626]" />
              </span>
              <span className="text-[#DC2626] font-heading font-bold text-sm uppercase tracking-widest">
                நேரடி ஒளிபரப்பு
              </span>
              <span className="text-white/30 text-xs uppercase tracking-wider">· Live</span>
            </div>

            <div
              className="relative w-full rounded-lg overflow-hidden shadow-2xl border border-white/10 group"
              style={{ paddingBottom: "56.25%" }}
            >
              <iframe
                className="absolute inset-0 w-full h-full"
                src={`https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&rel=0&modestbranding=1`}
                title="Trichy Insight Live"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>

          {/* Description — 1/3 width */}
          <div className="space-y-5 text-white">
            <h2 className="text-2xl font-heading font-bold leading-tight uppercase">
              திருச்சி நேரலை
              <span className="block text-sm font-normal text-slate-400 uppercase tracking-widest mt-1">
                Trichy Insight Live
              </span>
            </h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              திருச்சி இன்சைட் நேரலையில் உடனுக்குடன் செய்திகளையும், சிறப்பு நிகழ்ச்சிகளையும் பாருங்கள். YouTube-ல் சந்தா செய்து தவறவிடாதீர்கள்.
            </p>
            <a
              href={`https://www.youtube.com/watch?v=${videoId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 w-full justify-center bg-white text-[#0F172A] hover:bg-slate-100 font-heading font-bold text-sm uppercase tracking-wider px-4 py-3 transition-colors group rounded-sm"
            >
              <Youtube className="w-4 h-4 text-[#DC2626]" />
              YouTube-ல் பார்க்க
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
