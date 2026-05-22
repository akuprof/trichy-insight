import { supabase } from "@/integrations/supabase/client";

export interface SiteSettings {
  youtubeLiveUrl: string;
}

const LS_KEY = "trichy_site_settings";

export const defaultSiteSettings = (): SiteSettings => ({ youtubeLiveUrl: "" });

export const loadSiteSettingsLocal = (): SiteSettings => {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return defaultSiteSettings();
    return { ...defaultSiteSettings(), ...(JSON.parse(raw) as Partial<SiteSettings>) };
  } catch {
    return defaultSiteSettings();
  }
};

export const saveSiteSettingsLocal = (s: SiteSettings): void => {
  localStorage.setItem(LS_KEY, JSON.stringify(s));
};

export const loadSiteSettingsDB = async (): Promise<SiteSettings> => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from("site_settings")
      .select("youtube_live_url")
      .eq("id", 1)
      .maybeSingle();

    if (data) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const s: SiteSettings = { youtubeLiveUrl: (data as any).youtube_live_url ?? "" };
      saveSiteSettingsLocal(s);
      return s;
    }
  } catch {
    // table may not exist yet — fall back to localStorage
  }
  return loadSiteSettingsLocal();
};

export const saveSiteSettingsToDB = async (s: SiteSettings): Promise<void> => {
  saveSiteSettingsLocal(s);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("site_settings")
    .upsert(
      { id: 1, youtube_live_url: s.youtubeLiveUrl, updated_at: new Date().toISOString() },
      { onConflict: "id" }
    );
  if (error) throw new Error(error.message as string);
};

export function extractYouTubeId(raw: string): string | null {
  const s = raw.trim();
  // watch?v=
  const m1 = s.match(/[?&]v=([A-Za-z0-9_-]{11})/);
  if (m1) return m1[1];
  // youtu.be/
  const m2 = s.match(/youtu\.be\/([A-Za-z0-9_-]{11})/);
  if (m2) return m2[1];
  // youtube.com/live/
  const m3 = s.match(/youtube\.com\/live\/([A-Za-z0-9_-]{11})/);
  if (m3) return m3[1];
  // youtube.com/embed/
  const m4 = s.match(/youtube\.com\/embed\/([A-Za-z0-9_-]{11})/);
  if (m4) return m4[1];
  // raw 11-char ID
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
  return null;
}
