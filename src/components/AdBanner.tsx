import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Ad = {
  id: string;
  type: string;
  image_url: string | null;
  link_url: string | null;
  html_code: string | null;
  title: string;
  impression_count: number;
  click_count: number;
};

interface AdBannerProps {
  slot: string;
  className?: string;
}

const TABLE_MISSING_CODES = new Set(["42P01", "PGRST204", "PGRST200"]);
const isTableMissing = (err: { code?: string; message?: string }) =>
  TABLE_MISSING_CODES.has(err.code ?? "") ||
  (err.message ?? "").includes("schema cache") ||
  (err.message ?? "").includes("Could not find") ||
  (err.message ?? "").includes("does not exist");

const trackImpression = async (ad: Ad) => {
  const { error } = await supabase
    .from("ads" as never)
    .update({ impression_count: (ad.impression_count || 0) + 1 } as never)
    .eq("id", ad.id);
  if (error && !isTableMissing(error)) {
    console.debug("[AdBanner] impression track failed:", error.message);
  }
};

const trackClick = async (ad: Ad) => {
  const { error } = await supabase
    .from("ads" as never)
    .update({ click_count: (ad.click_count || 0) + 1 } as never)
    .eq("id", ad.id);
  if (error && !isTableMissing(error)) {
    console.debug("[AdBanner] click track failed:", error.message);
  }
};

const AdBanner = ({ slot, className = "" }: AdBannerProps) => {
  const [ad, setAd] = useState<Ad | null>(null);
  const [ready, setReady] = useState(false);
  const impressionTracked = useRef(false);

  useEffect(() => {
    impressionTracked.current = false;
    setAd(null);
    setReady(false);

    const fetchAd = async () => {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("ads" as never)
        .select("id, type, image_url, link_url, html_code, title, impression_count, click_count")
        .eq("slot", slot)
        .eq("is_active", true)
        .or(`start_date.is.null,start_date.lte.${now}`)
        .or(`end_date.is.null,end_date.gte.${now}`)
        .order("priority", { ascending: false })
        .limit(1);

      if (error) {
        if (!isTableMissing(error)) {
          console.debug("[AdBanner] fetch failed:", error.message);
        }
        return;
      }
      if (!data || (data as Ad[]).length === 0) return;
      setAd((data as Ad[])[0]);
      setReady(true);
    };

    void fetchAd();
  }, [slot]);

  useEffect(() => {
    if (!ad || impressionTracked.current) return;
    impressionTracked.current = true;
    void trackImpression(ad);
  }, [ad]);

  const handleClick = () => {
    if (!ad) return;
    void trackClick(ad);
  };

  if (!ready || !ad) return null;

  if (ad.type === "html" && ad.html_code) {
    return (
      <div
        className={`ad-banner overflow-hidden ${className}`}
        dangerouslySetInnerHTML={{ __html: ad.html_code }}
      />
    );
  }

  if (ad.type === "image" && ad.image_url) {
    const inner = (
      <img
        src={ad.image_url}
        alt={ad.title}
        className="w-full h-auto object-cover"
        loading="lazy"
      />
    );

    return (
      <div className={`ad-banner relative ${className}`}>
        <span className="absolute top-1 right-1 z-10 text-[9px] text-white/60 bg-black/30 px-1 rounded leading-tight">
          விளம்பரம்
        </span>
        {ad.link_url ? (
          <a href={ad.link_url} target="_blank" rel="noopener noreferrer nofollow" onClick={handleClick}>
            {inner}
          </a>
        ) : (
          <div onClick={handleClick}>{inner}</div>
        )}
      </div>
    );
  }

  return null;
};

export default AdBanner;
