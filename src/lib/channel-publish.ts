import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

const STORAGE_KEY = "trichy_direct_channels";
const API_BASE = "/api";

export interface FacebookChannelConfig {
  enabled: boolean;
  pageId: string;
  accessToken: string;
}

export interface InstagramChannelConfig {
  enabled: boolean;
  igUserId: string;
  accessToken: string;
}

export interface WhatsAppChannelConfig {
  enabled: boolean;
  provider: "greenapi" | "wati" | "meta";
  instanceId: string;
  apiToken: string;
  groupId: string;
  phoneId: string;
  wabaToken: string;
  apiUrl: string;
}

export interface TwitterChannelConfig {
  enabled: boolean;
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessTokenSecret: string;
  bearerToken: string;
}

export interface BlueskyChannelConfig {
  enabled: boolean;
  handle: string;
  appPassword: string;
}

export interface DirectChannelSettings {
  facebook: FacebookChannelConfig;
  instagram: InstagramChannelConfig;
  whatsapp: WhatsAppChannelConfig;
  twitter: TwitterChannelConfig;
  bluesky: BlueskyChannelConfig;
}

export const defaultDirectChannels = (): DirectChannelSettings => ({
  facebook: { enabled: false, pageId: "", accessToken: "" },
  instagram: { enabled: false, igUserId: "17841447727738548", accessToken: "" },
  whatsapp: {
    enabled: false,
    provider: "greenapi",
    instanceId: "",
    apiToken: "",
    groupId: "",
    phoneId: "",
    wabaToken: "",
    apiUrl: "",
  },
  twitter: { enabled: false, apiKey: "", apiSecret: "", accessToken: "", accessTokenSecret: "", bearerToken: "" },
  bluesky: { enabled: false, handle: "", appPassword: "" },
});

const mergeWithDefaults = (raw: Partial<DirectChannelSettings>): DirectChannelSettings => ({
  facebook: { ...defaultDirectChannels().facebook, ...raw.facebook },
  instagram: { ...defaultDirectChannels().instagram, ...raw.instagram },
  whatsapp: { ...defaultDirectChannels().whatsapp, ...raw.whatsapp },
  twitter: { ...defaultDirectChannels().twitter, ...raw.twitter },
  bluesky: { ...defaultDirectChannels().bluesky, ...raw.bluesky },
});

// ── Sync localStorage helpers (used as cache) ────────────────────
export const loadDirectChannels = (): DirectChannelSettings => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultDirectChannels();
    return mergeWithDefaults(JSON.parse(raw) as Partial<DirectChannelSettings>);
  } catch {
    return defaultDirectChannels();
  }
};

export const saveDirectChannels = (settings: DirectChannelSettings): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
};

// ── Supabase DB helpers (cross-device persistence) ───────────────
export const loadDirectChannelsDB = async (): Promise<DirectChannelSettings> => {
  try {
    const { data, error } = await supabase
      .from("channel_settings")
      .select("settings")
      .eq("id", 1)
      .single();

    if (error || !data?.settings) {
      return loadDirectChannels(); // fall back to localStorage
    }

    const parsed = data.settings as Partial<DirectChannelSettings>;
    const merged = mergeWithDefaults(parsed);
    saveDirectChannels(merged); // update local cache
    return merged;
  } catch {
    return loadDirectChannels();
  }
};

export const saveDirectChannelsToDB = async (settings: DirectChannelSettings): Promise<void> => {
  saveDirectChannels(settings); // always update local cache first
  // Read existing row to preserve the _app key (YouTube token, etc.)
  const { data: existing } = await supabase
    .from("channel_settings")
    .select("settings")
    .eq("id", 1)
    .single();
  const preserved = (existing?.settings ?? {}) as Record<string, unknown>;
  const merged = { ...settings, _app: preserved._app };
  const { error } = await supabase
    .from("channel_settings")
    .upsert(
      { id: 1, settings: merged as unknown as Json, updated_at: new Date().toISOString() },
      { onConflict: "id" }
    );
  if (error) {
    console.error("Failed to save channel settings to DB:", error);
    throw new Error(error.message);
  }
};

// ── App-level settings (row id=1 _app key) ────────────────────────────────
export interface AppSettings {
  youtubeRefreshToken: string;
  ttsProvider: "gemini" | "minimax";
  ttsApiKey: string;
  ttsVoice: string;
}

const defaultAppSettings = (): AppSettings => ({
  youtubeRefreshToken: "",
  ttsProvider: "gemini",
  ttsApiKey: "",
  ttsVoice: "Kore",
});

export const loadAppSettings = async (): Promise<AppSettings> => {
  try {
    const { data, error } = await supabase
      .from("channel_settings")
      .select("settings")
      .eq("id", 1)
      .single();
    if (error || !data?.settings) return defaultAppSettings();
    const row = data.settings as Record<string, unknown>;
    const raw = (row._app ?? {}) as Partial<AppSettings>;
    return { ...defaultAppSettings(), ...raw };
  } catch {
    return defaultAppSettings();
  }
};

