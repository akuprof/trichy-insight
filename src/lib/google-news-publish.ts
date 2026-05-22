export type GoogleNewsPublishSource = "chat" | "manual-form" | "toggle-publish";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "/api";

type GoogleNewsPublishResponse = {
  success?: boolean;
  skipped?: boolean;
  error?: string;
  sitemap_url?: string;
};

export const triggerGoogleNewsPublish = async (postId: string, source: GoogleNewsPublishSource) => {
  try {
    const res = await fetch(`${API_BASE}/google-news/ping`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId, source, publicBaseUrl: window.location.origin }),
    });

    if (!res.ok) {
      return { success: false, skipped: false, error: `Server error ${res.status}`, sitemapUrl: null };
    }

    const payload = (await res.json()) as GoogleNewsPublishResponse;
    return {
      success: !!payload.success,
      skipped: !!payload.skipped,
      error: payload.error || null,
      sitemapUrl: payload.sitemap_url || null,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, skipped: false, error: msg, sitemapUrl: null };
  }
};
