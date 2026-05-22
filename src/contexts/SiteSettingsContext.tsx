import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface SiteCategory {
  id: string;
  label: string;
  color: string;
}

export interface SiteSettings {
  site_name: string;
  tagline: string;
  domain: string;
  logo_url: string;
  primary_color: string;
  twitter_handle: string;
  publication_id: string;
  contact_email: string;
  contact_phone: string;
  whatsapp_number: string;
  youtube_url: string;
  instagram_url: string;
  facebook_url: string;
  about_text: string;
  location: string;
  maps_url: string;
  vapid_email: string;
  rss_description: string;
  categories: SiteCategory[];
}

export const DEFAULT_SETTINGS: SiteSettings = {
  site_name: "Trichy Insight",
  tagline: "தமிழ்நாட்டின் குரல்",
  domain: "trichyinsight.online",
  logo_url: "",
  primary_color: "#DC2626",
  twitter_handle: "@trichyinsight",
  publication_id: "CAowx7nGDA",
  contact_email: "contact@trichyinsight.com",
  contact_phone: "+918903952591",
  whatsapp_number: "918903952591",
  youtube_url: "https://www.youtube.com/@trichyinsight",
  instagram_url: "https://www.instagram.com/trichyinsight/",
  facebook_url: "https://www.facebook.com/trichyinsight",
  about_text: "திருச்சிராப்பள்ளி மாவட்டத்தின் நம்பகமான உள்ளூர் செய்திகள், நிகழ்வுகள் மற்றும் தகவல்களுக்கான முன்னணி டிஜிட்டல் தளம்.",
  location: "திருச்சிராப்பள்ளி, தமிழ்நாடு",
  maps_url: "https://maps.google.com/?q=Tiruchirappalli,Tamil+Nadu",
  vapid_email: "admin@trichyinsight.online",
  rss_description: "திருச்சிராப்பள்ளி மாவட்டத்தின் முக்கிய செய்திகள் | Trichy latest news in Tamil",
  categories: [
    { id: "civic", label: "குடிமை பிரச்சனைகள்", color: "#3B82F6" },
    { id: "political", label: "அரசியல் பகுப்பாய்வு", color: "#8B5CF6" },
    { id: "viral", label: "வைரல்", color: "#DC2626" },
    { id: "business", label: "வணிக சிறப்புப் பதிவு", color: "#10B981" },
  ],
};

function hexToHslString(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

interface SiteSettingsContextValue {
  settings: SiteSettings;
  isLoaded: boolean;
  refresh: () => Promise<void>;
}

const SiteSettingsContext = createContext<SiteSettingsContextValue>({
  settings: DEFAULT_SETTINGS,
  isLoaded: false,
  refresh: async () => {},
});

export function SiteSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);

  const load = async () => {
    try {
      const { data } = await supabase
        .from("site_settings")
        .select("settings")
        .eq("id", 1)
        .maybeSingle();

      if (data?.settings && typeof data.settings === "object") {
        const merged = { ...DEFAULT_SETTINGS, ...(data.settings as Partial<SiteSettings>) };
        setSettings(merged);
        if (merged.primary_color?.startsWith("#") && merged.primary_color.length === 7) {
          const hsl = hexToHslString(merged.primary_color);
          document.documentElement.style.setProperty("--primary", hsl);
          document.documentElement.style.setProperty("--accent", hsl);
          document.documentElement.style.setProperty("--news-red", hsl);
        }
      }
    } catch {
    } finally {
      setIsLoaded(true);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <SiteSettingsContext.Provider value={{ settings, isLoaded, refresh: load }}>
      {children}
    </SiteSettingsContext.Provider>
  );
}

export function useSiteSettings() {
  return useContext(SiteSettingsContext);
}
