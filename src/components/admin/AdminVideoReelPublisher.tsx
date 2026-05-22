import { useState, useEffect } from "react";
import {
  CheckCircle2, Download, Film, Loader2, Upload, XCircle, Youtube,
  Instagram, Facebook, Mic, ImageIcon, FileText, Save, AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { loadDirectChannelsDB, loadAppSettings, saveAppSettings } from "@/lib/channel-publish";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type NewsPost = Pick<Tables<"news_posts">, "id" | "title" | "slug" | "category" | "excerpt" | "cover_image_url" | "is_published">;

type StepStatus = "idle" | "running" | "done" | "error" | "skipped";

interface PublishStep {
  id: string;
  label: string;
  status: StepStatus;
  detail?: string;
  link?: { href: string; label: string };
}

interface StreamEvent {
  step: string;
  status?: string;
  error?: string;
  detail?: string;
  mediaId?: string;
  videoId?: string;
  postId?: string;
  videoUrl?: string;
  success?: boolean;
}

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "/api";

interface Props {
  initialVoiceoverScript?: string;
  onVoiceoverScriptConsumed?: () => void;
}

function stepIcon(status: StepStatus) {
  if (status === "running") return <Loader2 className="h-4 w-4 animate-spin text-blue-500 shrink-0" />;
  if (status === "done") return <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />;
  if (status === "error") return <XCircle className="h-4 w-4 text-red-500 shrink-0" />;
  if (status === "skipped") return <div className="h-4 w-4 rounded-full border-2 border-muted shrink-0" />;
  return <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30 shrink-0" />;
}

function buildInitialSteps(
  publishToInstagram: boolean,
  publishToYoutube: boolean,
  publishToFacebook: boolean,
  needUpload: boolean,
): PublishStep[] {
  const steps: PublishStep[] = [
    { id: "voiceover", label: "Generating voiceover (TTS)", status: "idle" },
    { id: "render", label: "Rendering video (FFmpeg)", status: "idle" },
  ];
  if (needUpload) steps.push({ id: "upload", label: "Uploading to cloud storage", status: "idle" });
  if (publishToInstagram) steps.push({ id: "instagram", label: "Publishing to Instagram", status: "idle" });
  if (publishToYoutube) steps.push({ id: "youtube", label: "Publishing to YouTube", status: "idle" });
  if (publishToFacebook) steps.push({ id: "facebook", label: "Publishing to Facebook", status: "idle" });
  return steps;
}

export default function AdminVideoReelPublisher({ initialVoiceoverScript, onVoiceoverScriptConsumed }: Props = {}) {
  const { toast } = useToast();

  const [posts, setPosts] = useState<NewsPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [selectedPost, setSelectedPost] = useState<NewsPost | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [voiceoverScript, setVoiceoverScript] = useState("");

  useEffect(() => {
    const pending = sessionStorage.getItem("trichy_pending_reels_script");
    if (pending?.trim()) {
      setVoiceoverScript(pending.trim());
      sessionStorage.removeItem("trichy_pending_reels_script");
      onVoiceoverScriptConsumed?.();
      toast({ title: "Reels Script பூர்த்தி செய்யப்பட்டது", description: "Voiceover script from structured input applied." });
    }
  }, []);

  useEffect(() => {
    if (initialVoiceoverScript && initialVoiceoverScript.trim()) {
      setVoiceoverScript(initialVoiceoverScript.trim());
      sessionStorage.removeItem("trichy_pending_reels_script");
      onVoiceoverScriptConsumed?.();
      toast({ title: "Reels Script பூர்த்தி செய்யப்பட்டது", description: "Voiceover script from structured input applied." });
    }
  }, [initialVoiceoverScript]);

  const [caption, setCaption] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [publishToInstagram, setPublishToInstagram] = useState(true);
  const [publishToYoutube, setPublishToYoutube] = useState(false);
  const [publishToFacebook, setPublishToFacebook] = useState(false);
  const [youtubeRefreshToken, setYoutubeRefreshToken] = useState("");

  const [igUserId, setIgUserId] = useState("");
  const [igAccessToken, setIgAccessToken] = useState("");
  const [igConfigured, setIgConfigured] = useState(false);

  const [fbPageId, setFbPageId] = useState("");
  const [fbAccessToken, setFbAccessToken] = useState("");
  const [fbConfigured, setFbConfigured] = useState(false);

  const [ttsProvider, setTtsProvider] = useState<"gemini" | "minimax">("gemini");
  const [ttsApiKey, setTtsApiKey] = useState("");
  const [ttsVoice, setTtsVoice] = useState("Kore");
  const [savingTts, setSavingTts] = useState(false);

  const [rendering, setRendering] = useState(false);
  const [publishSteps, setPublishSteps] = useState<PublishStep[]>([]);
  const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(null);
  const [finalVideoId, setFinalVideoId] = useState<string | null>(null);
  const [publishComplete, setPublishComplete] = useState(false);
  const [savingApiKey, setSavingApiKey] = useState(false);

  useEffect(() => {
    supabase
      .from("news_posts")
      .select("id, title, slug, category, excerpt, cover_image_url, is_published")
      .order("created_at", { ascending: false })
      .limit(80)
      .then(({ data }) => {
        if (data) setPosts(data as NewsPost[]);
        setLoadingPosts(false);
      });

    loadDirectChannelsDB().then((channels) => {
      if (channels.instagram.igUserId) setIgUserId(channels.instagram.igUserId);
      if (channels.instagram.accessToken) setIgAccessToken(channels.instagram.accessToken);
      setIgConfigured(channels.instagram.enabled && !!channels.instagram.accessToken);
      if (channels.facebook.pageId) setFbPageId(channels.facebook.pageId);
      if (channels.facebook.accessToken) setFbAccessToken(channels.facebook.accessToken);
      setFbConfigured(channels.facebook.enabled && !!channels.facebook.accessToken);
    }).catch(() => {});

    loadAppSettings().then((s) => {
      if (s.youtubeRefreshToken) setYoutubeRefreshToken(s.youtubeRefreshToken);
      if (s.ttsProvider) setTtsProvider(s.ttsProvider);
      if (s.ttsApiKey) setTtsApiKey(s.ttsApiKey);
      if (s.ttsVoice) setTtsVoice(s.ttsVoice);
    }).catch(() => {});
  }, []);

  const handleSaveApiKey = async () => {
    setSavingApiKey(true);
    try {
      await saveAppSettings({ youtubeRefreshToken: youtubeRefreshToken.trim() });
      toast({ title: "சேமிக்கப்பட்டது", description: "YouTube token சேமிக்கப்பட்டது." });
    } catch {
      toast({ title: "சேமிப்பு தோல்வி", variant: "destructive" });
    } finally {
      setSavingApiKey(false);
    }
  };

  const handleSaveTts = async () => {
    setSavingTts(true);
    try {
      await saveAppSettings({ ttsProvider, ttsApiKey: ttsApiKey.trim(), ttsVoice: ttsVoice.trim() });
      toast({ title: "TTS Settings சேமிக்கப்பட்டது" });
    } catch {
      toast({ title: "சேமிப்பு தோல்வி", variant: "destructive" });
    } finally {
      setSavingTts(false);
    }
  };

  const handleSelectPost = (post: NewsPost) => {
    setSelectedPost(post);
    setImageUrl(post.cover_image_url ?? "");
    const scriptBase = post.excerpt?.trim()
      ? `${post.title}.\n\n${post.excerpt}\n\nதிருச்சி இன்சைட் — உங்கள் உள்ளூர் செய்திகளுக்கு.`
      : `${post.title}.\n\nதிருச்சி இன்சைட் — உங்கள் உள்ளூர் செய்திகளுக்கு.`;
    setVoiceoverScript(scriptBase);
    const cap = `${post.title}\n\n${post.excerpt ?? ""}\n\n#TrichyInsight #TamilNews #திருச்சி #Trichy #${post.category}`.trim();
    setCaption(cap);
    setPublishSteps([]);
    setFinalVideoUrl(null);
    setFinalVideoId(null);
    setPublishComplete(false);
  };

  const filteredPosts = posts.filter((p) =>
    p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.category.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const updateStep = (
    setSteps: React.Dispatch<React.SetStateAction<PublishStep[]>>,
    id: string,
    patch: Partial<PublishStep>,
  ) => {
    setSteps((prev) => prev.map((s) => s.id === id ? { ...s, ...patch } : s));
  };

  const handleRenderPublish = async (publishOnly = false) => {
    if (!voiceoverScript.trim()) {
      toast({ title: "Voiceover script தேவை", variant: "destructive" });
      return;
    }
    if (!imageUrl.trim()) {
      toast({ title: "Image URL தேவை", variant: "destructive" });
      return;
    }

    const willPublish = publishOnly && (publishToInstagram || publishToYoutube || publishToFacebook);
    const needUpload = publishOnly && (publishToInstagram || publishToFacebook);

    const initialSteps = buildInitialSteps(
      publishOnly ? publishToInstagram : false,
      publishOnly ? publishToYoutube : false,
      publishOnly ? publishToFacebook : false,
      needUpload,
    );
    setPublishSteps(initialSteps);
    setFinalVideoUrl(null);
    setFinalVideoId(null);
    setPublishComplete(false);
    setRendering(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      const body = {
        article: {
          title: selectedPost?.title ?? "Trichy News",
          excerpt: selectedPost?.excerpt ?? "",
          category: selectedPost?.category ?? "பொது",
          slug: selectedPost?.slug ?? "news",
        },
        voiceoverScript: voiceoverScript.trim(),
        imageUrl: imageUrl.trim(),
        caption: caption.trim() || undefined,
        publishToInstagram: publishOnly ? publishToInstagram : false,
        publishToYoutube: publishOnly ? publishToYoutube : false,
        publishToFacebook: publishOnly ? publishToFacebook : false,
        tts: {
          provider: ttsProvider,
          apiKey: ttsApiKey.trim() || undefined,
          voice: ttsVoice.trim() || undefined,
        },
        ...(publishToInstagram && igUserId && igAccessToken ? {
          instagram: { igUserId, accessToken: igAccessToken },
        } : {}),
        ...(publishToYoutube && youtubeRefreshToken ? {
          youtube: { refreshToken: youtubeRefreshToken },
        } : {}),
        ...(publishToFacebook && fbPageId && fbAccessToken ? {
          facebook: { pageId: fbPageId, accessToken: fbAccessToken },
        } : {}),
      };

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

      const res = await fetch(`${API_BASE}/reels/render-publish-stream`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      if (!res.ok || !res.body) {
        const errText = await res.text().catch(() => "");
        let errMsg = `Server error ${res.status}`;
        try { errMsg = (JSON.parse(errText) as { error?: string }).error ?? errMsg; } catch { /* noop */ }
        setPublishSteps((prev) => prev.map((s) => s.status === "idle" ? { ...s, status: "skipped" } : s));
        toast({ title: "Render தோல்வி", description: errMsg, variant: "destructive" });
        setRendering(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          let evt: StreamEvent;
          try { evt = JSON.parse(trimmed) as StreamEvent; } catch { continue; }

          if (evt.step === "error") {
            setPublishSteps((prev) => prev.map((s) =>
              s.status === "running" ? { ...s, status: "error", detail: evt.error } :
              s.status === "idle" ? { ...s, status: "skipped" } : s
            ));
            setPublishComplete(true);
            toast({ title: "Publish தோல்வி", description: evt.error ?? "Unknown error", variant: "destructive" });
          } else if (evt.step === "complete") {
            if (evt.videoUrl) setFinalVideoUrl(evt.videoUrl);
            if (evt.videoId) setFinalVideoId(evt.videoId);
            setPublishComplete(true);
            const hasPublish = willPublish;
            toast({ title: hasPublish ? "Reel published!" : "Video rendered!", description: "கீழே முடிவுகளைப் பார்க்கவும்." });
          } else if (evt.step === "voiceover" || evt.step === "render" || evt.step === "upload") {
            const status = evt.status as StepStatus ?? "idle";
            updateStep(setPublishSteps, evt.step, {
              status,
              detail: status === "error" ? (evt.error ?? evt.detail) : evt.detail,
            });
          } else if (evt.step === "instagram") {
            const status = evt.status as StepStatus ?? "idle";
            const mediaId = evt.mediaId;
            updateStep(setPublishSteps, "instagram", {
              status,
              detail: status === "error" ? evt.error : mediaId ? `ID: ${mediaId}` : undefined,
              link: status === "done" && mediaId
                ? { href: `https://www.instagram.com/p/${mediaId}/`, label: `instagram.com/p/${mediaId}` }
                : undefined,
            });
          } else if (evt.step === "youtube") {
            const status = evt.status as StepStatus ?? "idle";
            const videoId = evt.videoId;
            updateStep(setPublishSteps, "youtube", {
              status,
              detail: status === "error" ? evt.error : videoId ? `ID: ${videoId}` : undefined,
              link: status === "done" && videoId
                ? { href: `https://www.youtube.com/shorts/${videoId}`, label: `youtube.com/shorts/${videoId}` }
                : undefined,
            });
          } else if (evt.step === "facebook") {
            const status = evt.status as StepStatus ?? "idle";
            const postId = evt.postId;
            updateStep(setPublishSteps, "facebook", {
              status,
              detail: status === "error" ? evt.error : postId ? `ID: ${postId}` : undefined,
              link: status === "done" && postId
                ? { href: `https://www.facebook.com/watch?v=${postId}`, label: `facebook.com/watch?v=${postId}` }
                : undefined,
            });
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setPublishSteps((prev) => prev.map((s) => s.status === "running" ? { ...s, status: "error", detail: msg } : s));
      toast({ title: "பிழை", description: msg, variant: "destructive" });
    } finally {
      setRendering(false);
    }
  };

  const anyStepError = publishSteps.some((s) => s.status === "error");
  const anyStepSuccess = publishSteps.some((s) => s.status === "done" && ["instagram", "youtube", "facebook"].includes(s.id));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500">
          <Film className="h-5 w-5 text-white" />
        </div>
        <div>
          <h2 className="font-heading text-xl uppercase tracking-wide">Video Reel Publisher</h2>
          <p className="text-sm text-muted-foreground">
            News image + Tamil TTS voiceover + BGM → Instagram Reels & YouTube Shorts
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── Left column: Article selector + scripts ── */}
        <div className="space-y-5">

          {/* Article selector */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider flex items-center gap-2">
                <FileText className="h-4 w-4" /> Select Article
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                placeholder="Search articles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="text-sm"
              />
              <div className="max-h-48 overflow-y-auto space-y-1 border rounded-md p-2">
                {loadingPosts ? (
                  <p className="text-xs text-muted-foreground p-2">ஏற்றுகிறது...</p>
                ) : filteredPosts.length === 0 ? (
                  <p className="text-xs text-muted-foreground p-2">எந்த செய்தியும் இல்லை</p>
                ) : (
                  filteredPosts.map((post) => (
                    <button
                      key={post.id}
                      onClick={() => handleSelectPost(post)}
                      className={`w-full text-left px-3 py-2 rounded text-xs transition-colors ${
                        selectedPost?.id === post.id
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-muted"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] shrink-0">{post.category}</Badge>
                        <span className="line-clamp-1 font-medium">{post.title}</span>
                        {post.is_published && (
                          <span className="ml-auto text-[10px] text-green-600 shrink-0">●</span>
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
              {selectedPost && (
                <div className="flex items-center gap-2 p-2 bg-primary/10 rounded text-xs text-primary font-medium">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  {selectedPost.title.slice(0, 60)}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Image URL */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider flex items-center gap-2">
                <ImageIcon className="h-4 w-4" /> News Image URL
              </CardTitle>
              <CardDescription className="text-xs">This image will be placed behind the Canva template</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                placeholder="https://example.com/image.jpg"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                className="text-sm font-mono"
              />
              {imageUrl && (
                <img
                  src={imageUrl}
                  alt="Preview"
                  className="h-24 w-full object-cover rounded border"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              )}
            </CardContent>
          </Card>

          {/* Voiceover script */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider flex items-center gap-2">
                <Mic className="h-4 w-4" /> Voiceover Script (Tamil)
              </CardTitle>
              <CardDescription className="text-xs">This text will be converted to speech via Sarvam AI Tamil TTS (ta-IN)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                placeholder="திருச்சியில் இப்போ நடந்த ஒரு சம்பவம்..."
                value={voiceoverScript}
                onChange={(e) => setVoiceoverScript(e.target.value)}
                rows={5}
                className="text-sm resize-none"
              />
              <p className="text-[10px] text-muted-foreground">
                {voiceoverScript.trim().split(/\s+/).filter(Boolean).length} வார்த்தைகள் · ~{Math.ceil(voiceoverScript.trim().split(/\s+/).filter(Boolean).length / 3)}s ஒலி
              </p>
            </CardContent>
          </Card>

          {/* Caption */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider">Post Caption</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Post caption for Instagram / YouTube..."
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                rows={4}
                className="text-sm resize-none"
              />
            </CardContent>
          </Card>
        </div>

        {/* ── Right column: Publish config + actions ── */}
        <div className="space-y-5">

          {/* TTS Settings */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider flex items-center gap-2">
                <Mic className="h-4 w-4" /> Voice / TTS Settings
              </CardTitle>
              <CardDescription className="text-xs">
                TTS provider, API key, and voice selection — saved to your account
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Provider</Label>
                <Select value={ttsProvider} onValueChange={(v) => {
                  setTtsProvider(v as "gemini" | "minimax");
                  setTtsVoice(v === "minimax" ? "Calm_Woman" : "Kore");
                }}>
                  <SelectTrigger className="text-sm h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gemini">Gemini TTS (gemini-2.5-flash-preview-tts)</SelectItem>
                    <SelectItem value="minimax">MiniMax TTS (speech-02-hd)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">API Key</Label>
                <Input
                  type="password"
                  placeholder={ttsProvider === "minimax" ? "MiniMax API key…" : "Gemini API key… (or use server secret)"}
                  value={ttsApiKey}
                  onChange={(e) => setTtsApiKey(e.target.value)}
                  className="text-sm font-mono"
                />
                <p className="text-[10px] text-muted-foreground">
                  {ttsProvider === "gemini"
                    ? "Leave blank to use the GEMINI_API_KEY server secret."
                    : "Get free credits at minimaxi.chat → API Keys."}
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Voice</Label>
                {ttsProvider === "minimax" ? (
                  <div className="space-y-1.5">
                    <Select value={ttsVoice} onValueChange={setTtsVoice}>
                      <SelectTrigger className="text-sm h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Calm_Woman">Calm Woman ♀ (recommended)</SelectItem>
                        <SelectItem value="Wise_Woman">Wise Woman ♀</SelectItem>
                        <SelectItem value="Friendly_Person">Friendly Person ♀</SelectItem>
                        <SelectItem value="Inspirational_girl">Inspirational Girl ♀</SelectItem>
                        <SelectItem value="Lively_Girl">Lively Girl ♀</SelectItem>
                        <SelectItem value="Sweet_Girl_2">Sweet Girl ♀</SelectItem>
                        <SelectItem value="Lovely_Girl">Lovely Girl ♀</SelectItem>
                        <SelectItem value="Patient_Man">Patient Man ♂</SelectItem>
                        <SelectItem value="Deep_Voice_Man">Deep Voice Man ♂</SelectItem>
                        <SelectItem value="Determined_Man">Determined Man ♂</SelectItem>
                        <SelectItem value="Decent_Boy">Decent Boy ♂</SelectItem>
                        <SelectItem value="Casual_Guy">Casual Guy ♂</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-[10px] text-muted-foreground">
                      All voices are multilingual — Tamil text is spoken automatically. Or enter a custom voice ID below.
                    </p>
                    <Input
                      placeholder="Custom voice ID (optional override)…"
                      className="text-xs font-mono h-8"
                      onBlur={(e) => { if (e.target.value.trim()) setTtsVoice(e.target.value.trim()); }}
                    />
                  </div>
                ) : (
                  <Select value={ttsVoice} onValueChange={setTtsVoice}>
                    <SelectTrigger className="text-sm h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Kore">Kore — Multilingual (Tamil capable)</SelectItem>
                      <SelectItem value="Aoede">Aoede — Multilingual</SelectItem>
                      <SelectItem value="Charon">Charon — Multilingual</SelectItem>
                      <SelectItem value="Fenrir">Fenrir — Multilingual</SelectItem>
                      <SelectItem value="Orbit">Orbit — Multilingual</SelectItem>
                      <SelectItem value="Puck">Puck — Multilingual</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>

              <Button
                size="sm"
                variant="outline"
                onClick={() => void handleSaveTts()}
                disabled={savingTts}
                className="w-full gap-2"
              >
                {savingTts ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Save TTS Settings
              </Button>
            </CardContent>
          </Card>

          {/* Instagram */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider flex items-center gap-2">
                <Instagram className="h-4 w-4 text-pink-500" /> Instagram Reels
              </CardTitle>
              <CardDescription className="text-xs">
                {igConfigured ? "Channels tab-ல் configure ஆனது" : "Channels tab-ல் Instagram-ஐ connect செய்யவும்"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <Switch
                  checked={publishToInstagram}
                  onCheckedChange={setPublishToInstagram}
                />
                <Label className="text-sm">Publish to Instagram Reels</Label>
                {igConfigured && <Badge className="text-[10px] bg-green-100 text-green-700 ml-auto">Connected</Badge>}
              </div>
              {publishToInstagram && !igConfigured && (
                <div className="space-y-2">
                  <Input
                    placeholder="Instagram User ID"
                    value={igUserId}
                    onChange={(e) => setIgUserId(e.target.value)}
                    className="text-sm"
                  />
                  <Input
                    type="password"
                    placeholder="Instagram Access Token"
                    value={igAccessToken}
                    onChange={(e) => setIgAccessToken(e.target.value)}
                    className="text-sm"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Facebook */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider flex items-center gap-2">
                <Facebook className="h-4 w-4 text-blue-600" /> Facebook Reels
              </CardTitle>
              <CardDescription className="text-xs">
                {fbConfigured ? "Channels tab-ல் configure ஆனது" : "Channels tab-ல் Facebook-ஐ connect செய்யவும்"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <Switch
                  checked={publishToFacebook}
                  onCheckedChange={setPublishToFacebook}
                />
                <Label className="text-sm">Publish to Facebook Reels</Label>
                {fbConfigured && <Badge className="text-[10px] bg-green-100 text-green-700 ml-auto">Connected</Badge>}
              </div>
              {publishToFacebook && !fbConfigured && (
                <div className="space-y-2">
                  <Input
                    placeholder="Facebook Page ID"
                    value={fbPageId}
                    onChange={(e) => setFbPageId(e.target.value)}
                    className="text-sm"
                  />
                  <Input
                    type="password"
                    placeholder="Page Access Token"
                    value={fbAccessToken}
                    onChange={(e) => setFbAccessToken(e.target.value)}
                    className="text-sm"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* YouTube */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider flex items-center gap-2">
                <Youtube className="h-4 w-4 text-red-500" /> YouTube Shorts
              </CardTitle>
              <CardDescription className="text-xs">
                YouTube Data API v3 OAuth refresh token தேவை
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <Switch
                  checked={publishToYoutube}
                  onCheckedChange={setPublishToYoutube}
                />
                <Label className="text-sm">Publish to YouTube Shorts</Label>
              </div>
              {publishToYoutube && (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      type="password"
                      placeholder="YouTube OAuth Refresh Token"
                      value={youtubeRefreshToken}
                      onChange={(e) => { setYoutubeRefreshToken(e.target.value); }}
                      className="text-sm font-mono"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void handleSaveApiKey()}
                      disabled={savingApiKey}
                      className="shrink-0"
                    >
                      {savingApiKey ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    YOUTUBE_CLIENT_ID & YOUTUBE_CLIENT_SECRET env vars-ல் set செய்யவும் (or contact admin)
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider">Render & Publish</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                className="w-full gap-2 bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-700 hover:to-pink-600 text-white border-0"
                onClick={() => void handleRenderPublish(false)}
                disabled={rendering}
              >
                {rendering ? <Loader2 className="h-4 w-4 animate-spin" /> : <Film className="h-4 w-4" />}
                {rendering ? "Rendering…" : "Render Only (Preview)"}
              </Button>
              <Button
                className="w-full gap-2"
                onClick={() => void handleRenderPublish(true)}
                disabled={rendering || (!publishToInstagram && !publishToYoutube && !publishToFacebook)}
              >
                {rendering ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {rendering ? "Publishing…" : "Render + Publish"}
              </Button>
              <p className="text-[10px] text-muted-foreground text-center">
                Rendering takes ~30-90 seconds (TTS + FFmpeg)
              </p>
            </CardContent>
          </Card>

          {/* ── Live progress panel ── */}
          {publishSteps.length > 0 && (
            <Card className={
              publishComplete
                ? anyStepError && !anyStepSuccess
                  ? "border-red-400"
                  : anyStepError
                    ? "border-yellow-400"
                    : "border-green-400"
                : "border-blue-300"
            }>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold uppercase tracking-wider flex items-center gap-2">
                  {rendering
                    ? <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                    : publishComplete
                      ? anyStepError && !anyStepSuccess
                        ? <XCircle className="h-4 w-4 text-red-500" />
                        : anyStepError
                          ? <AlertCircle className="h-4 w-4 text-yellow-500" />
                          : <CheckCircle2 className="h-4 w-4 text-green-500" />
                      : <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                  }
                  {rendering ? "Publishing in progress…" : publishComplete ? "Publish complete" : "Status"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {publishSteps.map((step) => (
                  <div key={step.id} className={`flex flex-col gap-0.5 rounded-md px-3 py-2 text-xs transition-colors ${
                    step.status === "running" ? "bg-blue-50 dark:bg-blue-950/20" :
                    step.status === "done" ? "bg-green-50 dark:bg-green-950/20" :
                    step.status === "error" ? "bg-red-50 dark:bg-red-950/20" :
                    step.status === "skipped" ? "opacity-40" :
                    "bg-muted/30"
                  }`}>
                    <div className="flex items-center gap-2">
                      {stepIcon(step.status)}
                      <span className={`font-medium ${
                        step.status === "running" ? "text-blue-700 dark:text-blue-300" :
                        step.status === "done" ? "text-green-700 dark:text-green-300" :
                        step.status === "error" ? "text-red-700 dark:text-red-300" :
                        "text-muted-foreground"
                      }`}>
                        {step.label}
                      </span>
                      {step.status === "running" && (
                        <span className="ml-auto text-[10px] text-blue-500 animate-pulse">processing…</span>
                      )}
                    </div>
                    {step.detail && (
                      <p className={`ml-6 text-[11px] leading-snug ${step.status === "error" ? "text-red-600" : "text-muted-foreground"}`}>
                        {step.detail}
                      </p>
                    )}
                    {step.link && (
                      <a
                        href={step.link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-6 text-[11px] text-primary underline underline-offset-2 hover:opacity-80"
                      >
                        {step.link.label} →
                      </a>
                    )}
                  </div>
                ))}

                {/* Rendered video preview */}
                {finalVideoUrl && (
                  <div className="mt-3 space-y-2 pt-2 border-t">
                    <p className="text-xs font-medium">Rendered Video:</p>
                    <video
                      src={finalVideoUrl}
                      controls
                      className="w-full rounded border max-h-64"
                      style={{ aspectRatio: "9/16" }}
                    />
                    <a
                      href={finalVideoUrl}
                      download={`reel-${selectedPost?.slug ?? "video"}.mp4`}
                      className="inline-flex items-center gap-1.5 text-xs text-primary underline"
                    >
                      <Download className="h-3 w-3" /> Download MP4
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* How it works */}
          <Card className="bg-muted/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider">How It Works</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 text-xs text-muted-foreground">
              <div className="flex gap-2"><span className="text-primary font-bold shrink-0">1.</span> Article-ஐ select செய்யவும் — Image, Voiceover, Caption auto-fill ஆகும்</div>
              <div className="flex gap-2"><span className="text-primary font-bold shrink-0">2.</span> Voiceover script-ஐ தமிழில் திருத்தவும்</div>
              <div className="flex gap-2"><span className="text-primary font-bold shrink-0">3.</span> TTS Settings-ல் உள்ள provider → உயர்தர Tamil audio render ஆகும்</div>
              <div className="flex gap-2"><span className="text-primary font-bold shrink-0">4.</span> News image + Canva template + Audio → FFmpeg வீடியோ compose செய்யும்</div>
              <div className="flex gap-2"><span className="text-primary font-bold shrink-0">5.</span> Instagram Reels / Facebook Reels / YouTube Shorts-க்கு publish ஆகும்</div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
