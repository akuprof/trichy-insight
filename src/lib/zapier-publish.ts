import { supabase } from "@/integrations/supabase/client";

export type ZapierEvent = "article.published" | "article.scheduled" | "article.draft_saved";

export interface ZapierHookConfig {
  url: string;
  enabled: boolean;
  secret?: string | null;
}

export interface ZapierArticlePayload {
  event: ZapierEvent;
  timestamp: string;
  source: string;
  article: {
    id: string;
    title: string;
    slug: string;
    category: string;
    excerpt: string | null;
    content: string;
    url: string;
    image_url: string | null;
    video_url: string | null;
    meta_title: string | null;
    meta_description: string | null;
    meta_keywords: string[];
    published_at: string | null;
    is_published: boolean;
  };
}

const STORAGE_KEY = "trichy_zapier_hooks";

export interface ZapierHooks {
  published: ZapierHookConfig;
  scheduled: ZapierHookConfig;
  draft: ZapierHookConfig;
  inbound_secret: string;
}

export const defaultZapierHooks = (): ZapierHooks => ({
  published: { url: "", enabled: true, secret: "" },
  scheduled: { url: "", enabled: true, secret: "" },
  draft: { url: "", enabled: false, secret: "" },
  inbound_secret: "",
});

export const loadZapierHooks = (): ZapierHooks => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultZapierHooks();
    return { ...defaultZapierHooks(), ...JSON.parse(raw) };
  } catch {
    return defaultZapierHooks();
  }
};

export const saveZapierHooks = (hooks: ZapierHooks): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(hooks));
};

const buildArticleUrl = (slug: string) =>
  `${window.location.origin}${import.meta.env.BASE_URL}news/${slug}`.replace(/\/\//g, "/").replace(":/", "://");

export const buildZapierPayload = (
  event: ZapierEvent,
  post: {
    id: string;
    title: string;
    slug: string;
    category: string;
    excerpt?: string | null;
    content: string;
    cover_image_url?: string | null;
    video_url?: string | null;
    meta_title?: string | null;
    meta_description?: string | null;
    meta_keywords?: string[] | null;
    published_at?: string | null;
    is_published: boolean;
  }
): ZapierArticlePayload => ({
  event,
  timestamp: new Date().toISOString(),
  source: "trichy-insight-cms",
  article: {
    id: post.id,
    title: post.title,
    slug: post.slug,
    category: post.category,
    excerpt: post.excerpt ?? null,
    content: post.content,
    url: buildArticleUrl(post.slug),
    image_url: post.cover_image_url ?? null,
    video_url: post.video_url ?? null,
    meta_title: post.meta_title ?? null,
    meta_description: post.meta_description ?? null,
    meta_keywords: post.meta_keywords ?? [],
    published_at: post.published_at ?? null,
    is_published: post.is_published,
  },
});

export const sendZapierWebhook = async (
  config: ZapierHookConfig,
  payload: ZapierArticlePayload
): Promise<{ success: boolean; status?: number; error?: string }> => {
  if (!config.enabled || !config.url.trim()) {
    return { success: true };
  }

  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (config.secret?.trim()) {
      headers["X-Zapier-Secret"] = config.secret.trim();
    }

    const res = await fetch(config.url.trim(), {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    return { success: res.ok, status: res.status };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Network error" };
  }
};

export const triggerZapierForEvent = async (
  event: ZapierEvent,
  postId: string
): Promise<{ success: boolean; skipped: boolean; error: string | null }> => {
  const hooks = loadZapierHooks();

  const hookMap: Record<ZapierEvent, ZapierHookConfig> = {
    "article.published": hooks.published,
    "article.scheduled": hooks.scheduled,
    "article.draft_saved": hooks.draft,
  };

  const hook = hookMap[event];
  if (!hook?.enabled || !hook.url?.trim()) {
    return { success: true, skipped: true, error: null };
  }

  const { data, error } = await supabase
    .from("news_posts")
    .select("id, title, slug, category, excerpt, content, cover_image_url, video_url, meta_title, meta_description, meta_keywords, published_at, is_published")
    .eq("id", postId)
    .single();

  if (error || !data) {
    return { success: false, skipped: false, error: error?.message ?? "Post not found" };
  }

  const payload = buildZapierPayload(event, data as Parameters<typeof buildZapierPayload>[1]);
  const result = await sendZapierWebhook(hook, payload);

  return { success: result.success, skipped: false, error: result.error ?? null };
};
