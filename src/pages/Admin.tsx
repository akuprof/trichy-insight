import { FormEvent, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import {
  BarChart3, Calendar, CheckCircle2, Clapperboard, Globe, Layers, Loader2, LogOut, Megaphone,
  Pencil, Plus, Rss, Search, Settings, Sparkles, Trash2, X, XCircle, Zap,
} from "lucide-react";
import AdminZapierPanel from "@/components/admin/AdminZapierPanel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import AdminMediaFields from "@/components/admin/AdminMediaFields";
import ArticleMediaUpdater from "@/components/admin/ArticleMediaUpdater";
import AdminAIAssistant from "@/components/admin/AdminAIAssistant";
import AdminNewsChatComposer from "@/components/admin/AdminNewsChatComposer";
import AdminIndexing from "@/components/admin/AdminIndexing";
import AdminSEOPanel from "@/components/admin/AdminSEOPanel";
import AdminChannelConfig from "@/components/admin/AdminChannelConfig";
import AdminNewsAggregator from "@/components/admin/AdminNewsAggregator";
import AdminReelCreator, { type ReelArticle } from "@/components/admin/AdminReelCreator";
import AdminAdManager from "@/components/admin/AdminAdManager";
import AdminVideoReelPublisher from "@/components/admin/AdminVideoReelPublisher";
import AdminAnalytics from "@/components/admin/AdminAnalytics";
import AdminSiteSettings from "@/components/admin/AdminSiteSettings";
import { triggerGoogleNewsPublish } from "@/lib/google-news-publish";
import { triggerSocialPublish } from "@/lib/social-publish";
import { triggerZapierForEvent } from "@/lib/zapier-publish";
import { loadDirectChannels, publishToDirectChannels, saveDirectChannelsToDB } from "@/lib/channel-publish";
import { loadSiteSettingsDB, saveSiteSettingsToDB, extractYouTubeId } from "@/lib/site-settings";

type NewsPost = Tables<"news_posts"> & {
  video_url?: string | null;
  meta_title?: string | null;
  meta_description?: string | null;
  meta_keywords?: string[] | null;
};

type SocialPublishSettings = {
  id: string;
  webhook_url: string;
  enabled: boolean;
  secret_token: string | null;
};

interface NewsFormState {
  title: string;
  slug: string;
  category: string;
  excerpt: string;
  content: string;
  cover_image_url: string;
  video_url: string;
  meta_title: string;
  meta_description: string;
  meta_keywords: string;
  is_published: boolean;
  scheduled_at: string;
}

const emptyForm: NewsFormState = {
  title: "",
  slug: "",
  category: "",
  excerpt: "",
  content: "",
  cover_image_url: "",
  video_url: "",
  meta_title: "",
  meta_description: "",
  meta_keywords: "",
  is_published: false,
  scheduled_at: "",
};

const buildSlug = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

const Admin = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const { toast } = useToast();

  const [checkingRole, setCheckingRole] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [posts, setPosts] = useState<NewsPost[]>([]);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [analytics, setAnalytics] = useState({ totalPosts: 0, publishedPosts: 0, totalViews: 0, newsletterSubscribers: 0 });
  const [indexingSlug, setIndexingSlug] = useState<Record<string, "pending" | "ok" | "error">>({});
  const [form, setForm] = useState<NewsFormState>(emptyForm);
  const [structuredInput, setStructuredInput] = useState("");
  const [activeTab, setActiveTab] = useState("dashboard");
  const [reelArticle, setReelArticle] = useState<ReelArticle | null>(null);

  type ChannelResult = { success: boolean; error?: string } | null;
  type PublishChannelResults = {
    facebook?: ChannelResult; instagram?: ChannelResult;
    whatsapp?: ChannelResult; twitter?: ChannelResult; bluesky?: ChannelResult;
  };
  const [lastPublishResults, setLastPublishResults] = useState<Record<string, PublishChannelResults>>({});

  const handleDirectPublishResult = (articleId: string, r: {
    facebook: ChannelResult; instagram: ChannelResult;
    whatsapp: ChannelResult; twitter: ChannelResult; bluesky: ChannelResult;
  }) => {
    setLastPublishResults((prev) => ({ ...prev, [articleId]: r }));

    const channels: Array<{ name: string; result: ChannelResult; color: string }> = [
      { name: "Facebook", result: r.facebook, color: "text-blue-600" },
      { name: "Instagram", result: r.instagram, color: "text-pink-600" },
      { name: "WhatsApp", result: r.whatsapp, color: "text-green-600" },
      { name: "Twitter/X", result: r.twitter, color: "text-gray-800" },
      { name: "Bluesky", result: r.bluesky, color: "text-sky-500" },
    ].filter((c) => c.result !== null);

    if (!channels.length) return;

    const ok = channels.filter((c) => c.result?.success);
    const fail = channels.filter((c) => c.result && !c.result.success);

    // Facebook & Instagram now post as Reels (async render in background)
    const reelChannels = new Set(["Facebook", "Instagram"]);
    const reelOk = ok.filter((c) => reelChannels.has(c.name));
    const regularOk = ok.filter((c) => !reelChannels.has(c.name));

    const lines = [
      ...reelOk.map((c) => `🎬 ${c.name} Reel ரெண்டர் ஆகிறது...`),
      ...regularOk.map((c) => `✓ ${c.name}`),
      ...fail.map((c) => `✗ ${c.name}: ${c.result?.error ?? "failed"}`),
    ].join(" · ");

    const reelNote = reelOk.length > 0 ? " (~2 நிமிடத்தில் பதிவிடப்படும்)" : "";

    toast({
      title: ok.length > 0 ? `${ok.length} சேனல் தயாராகிறது!` : "சேனல் வெளியீடு தோல்வி",
      description: lines + reelNote,
      variant: fail.length > 0 && ok.length === 0 ? "destructive" : "default",
    });
  };

  const [socialSettings, setSocialSettings] = useState<SocialPublishSettings | null>(null);
  const [webhookUrlInput, setWebhookUrlInput] = useState("");
  const [ytLiveUrl, setYtLiveUrl] = useState("");
  const [savingYtLive, setSavingYtLive] = useState(false);
  const [secretTokenInput, setSecretTokenInput] = useState("");
  const [socialEnabled, setSocialEnabled] = useState(true);
  const [savingSocialSettings, setSavingSocialSettings] = useState(false);

  const [aiSourceUrl, setAiSourceUrl] = useState("");
  const [aiSourceText, setAiSourceText] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiReelsScript, setAiReelsScript] = useState("");
  const [aiYtTitle, setAiYtTitle] = useState("");
  const [aiYtDescription, setAiYtDescription] = useState("");
  const [aiYtTags, setAiYtTags] = useState<string[]>([]);
  const [structuredReelsScript, setStructuredReelsScript] = useState("");
  const [aiImagePrompt, setAiImagePrompt] = useState("");
  const [aiMode, setAiMode] = useState<"full" | "breaking">("full");

  const [breakingMode, setBreakingMode] = useState(false);
  const [todayArticles, setTodayArticles] = useState<number | null>(null);
  const [todayReels, setTodayReels] = useState<number | null>(null);

  const topCategory = useMemo(() => {
    if (!posts.length) return "—";
    const counts = posts.reduce<Record<string, number>>((acc, post) => {
      acc[post.category] = (acc[post.category] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
  }, [posts]);

  const filteredPosts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return posts;
    return posts.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        (p.excerpt ?? "").toLowerCase().includes(q) ||
        p.slug.toLowerCase().includes(q),
    );
  }, [posts, searchQuery]);

  const excerptWordCount = useMemo(
    () => form.excerpt.trim().split(/\s+/).filter(Boolean).length,
    [form.excerpt]
  );

  const fetchAdminState = async (currentUserId: string) => {
    setLoadingPosts(true);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayISO = todayStart.toISOString();

    const [
      { data: roles, error: roleError },
      { data: postData, error: postsError },
      { count: totalViews, error: viewsError },
      { data: socialData, error: socialError },
      { count: countTodayAll },
      { count: countTodayReels },
    ] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", currentUserId).eq("role", "admin").maybeSingle(),
      supabase.from("news_posts").select("*").order("created_at", { ascending: false }),
      supabase.from("page_view_events").select("id", { count: "exact", head: true }),
      supabase
        .from("social_publish_settings")
        .select("id, webhook_url, enabled, secret_token")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from("news_posts").select("id", { count: "exact", head: true }).eq("is_published", true).gte("published_at", todayISO),
      supabase.from("news_posts").select("id", { count: "exact", head: true }).eq("is_published", true).gte("published_at", todayISO).not("video_url", "is", null),
    ]);

    if (roleError) {
      toast({ title: "அனுமதி சரிபார்ப்பு தோல்வி", description: roleError.message, variant: "destructive" });
      setCheckingRole(false);
      setLoadingPosts(false);
      return;
    }

    const adminStatus = !!roles;
    setIsAdmin(adminStatus);
    setCheckingRole(false);

    if (!adminStatus) { setLoadingPosts(false); return; }

    if (postsError) {
      toast({ title: "செய்திகள் ஏற்ற முடியவில்லை", description: postsError.message, variant: "destructive" });
    } else {
      const typedPosts = (postData as NewsPost[]) || [];
      setPosts(typedPosts);
      const totalPosts = typedPosts.length;
      const publishedPosts = typedPosts.filter((p) => p.is_published).length;
      let newsletterSubscribers = 0;
      try {
        const nr = await fetch("/api/newsletter/count");
        if (nr.ok) { const nd = await nr.json(); newsletterSubscribers = nd.count ?? 0; }
      } catch { /* ignore */ }
      setAnalytics({ totalPosts, publishedPosts, totalViews: totalViews || 0, newsletterSubscribers });
    }

    setTodayArticles(countTodayAll ?? 0);
    setTodayReels(countTodayReels ?? 0);

    if (viewsError) toast({ title: "Analytics ஏற்ற முடியவில்லை", description: viewsError.message, variant: "destructive" });

    if (socialError) {
      toast({ title: "Social settings ஏற்ற முடியவில்லை", description: socialError.message, variant: "destructive" });
    } else {
      const settings = (socialData as SocialPublishSettings | null) || null;
      setSocialSettings(settings);
      setWebhookUrlInput(settings?.webhook_url || "");
      setSecretTokenInput(settings?.secret_token || "");
      setSocialEnabled(settings?.enabled ?? true);
    }

    setLoadingPosts(false);
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setCheckingRole(false); setLoadingPosts(false); return; }
    void fetchAdminState(user.id);
    loadSiteSettingsDB().then((s) => setYtLiveUrl(s.youtubeLiveUrl)).catch(() => {});
  }, [authLoading, user?.id]);

  // Meta OAuth callback — handles both Instagram and Facebook ?code= redirects
  // Distinguished by ?state=facebook_oauth (Facebook) vs no state / other (Instagram)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (!code) return;

    const state = params.get("state") ?? "";
    const isFacebook = state === "facebook_oauth";

    // Remove code from URL immediately so it can't be replayed
    window.history.replaceState({}, "", window.location.pathname);
    setActiveTab("channels");

    const API_BASE = import.meta.env.VITE_API_URL as string | undefined ?? "/api";

    if (isFacebook) {
      // ── Facebook Page OAuth ──────────────────────────────────
      toast({ title: "Facebook அங்கீகரிக்கிறது...", description: "Page access token பெறுகிறோம்" });

      fetch(`${API_BASE}/facebook/oauth?code=${encodeURIComponent(code)}`)
        .then((r) => r.json())
        .then((data: {
          page_id?: string; page_name?: string; page_access_token?: string;
          pages?: Array<{ id: string; name: string; access_token: string }>;
          expires_in?: number; error?: string;
        }) => {
          if (data.error || !data.page_access_token) {
            toast({
              title: "Facebook token தோல்வி",
              description: data.error ?? "No pages found or access denied",
              variant: "destructive",
            });
            return;
          }

          const channels = loadDirectChannels();
          channels.facebook.enabled = true;
          channels.facebook.pageId = data.page_id ?? channels.facebook.pageId;
          channels.facebook.accessToken = data.page_access_token;
          void saveDirectChannelsToDB(channels);

          toast({
            title: "Facebook Page இணைக்கப்பட்டது!",
            description: `${data.page_name ?? "Page"} — Page token saved. Channels tab-ல் சேமிக்கவும்.`,
          });
        })
        .catch((err: unknown) => {
          toast({
            title: "Facebook OAuth பிழை",
            description: String(err),
            variant: "destructive",
          });
        });
    } else {
      // ── Instagram OAuth ──────────────────────────────────────
      toast({ title: "Instagram அங்கீகரிக்கிறது...", description: "Access token பெறுகிறோம்" });

      fetch(`${API_BASE}/instagram/oauth?code=${encodeURIComponent(code)}`)
        .then((r) => r.json())
        .then((data: { access_token?: string; ig_user_id?: string; expires_in?: number; error?: string }) => {
          if (data.error || !data.access_token) {
            toast({
              title: "Instagram token தோல்வி",
              description: data.error ?? "Unknown error",
              variant: "destructive",
            });
            return;
          }

          const channels = loadDirectChannels();
          channels.instagram.enabled = true;
          channels.instagram.accessToken = data.access_token;
          if (data.ig_user_id) channels.instagram.igUserId = data.ig_user_id;
          void saveDirectChannelsToDB(channels);

          const expiryDays = data.expires_in ? Math.round(data.expires_in / 86400) : 60;
          toast({
            title: "Instagram இணைக்கப்பட்டது!",
            description: `Long-lived token saved — ${expiryDays} நாட்கள் செல்லுபடியாகும். Channels tab-ல் சேமிக்கவும்.`,
          });
        })
        .catch((err: unknown) => {
          toast({
            title: "Instagram OAuth பிழை",
            description: String(err),
            variant: "destructive",
          });
        });
    }
  }, []);

  const resetForm = () => { setForm(emptyForm); setEditingId(null); setBreakingMode(false); };

  const handleApplyStructuredInput = () => {
    const raw = structuredInput.trim();
    if (!raw) {
      toast({ title: "Input தேவை", description: "முழு செய்தி வடிவத்தை paste செய்யவும்.", variant: "destructive" });
      return;
    }

    const markers = [
      { key: "title",            labels: ["Title"] },
      { key: "slug",             labels: ["Slug"] },
      { key: "category",         labels: ["Category"] },
      { key: "excerpt",          labels: ["Summary", "Excerpt"] },
      { key: "content",          labels: ["Content"] },
      { key: "meta_data",        labels: ["Meta Data", "Metadata"] },
      { key: "meta_title",       labels: ["Meta Title"] },
      { key: "meta_description", labels: ["Meta Description"] },
      { key: "meta_keywords",    labels: ["Keywords", "Meta Keywords"] },
      { key: "hashtags",         labels: ["Hashtags"] },
      { key: "social_handles",   labels: ["Socials", "Social Handles", "Social Media Handles Mention", "Social Media"] },
      { key: "reels_script",     labels: ["Reels Script", "Reel Script", "Voiceover Script", "Voice Over Script", "Script"] },
    ] as const;

    const escapeRegExp = (v: string) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const markerMatchers = markers.map((m) => ({
      key: m.key,
      patterns: m.labels.map(
        (label) => new RegExp(`^\\s*\\*{0,2}\\s*${escapeRegExp(label)}\\s*\\*{0,2}\\s*:?\\s*(.*)$`, "i")
      ),
    }));

    const parseSections = (inputLines: string[]): Record<string, string> => {
      const result: Record<string, string> = {};
      let currentKey: string | null = null;
      let buffer: string[] = [];
      const flush = () => { if (currentKey) result[currentKey] = buffer.join("\n").trim(); };
      inputLines.forEach((line) => {
        let nextKey: string | null = null;
        let inlineValue = "";
        for (const marker of markerMatchers) {
          const matchedPattern = marker.patterns.find((p) => p.test(line));
          if (!matchedPattern) continue;
          const match = line.match(matchedPattern);
          nextKey = marker.key;
          inlineValue = match?.[1]?.trim() || "";
          break;
        }
        if (nextKey) { flush(); currentKey = nextKey; buffer = inlineValue ? [inlineValue] : []; }
        else if (currentKey) buffer.push(line);
      });
      flush();
      return result;
    };

    const sections = parseSections(raw.split(/\r?\n/));

    // ── Second pass: extract nested fields from "Meta Data:" section ──────
    if (sections.meta_data) {
      const sub = parseSections(sections.meta_data.split(/\r?\n/));
      if (sub.meta_title       && !sections.meta_title)       sections.meta_title       = sub.meta_title;
      if (sub.meta_description && !sections.meta_description) sections.meta_description = sub.meta_description;
      if (sub.meta_keywords    && !sections.meta_keywords)    sections.meta_keywords    = sub.meta_keywords;
      if (sub.hashtags         && !sections.hashtags)         sections.hashtags         = sub.hashtags;
      // Regex fallback for same-line format: "Meta Title: X, Meta Description: Y, Keywords: Z"
      if (!sections.meta_title) {
        const m = sections.meta_data.match(/Meta\s*Title\s*:\s*([^,\n]+)/i);
        if (m) sections.meta_title = m[1].trim();
      }
      if (!sections.meta_description) {
        const m = sections.meta_data.match(/Meta\s*Description\s*:\s*([^,\n]+)/i);
        if (m) sections.meta_description = m[1].trim();
      }
      if (!sections.meta_keywords) {
        const m = sections.meta_data.match(/Keywords?\s*:\s*([^\n]+)/i);
        if (m) sections.meta_keywords = m[1].trim();
      }
    }

    // ── Second pass: extract hashtags/handles from "Socials:" section ─────
    if (sections.social_handles) {
      const sub = parseSections(sections.social_handles.split(/\r?\n/));
      if (sub.hashtags && !sections.hashtags) sections.hashtags = sub.hashtags;
      // Regex fallback for same-line: "Hashtags: #a #b  Social Handles: @x"
      if (!sections.hashtags) {
        const m = sections.social_handles.match(/Hashtags?\s*:\s*(.+?)(?=Social\s*Handles?|$)/is);
        if (m) sections.hashtags = m[1].trim();
      }
    }

    const contentExtras = [
      sections.hashtags       ? `Hashtags: ${sections.hashtags}`       : "",
      sections.social_handles ? `Socials: ${sections.social_handles}`  : "",
    ].filter(Boolean);

    setForm((prev) => {
      const nextTitle = sections.title || prev.title;
      const nextSlug  = sections.slug  || buildSlug(nextTitle) || prev.slug;
      const nextContent = [sections.content || prev.content, ...contentExtras].filter(Boolean).join("\n\n");
      return {
        ...prev,
        title:            nextTitle,
        slug:             nextSlug,
        category:         sections.category         || prev.category,
        excerpt:          sections.excerpt           || prev.excerpt,
        content:          nextContent,
        meta_title:       sections.meta_title        || prev.meta_title,
        meta_description: sections.meta_description  || prev.meta_description,
      };
    });

    if (sections.reels_script) {
      setStructuredReelsScript(sections.reels_script);
      sessionStorage.setItem("trichy_pending_reels_script", sections.reels_script);
    }

    toast({ title: "செய்தி வடிவம் apply செய்யப்பட்டது" });
  };

  const handleAIGenerate = async () => {
    if (!aiSourceUrl.trim() && !aiSourceText.trim()) {
      toast({ title: "Input தேவை", description: "URL அல்லது notes கொடுக்கவும்.", variant: "destructive" });
      return;
    }
    setAiGenerating(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        toast({ title: "Login தேவை", description: "Please log in again.", variant: "destructive" });
        setAiGenerating(false);
        return;
      }
      const apiBase = (import.meta.env.VITE_API_URL as string | undefined) ?? "/api";
      const res = await fetch(`${apiBase}/ai/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          sourceUrl: aiSourceUrl.trim() || undefined,
          sourceText: aiSourceText.trim() || undefined,
          mode: aiMode,
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(errData.error || `Server error ${res.status}`);
      }
      const ai = await res.json() as {
        title?: string; slug?: string; category?: string; excerpt?: string; content?: string;
        reelsScript?: string; ytTitle?: string; ytDescription?: string; ytTags?: string[];
        imagePrompt?: string;
        meta_title?: string; meta_description?: string; meta_keywords?: string[];
      };
      setForm((prev) => ({
        ...prev,
        title: ai.title?.trim() || prev.title,
        slug: ai.slug?.trim() || buildSlug(ai.title || prev.title),
        category: ai.category?.trim() || prev.category,
        excerpt: ai.excerpt?.trim() || prev.excerpt,
        content: ai.content?.trim() || prev.content,
        meta_title: ai.meta_title?.trim() || prev.meta_title,
        meta_description: ai.meta_description?.trim() || prev.meta_description,
        meta_keywords: (ai.meta_keywords || []).join(", ") || prev.meta_keywords,
      }));
      setAiReelsScript(ai.reelsScript?.trim() || "");
      setAiYtTitle(ai.ytTitle?.trim() || "");
      setAiYtDescription(ai.ytDescription?.trim() || "");
      setAiYtTags(Array.isArray(ai.ytTags) ? ai.ytTags : []);
      setAiImagePrompt(ai.imagePrompt?.trim() || "");
      toast({ title: "AI content generated!", description: "Reels script + YouTube info ready below. Editor tab-ல் full article fill ஆகியிருக்கு." });
    } catch (err) {
      toast({ title: "AI generation தோல்வி", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    }
    setAiGenerating(false);
  };

  const handleBulkGenerateImages = async () => {
    if (!user) return;
    setBulkGenerating(true);
    const { data, error } = await supabase.functions.invoke("bulk-generate-news-thumbnails", { body: { limit: 12 } });
    if (error) {
      toast({ title: "Auto image generation தோல்வி", description: error.message, variant: "destructive" });
    } else {
      const result = (data || {}) as { processed?: number; updated?: number; failed?: Array<{ reason?: string }> };
      toast({
        title: "Auto image generation முடிந்தது",
        description: `Processed: ${result.processed || 0}, Updated: ${result.updated || 0}, Failed: ${result.failed?.length || 0}`,
        variant: result.failed?.length ? "destructive" : "default",
      });
      await fetchAdminState(user.id);
    }
    setBulkGenerating(false);
  };

  const handleSaveSocialSettings = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const webhook = webhookUrlInput.trim();
    if (!webhook) {
      toast({ title: "Webhook URL தேவை", variant: "destructive" });
      return;
    }
    if (!/^https?:\/\//i.test(webhook)) {
      toast({ title: "Webhook URL தவறானது", description: "https:// URL பயன்படுத்தவும்.", variant: "destructive" });
      return;
    }
    setSavingSocialSettings(true);
    const payload = { webhook_url: webhook, enabled: socialEnabled, secret_token: secretTokenInput.trim() || null, created_by: user.id };
    const { data, error } = await supabase
      .from("social_publish_settings")
      .upsert(socialSettings ? { ...payload, id: socialSettings.id } : payload)
      .select("id, webhook_url, enabled, secret_token")
      .single();
    if (error) {
      toast({ title: "Social settings சேமிக்க முடியவில்லை", description: error.message, variant: "destructive" });
    } else {
      const next = data as SocialPublishSettings;
      setSocialSettings(next);
      setWebhookUrlInput(next.webhook_url || "");
      setSecretTokenInput(next.secret_token || "");
      setSocialEnabled(!!next.enabled);
      toast({ title: "Social settings saved" });
    }
    setSavingSocialSettings(false);
  };

  const handleSaveYtLive = async () => {
    setSavingYtLive(true);
    try {
      await saveSiteSettingsToDB({ youtubeLiveUrl: ytLiveUrl.trim() });
      toast({ title: ytLiveUrl.trim() ? "YouTube Live URL சேமிக்கப்பட்டது" : "YouTube Live நீக்கப்பட்டது" });
    } catch {
      toast({ title: "சேமிக்க முடியவில்லை (DB)", description: "URL locally saved.", variant: "destructive" });
    } finally {
      setSavingYtLive(false);
    }
  };

  const handleSocialPushResult = (result: { success: boolean; skipped: boolean; error: string | null }) => {
    if (result.success) { toast({ title: "சமூக சேனல்களுக்கு அனுப்பப்பட்டது" }); return; }
    if (!result.skipped) toast({ title: "சமூக பகிர்வு தோல்வி", description: result.error || "Webhook error", variant: "destructive" });
  };

  const handleGoogleNewsPushResult = (result: { success: boolean; skipped: boolean; error: string | null; sitemapUrl?: string | null }) => {
    if (result.success) { toast({ title: "Google News sitemap update ஆனது" }); return; }
    if (!result.skipped) toast({ title: "Google News ping தோல்வி", description: result.error || "", variant: "destructive" });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!form.cover_image_url.trim() && !form.video_url.trim()) {
      toast({ title: "Media தேவை", description: "Image அல்லது video அவசியம்.", variant: "destructive" });
      return;
    }

    const finalSlug = form.slug.trim() || buildSlug(form.title);
    if (!finalSlug) {
      toast({ title: "Slug தேவை", variant: "destructive" });
      return;
    }

    // Breaking mode: auto-set category to அவசரம் if blank; always use excerpt as content
    const finalCategory = breakingMode && !form.category.trim() ? "அவசரம்" : form.category.trim();
    const finalContent = breakingMode ? form.excerpt.trim() : form.content.trim();

    const keywordArray = form.meta_keywords.split(",").map((k) => k.trim()).filter(Boolean);
    const isScheduled = !form.is_published && form.scheduled_at.trim() !== "";

    setSaving(true);

    const payload: Record<string, unknown> = {
      title: form.title.trim(),
      slug: finalSlug,
      category: finalCategory,
      excerpt: form.excerpt.trim() || null,
      content: finalContent,
      cover_image_url: form.cover_image_url.trim() || null,
      video_url: form.video_url.trim() || null,
      meta_title: form.meta_title.trim() || null,
      meta_description: form.meta_description.trim() || null,
      meta_keywords: keywordArray,
      is_published: form.is_published,
      published_at: form.is_published ? new Date().toISOString() : isScheduled ? form.scheduled_at : null,
    };

    const query = editingId
      ? supabase.from("news_posts").update(payload as never).eq("id", editingId).select("id, is_published, title, slug, excerpt").single()
      : supabase.from("news_posts").insert({ ...(payload as Record<string, unknown>), created_by: user.id } as never).select("id, is_published, title, slug, excerpt").single();

    const { data: savedPost, error } = await query;

    if (error) {
      toast({ title: "சேமிக்க முடியவில்லை", description: error.message, variant: "destructive" });
    } else {
      const statusMsg = isScheduled
        ? `Scheduled for ${new Date(form.scheduled_at).toLocaleString("ta-IN")}`
        : editingId ? "செய்தி புதுப்பிக்கப்பட்டது" : "செய்தி உருவாக்கப்பட்டது";
      toast({ title: statusMsg });

      if (savedPost?.is_published) {
        const p = savedPost as unknown as { id: string; title?: string; slug?: string; excerpt?: string };
        void fetch("/api/push/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: `Trichy Insight — ${p.title ?? "புதிய செய்தி"}`,
            body: p.excerpt ?? "புதிய செய்தி வந்தது!",
            url: `/news/${p.slug ?? ""}`,
          }),
        }).catch(() => {});

        const [socialResult, googleNewsResult] = await Promise.all([
          triggerSocialPublish(savedPost.id, "manual-form"),
          triggerGoogleNewsPublish(savedPost.id, "manual-form"),
          triggerZapierForEvent("article.published", savedPost.id),
          publishToDirectChannels(savedPost.id).then((r) => handleDirectPublishResult(savedPost.id, r)),
        ]);
        handleSocialPushResult(socialResult);
        handleGoogleNewsPushResult(googleNewsResult);
      } else if (isScheduled && savedPost?.id) {
        void triggerZapierForEvent("article.scheduled", savedPost.id);
      } else if (savedPost?.id) {
        void triggerZapierForEvent("article.draft_saved", savedPost.id);
      }

      resetForm();
      await fetchAdminState(user.id);
      setActiveTab("dashboard");
    }

    setSaving(false);
  };

  const handleEdit = (post: NewsPost) => {
    setEditingId(post.id);
    setForm({
      title: post.title,
      slug: post.slug,
      category: post.category,
      excerpt: post.excerpt || "",
      content: post.content,
      cover_image_url: post.cover_image_url || "",
      video_url: post.video_url || "",
      meta_title: post.meta_title || "",
      meta_description: post.meta_description || "",
      meta_keywords: (post.meta_keywords || []).join(", "),
      is_published: post.is_published,
      scheduled_at: "",
    });
    setActiveTab("editor");
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    const { error } = await supabase.from("news_posts").delete().eq("id", id);
    if (error) toast({ title: "நீக்க முடியவில்லை", description: error.message, variant: "destructive" });
    else { toast({ title: "செய்தி நீக்கப்பட்டது" }); await fetchAdminState(user.id); }
  };

  const handleIndexNow = async (post: NewsPost) => {
    if (!post.is_published) return;
    setIndexingSlug(prev => ({ ...prev, [post.slug]: "pending" }));
    try {
      const r = await fetch("/api/indexing/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: post.slug }),
      });
      const d = await r.json() as { success?: boolean };
      setIndexingSlug(prev => ({ ...prev, [post.slug]: d.success ? "ok" : "error" }));
      toast({ title: d.success ? "Google-க்கு அனுப்பப்பட்டது ✓" : "Indexing தோல்வி", description: `${post.title}` });
    } catch {
      setIndexingSlug(prev => ({ ...prev, [post.slug]: "error" }));
      toast({ title: "Indexing தோல்வி", variant: "destructive" });
    }
  };

  const handleTogglePublish = async (post: NewsPost) => {
    if (!user) return;
    const nextPublished = !post.is_published;
    const { error } = await supabase
      .from("news_posts")
      .update({ is_published: nextPublished, published_at: nextPublished ? new Date().toISOString() : null })
      .eq("id", post.id);

    if (error) toast({ title: "நிலை மாற்ற முடியவில்லை", description: error.message, variant: "destructive" });
    else {
      toast({ title: nextPublished ? "செய்தி வெளியிடப்பட்டது" : "வரைவு நிலைக்கு மாற்றப்பட்டது" });
      if (nextPublished) {
        const [socialResult, googleNewsResult] = await Promise.all([
          triggerSocialPublish(post.id, "toggle-publish"),
          triggerGoogleNewsPublish(post.id, "toggle-publish"),
          triggerZapierForEvent("article.published", post.id),
          publishToDirectChannels(post.id).then((r) => handleDirectPublishResult(post.id, r)),
        ]);
        handleSocialPushResult(socialResult);
        handleGoogleNewsPushResult(googleNewsResult);
      }
      await fetchAdminState(user.id);
    }
  };

  if (authLoading || checkingRole) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">சரிபார்க்கப்படுகிறது...</p>
      </main>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center px-4">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle className="font-heading text-2xl uppercase">Admin அனுமதி இல்லை</CardTitle>
            <CardDescription>உங்கள் account-க்கு admin role இல்லை.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">user_roles table-இல் admin role சேர்க்க வேண்டும்.</p>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="border-b bg-card sticky top-0 z-10">
        <div className="container flex items-center justify-between py-3">
          <div>
            <h1 className="font-heading text-2xl uppercase leading-tight">CMS Dashboard</h1>
            <p className="text-muted-foreground text-xs">Trichy Insight — Content Management</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => { resetForm(); setActiveTab("editor"); }}
            >
              <Plus className="h-4 w-4" /> New Article
            </Button>
            <Button size="sm" variant="outline" onClick={() => void signOut()}>
              <LogOut className="h-4 w-4" /> வெளியேறு
            </Button>
          </div>
        </div>
      </div>

      <div className="container py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6 w-full justify-start gap-1 h-auto flex-wrap">
            <TabsTrigger value="dashboard" className="gap-1.5">
              <BarChart3 className="h-4 w-4" /> Dashboard
            </TabsTrigger>
            <TabsTrigger value="editor" className="gap-1.5">
              <Pencil className="h-4 w-4" />
              {editingId ? "Edit Article" : "New Article"}
            </TabsTrigger>
            <TabsTrigger value="ai-workshop" className="gap-1.5">
              <Sparkles className="h-4 w-4" /> AI Workshop
            </TabsTrigger>
            <TabsTrigger value="channels" className="gap-1.5">
              <Globe className="h-4 w-4" /> Channels
            </TabsTrigger>
            <TabsTrigger value="aggregator" className="gap-1.5">
              <Rss className="h-4 w-4" /> Aggregator
            </TabsTrigger>
            <TabsTrigger value="zapier" className="gap-1.5">
              <Zap className="h-4 w-4" /> Zapier
            </TabsTrigger>
            <TabsTrigger value="ads" className="gap-1.5">
              <Megaphone className="h-4 w-4" /> Ads
            </TabsTrigger>
            <TabsTrigger value="videoreel" className="gap-1.5">
              <Clapperboard className="h-4 w-4" /> Video Reel
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-1.5">
              <Settings className="h-4 w-4" /> Settings
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-1.5">
              <Layers className="h-4 w-4" /> Analytics
            </TabsTrigger>
            <TabsTrigger value="indexing" className="gap-1.5">
              <Zap className="h-4 w-4" /> Indexing
            </TabsTrigger>
          </TabsList>

          {/* ─── DASHBOARD ──────────────────────────────── */}
          <TabsContent value="dashboard" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>மொத்த செய்திகள்</CardDescription>
                  <CardTitle className="text-3xl">{analytics.totalPosts}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>வெளியிடப்பட்டவை</CardDescription>
                  <CardTitle className="text-3xl">{analytics.publishedPosts}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>வரைவுகள்</CardDescription>
                  <CardTitle className="text-3xl">{analytics.totalPosts - analytics.publishedPosts}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>மொத்த பக்க பார்வைகள்</CardDescription>
                  <CardTitle className="text-3xl">{analytics.totalViews}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>நியூஸ்லெட்டர் சந்தாதாரர்கள்</CardDescription>
                  <CardTitle className="text-3xl">{analytics.newsletterSubscribers}</CardTitle>
                </CardHeader>
              </Card>
            </div>

            {/* ── Today's Output ─────────────────────────────── */}
            <div>
              <h3 className="font-heading text-base uppercase tracking-wide text-muted-foreground mb-3">Today's Output</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {(() => {
                  const n = todayArticles ?? 0;
                  const target = 10;
                  const pct = Math.min(100, Math.round((n / target) * 100));
                  const color = pct >= 80 ? "text-green-600" : pct >= 40 ? "text-amber-600" : "text-red-500";
                  const bar = pct >= 80 ? "bg-green-500" : pct >= 40 ? "bg-amber-500" : "bg-red-500";
                  return (
                    <Card>
                      <CardHeader className="pb-1">
                        <CardDescription className="flex items-center gap-1.5">
                          <Pencil className="h-3.5 w-3.5" /> Articles Today
                        </CardDescription>
                        <CardTitle className={`text-3xl font-bold ${color}`}>
                          {n} <span className="text-base font-normal text-muted-foreground">/ {target}</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0 pb-4">
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div className={`h-full ${bar} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1.5">
                          {pct >= 80 ? "Target reached!" : pct >= 40 ? `${target - n} more to reach daily goal` : `Daily target: ${target} articles`}
                        </p>
                      </CardContent>
                    </Card>
                  );
                })()}
                {(() => {
                  const n = todayReels ?? 0;
                  const target = 5;
                  const pct = Math.min(100, Math.round((n / target) * 100));
                  const color = pct >= 80 ? "text-green-600" : pct >= 40 ? "text-amber-600" : "text-red-500";
                  const bar = pct >= 80 ? "bg-green-500" : pct >= 40 ? "bg-amber-500" : "bg-red-500";
                  return (
                    <Card>
                      <CardHeader className="pb-1">
                        <CardDescription className="flex items-center gap-1.5">
                          <Clapperboard className="h-3.5 w-3.5" /> Reels Today
                        </CardDescription>
                        <CardTitle className={`text-3xl font-bold ${color}`}>
                          {n} <span className="text-base font-normal text-muted-foreground">/ {target}</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0 pb-4">
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div className={`h-full ${bar} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1.5">
                          {pct >= 80 ? "Target reached!" : pct >= 40 ? `${target - n} more to reach daily goal` : `Daily target: ${target} reels`}
                        </p>
                      </CardContent>
                    </Card>
                  );
                })()}
              </div>
            </div>

            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle className="font-heading text-lg uppercase">All Articles</CardTitle>
                    <CardDescription>Top Category: {topCategory}</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={handleBulkGenerateImages} disabled={bulkGenerating}>
                      <Zap className="h-4 w-4" />
                      {bulkGenerating ? "Generating..." : "Bulk AI Images"}
                    </Button>
                  </div>
                </div>
                <div className="relative mt-3">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                  <Input
                    placeholder="தேடு — தலைப்பு, வகை, சுருக்கம்..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 pr-8 h-8 text-sm"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {loadingPosts ? (
                  <p className="text-muted-foreground text-sm">ஏற்றப்படுகிறது...</p>
                ) : posts.length === 0 ? (
                  <p className="text-muted-foreground text-sm">எந்த செய்தியும் இல்லை.</p>
                ) : filteredPosts.length === 0 ? (
                  <p className="text-muted-foreground text-sm">"{searchQuery}" க்கு எந்த செய்தியும் இல்லை.</p>
                ) : (
                  <div className="space-y-2">
                    {filteredPosts.map((post) => {
                      const isScheduled = !post.is_published && post.published_at && new Date(post.published_at) > new Date();
                      return (
                        <div
                          key={post.id}
                          className="flex flex-wrap items-center gap-3 py-3 border-b border-border last:border-0"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{post.title}</p>
                            <div className="flex flex-wrap items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-xs">{post.category}</Badge>
                              {post.is_published ? (
                                <Badge className="text-xs bg-green-100 text-green-700">Published</Badge>
                              ) : isScheduled ? (
                                <Badge className="text-xs bg-yellow-100 text-yellow-700">
                                  <Calendar className="h-3 w-3 mr-1" />
                                  Scheduled
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="text-xs">Draft</Badge>
                              )}
                              <span className="text-xs text-muted-foreground">
                                {new Date(post.created_at).toLocaleDateString("ta-IN")}
                              </span>
                            </div>
                            {/* Channel publish result badges */}
                            {lastPublishResults[post.id] && (() => {
                              const r = lastPublishResults[post.id];
                              const items = [
                                { key: "facebook", label: "FB", ok: r.facebook?.success, bg: "bg-blue-100", text: "text-blue-700" },
                                { key: "instagram", label: "IG", ok: r.instagram?.success, bg: "bg-pink-100", text: "text-pink-700" },
                                { key: "whatsapp", label: "WA", ok: r.whatsapp?.success, bg: "bg-green-100", text: "text-green-700" },
                                { key: "twitter", label: "TW", ok: r.twitter?.success, bg: "bg-gray-100", text: "text-gray-700" },
                                { key: "bluesky", label: "BS", ok: r.bluesky?.success, bg: "bg-sky-100", text: "text-sky-700" },
                              ].filter((i) => {
                                const ch = r[i.key as keyof typeof r];
                                return ch !== null && ch !== undefined;
                              });
                              if (!items.length) return null;
                              return (
                                <div className="flex flex-wrap items-center gap-1 mt-1">
                                  {items.map((i) => (
                                    <span
                                      key={i.key}
                                      className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold ${i.ok ? `${i.bg} ${i.text}` : "bg-red-100 text-red-600"}`}
                                      title={i.ok ? `${i.label} — published` : `${i.label} — failed`}
                                    >
                                      {i.ok
                                        ? <CheckCircle2 className="h-3 w-3" />
                                        : <XCircle className="h-3 w-3" />
                                      }
                                      {i.label}
                                    </span>
                                  ))}
                                </div>
                              );
                            })()}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <ArticleMediaUpdater postId={post.id} userId={user.id} onUpdated={() => fetchAdminState(user.id)} />
                            {post.is_published && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className={`h-8 w-8 ${
                                  indexingSlug[post.slug] === "ok" ? "text-green-600 hover:text-green-700" :
                                  indexingSlug[post.slug] === "error" ? "text-red-500 hover:text-red-600" :
                                  "text-yellow-500 hover:text-yellow-600 hover:bg-yellow-50"
                                }`}
                                title="Google-ல் உடனடியாக Index செய்"
                                disabled={indexingSlug[post.slug] === "pending"}
                                onClick={() => void handleIndexNow(post)}
                              >
                                {indexingSlug[post.slug] === "pending"
                                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  : indexingSlug[post.slug] === "ok"
                                  ? <CheckCircle2 className="h-3.5 w-3.5" />
                                  : indexingSlug[post.slug] === "error"
                                  ? <XCircle className="h-3.5 w-3.5" />
                                  : <Zap className="h-3.5 w-3.5" />
                                }
                              </Button>
                            )}
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                              title="Create Reel"
                              onClick={() => setReelArticle({
                                id: post.id,
                                title: post.title,
                                excerpt: post.excerpt ?? null,
                                cover_image_url: post.cover_image_url ?? null,
                                category: post.category,
                                slug: post.slug,
                              })}
                            >
                              <Clapperboard className="h-3.5 w-3.5" />
                            </Button>
                            <Switch
                              checked={post.is_published}
                              onCheckedChange={() => void handleTogglePublish(post)}
                              title={post.is_published ? "Unpublish" : "Publish"}
                            />
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleEdit(post)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => { if (confirm("இந்த செய்தியை நீக்கவா?")) void handleDelete(post.id); }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── EDITOR ──────────────────────────────────── */}
          <TabsContent value="editor">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <form onSubmit={(e) => void handleSubmit(e)} className="space-y-6">

                  {/* Breaking Mode / Full Article toggle */}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setBreakingMode(false)}
                      className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg border text-sm font-medium transition-colors ${
                        !breakingMode
                          ? "border-violet-600 bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:border-violet-500"
                          : "border-border text-muted-foreground hover:bg-muted/50"
                      }`}
                    >
                      <Pencil className="h-4 w-4" /> Full Article
                      <span className="text-[10px] opacity-70">300+ words</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setBreakingMode(true)}
                      className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg border text-sm font-medium transition-colors ${
                        breakingMode
                          ? "border-red-600 bg-red-50 text-red-700 dark:bg-red-950/30 dark:border-red-500"
                          : "border-border text-muted-foreground hover:bg-muted/50"
                      }`}
                    >
                      <Zap className="h-4 w-4" /> Breaking Flash
                      <span className="text-[10px] opacity-70">30-50 words</span>
                    </button>
                  </div>
                  {breakingMode && (
                    <div className="text-xs bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2 text-red-700 dark:text-red-400">
                      🔴 Breaking mode: Category auto-set to அவசரம் · Excerpt is the content · Fast publish
                    </div>
                  )}

                  <Card>
                    <CardHeader>
                      <CardTitle className="font-heading text-lg uppercase">
                        {editingId ? "Edit Article" : "Create Article"}
                      </CardTitle>
                      <CardDescription>Quick fill via structured input or AI Workshop</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="structured-input">Paste Structured Content</Label>
                        <Textarea
                          id="structured-input"
                          rows={4}
                          placeholder={`Title: ...\nSlug: ...\nCategory: ...\nSummary: ...\nContent: ...\nMeta Title: ...\nMeta Description: ...\nHashtags: ...\nSocials: ...\nReels Script: ...`}
                          value={structuredInput}
                          onChange={(e) => setStructuredInput(e.target.value)}
                        />
                        <Button type="button" size="sm" variant="secondary" onClick={handleApplyStructuredInput}>
                          <Layers className="h-4 w-4" /> Apply Structured Input
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="font-heading text-lg uppercase">Article Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="title">Title *</Label>
                        <Input
                          id="title"
                          required
                          value={form.title}
                          onChange={(e) => setForm((p) => ({ ...p, title: e.target.value, slug: buildSlug(e.target.value) }))}
                          placeholder="செய்தி தலைப்பு"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="slug">Slug</Label>
                          <Input
                            id="slug"
                            value={form.slug}
                            onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value }))}
                            placeholder="news-slug-here"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="category">Category *</Label>
                          <Input
                            id="category"
                            required
                            value={form.category}
                            onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                            placeholder="அரசியல், வணிகம்..."
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="excerpt">
                            {breakingMode ? "Flash Excerpt *" : "Excerpt"}
                          </Label>
                          {breakingMode && (
                            <Badge
                              variant="outline"
                              className={`text-xs ${excerptWordCount > 60 ? "border-red-500 text-red-600 bg-red-50" : "border-muted-foreground text-muted-foreground"}`}
                            >
                              {excerptWordCount} words{excerptWordCount > 60 ? " — too long!" : " / 60 max"}
                            </Badge>
                          )}
                        </div>
                        <Textarea
                          id="excerpt"
                          rows={breakingMode ? 4 : 2}
                          required={breakingMode}
                          value={form.excerpt}
                          onChange={(e) => setForm((p) => ({ ...p, excerpt: e.target.value }))}
                          placeholder={breakingMode ? "30–50 word breaking flash in Tamil..." : "சுருக்கமான விளக்கம்..."}
                          className={breakingMode && excerptWordCount > 60 ? "border-red-400 focus-visible:ring-red-400" : ""}
                        />
                      </div>

                      {!breakingMode && (
                        <div className="space-y-2">
                          <Label htmlFor="content">Content *</Label>
                          <Textarea
                            id="content"
                            rows={12}
                            required
                            value={form.content}
                            onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))}
                            placeholder="முழு செய்தி உள்ளடக்கம்..."
                            className="font-mono text-sm"
                          />
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="font-heading text-lg uppercase">SEO Meta</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="meta_title">Meta Title</Label>
                        <Input
                          id="meta_title"
                          value={form.meta_title}
                          onChange={(e) => setForm((p) => ({ ...p, meta_title: e.target.value }))}
                          placeholder="SEO title (50-60 chars)"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="meta_description">Meta Description</Label>
                        <Textarea
                          id="meta_description"
                          rows={3}
                          value={form.meta_description}
                          onChange={(e) => setForm((p) => ({ ...p, meta_description: e.target.value }))}
                          placeholder="SEO description (120-160 chars)"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="meta_keywords">Keywords (comma-separated)</Label>
                        <Input
                          id="meta_keywords"
                          value={form.meta_keywords}
                          onChange={(e) => setForm((p) => ({ ...p, meta_keywords: e.target.value }))}
                          placeholder="trichy, news, local..."
                        />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="font-heading text-lg uppercase">Media</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <AdminMediaFields
                        userId={user.id}
                        imageUrl={form.cover_image_url}
                        videoUrl={form.video_url}
                        aiContext={{ title: form.title, category: form.category, excerpt: form.excerpt }}
                        onImageUrlChange={(url: string) => setForm((p) => ({ ...p, cover_image_url: url }))}
                        onVideoUrlChange={(url: string) => setForm((p) => ({ ...p, video_url: url }))}
                      />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="font-heading text-lg uppercase flex items-center gap-2">
                        <Calendar className="h-5 w-5" /> Publishing
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Publish Now</Label>
                          <p className="text-xs text-muted-foreground mt-1">
                            {form.is_published ? "Article will go live immediately." : "Save as draft."}
                          </p>
                        </div>
                        <Switch
                          checked={form.is_published}
                          onCheckedChange={(checked) => setForm((p) => ({ ...p, is_published: checked, scheduled_at: checked ? "" : p.scheduled_at }))}
                        />
                      </div>

                      {!form.is_published && (
                        <div className="space-y-2">
                          <Label htmlFor="scheduled_at">Schedule for Later (Optional)</Label>
                          <Input
                            id="scheduled_at"
                            type="datetime-local"
                            value={form.scheduled_at}
                            min={new Date().toISOString().slice(0, 16)}
                            onChange={(e) => setForm((p) => ({ ...p, scheduled_at: e.target.value }))}
                          />
                          {form.scheduled_at && (
                            <p className="text-xs text-yellow-600">
                              Scheduled: {new Date(form.scheduled_at).toLocaleString("ta-IN")}
                            </p>
                          )}
                        </div>
                      )}

                      <div className="flex gap-3 pt-2">
                        <Button
                          type="submit"
                          disabled={saving}
                          className={`flex-1 ${breakingMode ? "bg-red-600 hover:bg-red-700 text-white" : ""}`}
                        >
                          {saving
                            ? "சேமிக்கப்படுகிறது..."
                            : breakingMode
                              ? "🔴 Flash Publish"
                              : form.is_published
                                ? "Publish Article"
                                : form.scheduled_at
                                  ? "Schedule Article"
                                  : "Save Draft"}
                        </Button>
                        <Button type="button" variant="outline" onClick={resetForm}>
                          Cancel
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </form>
              </div>

              <div className="space-y-4">
                <AdminSEOPanel form={form} />
              </div>
            </div>
          </TabsContent>

          {/* ─── AI WORKSHOP ─────────────────────────────── */}
          <TabsContent value="ai-workshop" className="space-y-6">
            <div>
              <h2 className="font-heading text-xl uppercase">AI Content Workshop</h2>
              <p className="text-muted-foreground text-sm mt-1">
                AI-powered tools to generate, enhance, and auto-publish Tamil news content.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <AdminAIAssistant
                  sourceUrl={aiSourceUrl}
                  sourceText={aiSourceText}
                  generating={aiGenerating}
                  mode={aiMode}
                  onSourceUrlChange={setAiSourceUrl}
                  onSourceTextChange={setAiSourceText}
                  onModeChange={setAiMode}
                  onGenerate={() => void handleAIGenerate()}
                />
                {(aiReelsScript || aiYtTitle || aiYtDescription || aiYtTags.length > 0 || aiImagePrompt) && (
                  <div className="space-y-3">
                    {aiReelsScript && (
                      <Card className="border-red-200 dark:border-red-800">
                        <CardHeader className="pb-2 pt-3 px-4">
                          <CardTitle className="text-sm flex items-center gap-2">
                            🎬 YouTube Shorts Script <span className="text-xs font-normal text-muted-foreground">(45–55 sec)</span>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="px-4 pb-3 space-y-2">
                          <Textarea
                            readOnly
                            rows={10}
                            value={aiReelsScript}
                            className="text-xs font-mono resize-none border-l-2 border-red-400 rounded-l-none focus-visible:ring-0"
                          />
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="w-full border-red-300 text-red-700 hover:bg-red-50"
                            onClick={() => { void navigator.clipboard.writeText(aiReelsScript); toast({ title: "Script copied!" }); }}
                          >
                            Copy Script
                          </Button>
                        </CardContent>
                      </Card>
                    )}

                    {(aiYtTitle || aiYtDescription) && (
                      <Card className="border-blue-200 dark:border-blue-800">
                        <CardHeader className="pb-2 pt-3 px-4">
                          <CardTitle className="text-sm flex items-center gap-2">
                            📺 YouTube Title &amp; Description
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="px-4 pb-3 space-y-3">
                          {aiYtTitle && (
                            <div className="space-y-1">
                              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Title</p>
                              <div className="flex gap-2 items-start">
                                <p className="text-sm font-heading flex-1 bg-muted/50 rounded px-2 py-1.5 leading-snug">{aiYtTitle}</p>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="shrink-0 text-blue-600 h-7 px-2"
                                  onClick={() => { void navigator.clipboard.writeText(aiYtTitle); toast({ title: "YT title copied!" }); }}
                                >
                                  Copy
                                </Button>
                              </div>
                            </div>
                          )}
                          {aiYtDescription && (
                            <div className="space-y-1">
                              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Description</p>
                              <Textarea
                                readOnly
                                rows={5}
                                value={aiYtDescription}
                                className="text-xs resize-none border-l-2 border-blue-400 rounded-l-none focus-visible:ring-0"
                              />
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="w-full border-blue-300 text-blue-700 hover:bg-blue-50"
                                onClick={() => { void navigator.clipboard.writeText(aiYtDescription); toast({ title: "Description copied!" }); }}
                              >
                                Copy Description
                              </Button>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )}

                    {aiYtTags.length > 0 && (
                      <Card className="border-green-200 dark:border-green-800">
                        <CardHeader className="pb-2 pt-3 px-4">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-sm flex items-center gap-2">
                              🏷️ YouTube Tags <span className="text-xs font-normal text-muted-foreground">({aiYtTags.length} tags)</span>
                            </CardTitle>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2 text-xs text-green-700"
                              onClick={() => { void navigator.clipboard.writeText(aiYtTags.join(", ")); toast({ title: "Tags copied!" }); }}
                            >
                              Copy All
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent className="px-4 pb-3">
                          <div className="flex flex-wrap gap-1.5">
                            {aiYtTags.map((tag, i) => (
                              <span
                                key={i}
                                className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] bg-green-50 dark:bg-green-900/30 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-700 cursor-pointer hover:bg-green-100"
                                onClick={() => { void navigator.clipboard.writeText(tag); }}
                                title="Click to copy tag"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-2">Click any tag to copy individually · Click "Copy All" for comma-separated list</p>
                        </CardContent>
                      </Card>
                    )}

                    {aiImagePrompt && (
                      <Card className="border-yellow-200 dark:border-yellow-800">
                        <CardHeader className="pb-2 pt-3 px-4">
                          <CardTitle className="text-sm flex items-center gap-2">
                            🎨 Image Prompt
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="px-4 pb-3 space-y-2">
                          <Textarea
                            readOnly
                            rows={4}
                            value={aiImagePrompt}
                            className="text-xs font-mono resize-none focus-visible:ring-0"
                          />
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="w-full border-yellow-400 text-yellow-700 hover:bg-yellow-50"
                            onClick={() => { void navigator.clipboard.writeText(aiImagePrompt); toast({ title: "Image prompt copied!" }); }}
                          >
                            Copy Prompt
                          </Button>
                          <p className="text-[11px] text-muted-foreground text-center">
                            Paste into DALL·E / Midjourney / Ideogram to generate cover art
                          </p>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}
                <Card className="border-dashed">
                  <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground">
                      <strong>Workflow:</strong> AI generates article + Reels script + Image prompt → fills Editor tab → you review &amp; publish.
                      Click "AI Generate" above, then go to the <strong>Editor</strong> tab to review, add media, and publish.
                    </p>
                  </CardContent>
                </Card>
              </div>

              <AdminNewsChatComposer
                userId={user.id}
                onPostCreated={() => fetchAdminState(user.id)}
              />
            </div>
          </TabsContent>

          {/* ─── CHANNELS ────────────────────────────────── */}
          <TabsContent value="channels">
            <AdminChannelConfig />
          </TabsContent>

          {/* ─── AGGREGATOR ──────────────────────────────── */}
          <TabsContent value="aggregator">
            <AdminNewsAggregator />
          </TabsContent>

          {/* ─── ZAPIER ──────────────────────────────────── */}
          <TabsContent value="zapier">
            <AdminZapierPanel />
          </TabsContent>

          {/* ─── ADS ─────────────────────────────────────── */}
          <TabsContent value="ads" className="space-y-6">
            <div>
              <h2 className="font-heading text-xl uppercase">விளம்பர மேலாண்மை</h2>
              <p className="text-muted-foreground text-sm mt-1">விளம்பரங்களை சேர்க்கவும், திருத்தவும், நிர்வகிக்கவும். தளத்தின் பல்வேறு இடங்களில் காட்ட slot-ஐ தேர்ந்தெடுக்கவும்.</p>
            </div>
            <AdminAdManager />
          </TabsContent>

          {/* ─── VIDEO REEL ─────────────────────────────── */}
          <TabsContent value="videoreel">
            <AdminVideoReelPublisher initialVoiceoverScript={structuredReelsScript} onVoiceoverScriptConsumed={() => setStructuredReelsScript("")} />
          </TabsContent>

          {/* ─── SETTINGS ────────────────────────────────── */}
          <TabsContent value="settings" className="space-y-6">
            <div>
              <h2 className="font-heading text-xl uppercase">Settings</h2>
              <p className="text-muted-foreground text-sm mt-1">White-label site configuration, social accounts, categories, and publishing settings.</p>
            </div>

            {/* ── Site Settings (White-label config) ──────────── */}
            <AdminSiteSettings />

            {/* ── YouTube Live ───────────────────────────────── */}
            <Card className="max-w-xl border-red-200 dark:border-red-900">
              <CardHeader>
                <CardTitle className="font-heading text-lg uppercase flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600" />
                  </span>
                  YouTube Live Embed
                </CardTitle>
                <CardDescription>
                  Home page-ல் நேரலை embed செய்ய YouTube URL அல்லது Video ID paste செய்யவும்.
                  URL நீக்கினால் section மறைந்து போகும்.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="yt-live-url">YouTube Live URL or Video ID</Label>
                  <Input
                    id="yt-live-url"
                    value={ytLiveUrl}
                    onChange={(e) => setYtLiveUrl(e.target.value)}
                    placeholder="https://www.youtube.com/live/VIDEO_ID அல்லது youtu.be/..."
                    disabled={savingYtLive}
                  />
                  {ytLiveUrl.trim() && (
                    <p className={`text-xs ${extractYouTubeId(ytLiveUrl) ? "text-green-600" : "text-red-500"}`}>
                      {extractYouTubeId(ytLiveUrl)
                        ? `✓ Video ID: ${extractYouTubeId(ytLiveUrl)} — home page-ல் காட்டப்படும்`
                        : "⚠ YouTube URL அல்லது ID அங்கீகரிக்கப்படவில்லை"}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => void handleSaveYtLive()} disabled={savingYtLive} className="flex-1">
                    {savingYtLive ? "சேமிக்கப்படுகிறது..." : ytLiveUrl.trim() ? "Save & Go Live" : "Save (Remove Live)"}
                  </Button>
                  {ytLiveUrl.trim() && (
                    <Button variant="outline" onClick={() => { setYtLiveUrl(""); }} className="text-red-600 border-red-300 hover:bg-red-50">
                      Clear
                    </Button>
                  )}
                </div>

                <div className="bg-muted/50 rounded-lg p-3 space-y-1.5 text-xs text-muted-foreground">
                  <p className="font-medium text-foreground">Supabase SQL (one-time setup):</p>
                  <pre className="bg-background rounded p-2 text-[11px] overflow-x-auto border">{`create table if not exists site_settings (
  id integer primary key default 1,
  youtube_live_url text default '',
  updated_at timestamptz default now()
);
insert into site_settings (id) values (1) on conflict (id) do nothing;`}</pre>
                  <p>இந்த SQL-ஐ Supabase SQL Editor-ல் ஒரே ஒரு முறை run செய்யவும்.
                     Table இல்லாமலும் URL locally cached ஆகும்.</p>
                </div>
              </CardContent>
            </Card>

            <Card className="max-w-xl">
              <CardHeader>
                <CardTitle className="font-heading text-lg uppercase">Social Auto Post Webhook</CardTitle>
                <CardDescription>Publish ஆனதும் Zapier/Make webhook-க்கு அனுப்பப்படும்.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={(e) => void handleSaveSocialSettings(e)} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="social-webhook-url">Webhook URL</Label>
                    <Input
                      id="social-webhook-url"
                      placeholder="https://hooks.zapier.com/..."
                      value={webhookUrlInput}
                      onChange={(e) => setWebhookUrlInput(e.target.value)}
                      disabled={savingSocialSettings}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="social-secret-token">Secret Token (Optional)</Label>
                    <Input
                      id="social-secret-token"
                      type="password"
                      placeholder="Optional security token"
                      value={secretTokenInput}
                      onChange={(e) => setSecretTokenInput(e.target.value)}
                      disabled={savingSocialSettings}
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    <Switch
                      id="social-enabled"
                      checked={socialEnabled}
                      onCheckedChange={setSocialEnabled}
                      disabled={savingSocialSettings}
                    />
                    <Label htmlFor="social-enabled">
                      {socialEnabled ? "Social auto-post enabled" : "Social auto-post disabled"}
                    </Label>
                  </div>

                  <Button type="submit" disabled={savingSocialSettings}>
                    {savingSocialSettings ? "சேமிக்கப்படுகிறது..." : "Save Settings"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="max-w-2xl">
              <CardHeader>
                <CardTitle className="font-heading text-lg uppercase">Headless CMS API</CardTitle>
                <CardDescription>Access your content programmatically from any app or platform.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5 text-sm">

                {/* Read endpoints */}
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Public Read Endpoints</p>
                  <div className="space-y-2">
                    {[
                      { method: "GET", color: "bg-green-600", path: "/api/posts", desc: "List published articles (supports ?page, ?limit, ?category)" },
                      { method: "GET", color: "bg-green-600", path: "/api/posts/:slug", desc: "Get single article by slug" },
                      { method: "GET", color: "bg-green-600", path: "/api/categories", desc: "List all categories with article counts" },
                      { method: "GET", color: "bg-green-600", path: "/api/rss.xml", desc: "RSS feed of latest 50 published articles" },
                    ].map((ep) => (
                      <div key={ep.path} className="flex items-start gap-3 bg-muted rounded-lg p-3">
                        <Badge className={`shrink-0 ${ep.color} text-white text-xs`}>{ep.method}</Badge>
                        <div>
                          <code className="text-xs font-mono">{ep.path}</code>
                          <p className="text-xs text-muted-foreground mt-0.5">{ep.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Article creation endpoint */}
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Article Creation (Inbound)</p>
                  <div className="space-y-2">
                    <div className="flex items-start gap-3 bg-muted rounded-lg p-3">
                      <Badge className="shrink-0 bg-blue-600 text-white text-xs">POST</Badge>
                      <div className="min-w-0">
                        <code className="text-xs font-mono">/api/zapier/article</code>
                        <p className="text-xs text-muted-foreground mt-0.5">Create a new article from any external source (Zapier, n8n, Make, custom scripts)</p>
                      </div>
                    </div>
                  </div>

                  {/* Auth */}
                  <div className="mt-3 rounded-lg border border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20 dark:border-yellow-800 p-3">
                    <p className="text-xs font-semibold text-yellow-800 dark:text-yellow-400 mb-1">Authentication</p>
                    <code className="text-xs font-mono text-yellow-900 dark:text-yellow-300">x-zapier-inbound-secret: &lt;ZAPIER_INBOUND_SECRET&gt;</code>
                    <p className="text-xs text-yellow-700 dark:text-yellow-500 mt-1">Set <code className="font-mono">ZAPIER_INBOUND_SECRET</code> in your environment secrets. If unset, the endpoint is open (not recommended for production).</p>
                  </div>

                  {/* Fields */}
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-muted p-3">
                      <p className="text-xs font-semibold mb-2">Required fields</p>
                      {["title", "category", "content"].map(f => (
                        <div key={f} className="flex items-center gap-1.5 mb-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                          <code className="text-xs font-mono">{f}</code>
                        </div>
                      ))}
                      <div className="flex items-start gap-1.5 mb-1 mt-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0 mt-1" />
                        <div>
                          <code className="text-xs font-mono">cover_image_url</code>
                          <p className="text-xs text-muted-foreground">or <code className="font-mono">video_url</code> (one required)</p>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-lg bg-muted p-3">
                      <p className="text-xs font-semibold mb-2">Optional fields</p>
                      {["slug", "excerpt", "meta_title", "meta_description", "meta_keywords", "publish"].map(f => (
                        <div key={f} className="flex items-center gap-1.5 mb-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 shrink-0" />
                          <code className="text-xs font-mono">{f}</code>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Example */}
                  <div className="mt-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-semibold">Example request body</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs px-2"
                        onClick={() => {
                          const example = JSON.stringify({
                            title: "திருச்சியில் புதிய மெட்ரோ திட்டம் அறிவிப்பு",
                            category: "நகர்ப்புற வளர்ச்சி",
                            excerpt: "மத்திய அரசு திருச்சி மெட்ரோ ரயில் திட்டத்திற்கு ஒப்புதல் அளித்தது.",
                            content: "முழு கட்டுரை உள்ளடக்கம் இங்கே...",
                            cover_image_url: "https://example.com/image.jpg",
                            publish: true
                          }, null, 2);
                          navigator.clipboard.writeText(example);
                        }}
                      >
                        Copy
                      </Button>
                    </div>
                    <pre className="text-xs font-mono bg-muted rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">{JSON.stringify({
                      title: "திருச்சியில் புதிய மெட்ரோ திட்டம் அறிவிப்பு",
                      category: "நகர்ப்புற வளர்ச்சி",
                      excerpt: "மத்திய அரசு திருச்சி மெட்ரோ ரயில் திட்டத்திற்கு ஒப்புதல் அளித்தது.",
                      content: "முழு கட்டுரை உள்ளடக்கம் இங்கே...",
                      cover_image_url: "https://example.com/image.jpg",
                      publish: true
                    }, null, 2)}</pre>
                  </div>

                  {/* Response */}
                  <div className="mt-3">
                    <p className="text-xs font-semibold mb-1">Success response <span className="font-normal text-muted-foreground">(201 Created)</span></p>
                    <pre className="text-xs font-mono bg-muted rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">{JSON.stringify({ created: true, id: "uuid", slug: "article-slug", title: "...", is_published: true, url: "/news/article-slug" }, null, 2)}</pre>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground border-t pt-3">
                  The inbound article API is used by Zapier, n8n, Make, and the AI Workshop generator. Set <code className="font-mono">ZAPIER_INBOUND_SECRET</code> to secure it.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── ANALYTICS ───────────────────────────────── */}
          <TabsContent value="analytics" className="space-y-6">
            <div>
              <h2 className="font-heading text-xl uppercase">Analytics Dashboard</h2>
              <p className="text-muted-foreground text-sm mt-1">கடந்த 30 நாட்களில் தளத்தில் பார்வைகள், செல்வாக்கான செய்திகள், பிரிவு பகுப்பாய்வு.</p>
            </div>
            <AdminAnalytics />
          </TabsContent>

          {/* ─── INDEXING ────────────────────────────────── */}
          <TabsContent value="indexing" className="space-y-6">
            <AdminIndexing />
          </TabsContent>
        </Tabs>
      </div>

      {/* Reel Creator modal */}
      <AdminReelCreator
        article={reelArticle}
        onClose={() => setReelArticle(null)}
      />
    </main>
  );
};

export default Admin;