export const saveAppSettings = async (settings: Partial<AppSettings>): Promise<void> => {
  // Read existing row first so we don't overwrite channel settings
  const { data } = await supabase
    .from("channel_settings")
    .select("settings")
    .eq("id", 1)
    .single();
  const existing = (data?.settings ?? {}) as Record<string, unknown>;
  const existingApp = (existing._app ?? {}) as Record<string, unknown>;
  const merged = { ...existing, _app: { ...existingApp, ...settings } };
  const { error } = await supabase
    .from("channel_settings")
    .update({ settings: merged as unknown as Json, updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (error) throw new Error(error.message);
};

// ── Publish ──────────────────────────────────────────────────────
// Facebook & Instagram receive a video Reel (auto-rendered from the article).
// WhatsApp, Twitter, and Bluesky receive the standard news post.
export const publishToDirectChannels = async (postId: string): Promise<{
  facebook: { success: boolean; error?: string } | null;
  instagram: { success: boolean; error?: string } | null;
  whatsapp: { success: boolean; error?: string } | null;
  twitter: { success: boolean; error?: string } | null;
  bluesky: { success: boolean; error?: string } | null;
}> => {
  // Always load from DB first (with localStorage fallback) so the most
  // recent saved settings are used — not stale in-memory cache from localStorage.
  const channels = await loadDirectChannelsDB();

  const hasAny =
    channels.facebook.enabled ||
    channels.instagram.enabled ||
    channels.whatsapp.enabled ||
    channels.twitter.enabled ||
    channels.bluesky.enabled;

  if (!hasAny) {
    console.info("[publish] No channels enabled — skipping social publish");
    return { facebook: null, instagram: null, whatsapp: null, twitter: null, bluesky: null };
  }

  const { data: post, error: postError } = await supabase
    .from("news_posts")
    .select("id, title, slug, category, excerpt, cover_image_url, video_url, published_at")
    .eq("id", postId)
    .single();

  if (postError || !post) {
    const err = { success: false, error: "Post not found" };
    return { facebook: err, instagram: err, whatsapp: err, twitter: err, bluesky: err };
  }

  const results: {
    facebook: { success: boolean; error?: string } | null;
    instagram: { success: boolean; error?: string } | null;
    whatsapp: { success: boolean; error?: string } | null;
    twitter: { success: boolean; error?: string } | null;
    bluesky: { success: boolean; error?: string } | null;
  } = { facebook: null, instagram: null, whatsapp: null, twitter: null, bluesky: null };

  // ── Facebook & Instagram → auto-render Reel ──────────────────
  if (channels.facebook.enabled || channels.instagram.enabled) {
    try {
      const reelRes = await fetch(`${API_BASE}/reels/auto-publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId: postId }),
      });
      const reelData = await reelRes.json() as { success: boolean; message?: string; error?: string };
      const reelResult = reelData.success
        ? { success: true }
        : { success: false, error: reelData.error ?? reelData.message ?? "Reel auto-publish failed" };
      if (channels.facebook.enabled) results.facebook = reelResult;
      if (channels.instagram.enabled) results.instagram = reelResult;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network error";
      if (channels.facebook.enabled) results.facebook = { success: false, error: msg };
      if (channels.instagram.enabled) results.instagram = { success: false, error: msg };
    }
  }

  // ── WhatsApp, Twitter, Bluesky → standard news post ──────────
  const needsSocialPost = channels.whatsapp.enabled || channels.twitter.enabled || channels.bluesky.enabled;
  if (needsSocialPost) {
    const siteUrl = window.location.origin + import.meta.env.BASE_URL;
    const body = {
      article: post,
      siteUrl,
      ...(channels.whatsapp.enabled ? { whatsapp: channels.whatsapp } : {}),
      ...(channels.twitter.enabled ? { twitter: channels.twitter } : {}),
      ...(channels.bluesky.enabled ? { bluesky: channels.bluesky } : {}),
    };

    try {
      const res = await fetch(`${API_BASE}/social/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = await res.json() as { results: typeof results };
        if (channels.whatsapp.enabled) results.whatsapp = data.results.whatsapp ?? null;
        if (channels.twitter.enabled) results.twitter = data.results.twitter ?? null;
        if (channels.bluesky.enabled) results.bluesky = data.results.bluesky ?? null;
      } else {
        const err = { success: false, error: `Server error ${res.status}` };
        if (channels.whatsapp.enabled) results.whatsapp = err;
        if (channels.twitter.enabled) results.twitter = err;
        if (channels.bluesky.enabled) results.bluesky = err;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network error";
      const e = { success: false, error: msg };
      if (channels.whatsapp.enabled) results.whatsapp = e;
      if (channels.twitter.enabled) results.twitter = e;
      if (channels.bluesky.enabled) results.bluesky = e;
    }
  }

  return results;
};

export const testChannel = async (
  channel: "facebook" | "instagram" | "whatsapp" | "twitter" | "bluesky",
  config: DirectChannelSettings
): Promise<{ success: boolean; error?: string }> => {
  const res = await fetch(`${API_BASE}/social/test/${channel}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      siteUrl: window.location.origin,
      facebook: config.facebook,
      instagram: config.instagram,
      whatsapp: config.whatsapp,
      twitter: config.twitter,
      bluesky: config.bluesky,
    }),
  });

  if (!res.ok) return { success: false, error: `Server error ${res.status}` };
  try {
    const json = await res.json() as { success: boolean; error?: string };
    return json;
  } catch {
    return { success: false, error: `Unexpected response from server (${res.status})` };
  }
};
