import { useEffect, useState } from "react";
import {
  AlertCircle, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp,
  Copy, ExternalLink, Facebook, Globe, Instagram, KeyRound, Loader2,
  MessageCircle, Save, ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  defaultDirectChannels,
  loadDirectChannels,
  loadDirectChannelsDB,
  saveDirectChannelsToDB,
  testChannel,
  type DirectChannelSettings,
} from "@/lib/channel-publish";

type TestStatus = "idle" | "testing" | "ok" | "fail";

const FieldRow = ({
  label, id, value, onChange, type = "text", placeholder, hint,
}: {
  label: string; id: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; hint?: string;
}) => (
  <div className="space-y-1">
    <Label htmlFor={id} className="text-xs">{label}</Label>
    <Input
      id={id} type={type} value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="text-xs h-8"
    />
    {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
  </div>
);

const StatusBadge = ({ status }: { status: TestStatus }) => {
  if (status === "testing") return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
  if (status === "ok") return <CheckCircle2 className="h-4 w-4 text-green-500" />;
  if (status === "fail") return <AlertCircle className="h-4 w-4 text-destructive" />;
  return null;
};

const WA_PROVIDERS = [
  {
    value: "greenapi" as const,
    label: "Green API",
    badge: "Supports Groups",
    badgeColor: "bg-green-100 text-green-700",
    description: "Indian-friendly, supports WhatsApp group posting. Get credentials at green-api.com.",
    link: "https://green-api.com",
    fields: ["instanceId", "apiToken", "groupId"] as const,
    fieldLabels: {
      instanceId: "Instance ID",
      apiToken: "API Token",
      groupId: "Chat ID (e.g. 9109XXXXXXXX@g.us for group)",
    },
    placeholders: {
      instanceId: "1101XXXXXXXX",
      apiToken: "Your Green API token",
      groupId: "9XXXXXXXXX@g.us or groupId@g.us",
    },
  },
  {
    value: "wati" as const,
    label: "WATI",
    badge: "BSP Partner",
    badgeColor: "bg-blue-100 text-blue-700",
    description: "Official Meta partner, popular in India. Supports sending to groups via session messages.",
    link: "https://wati.io",
    fields: ["apiUrl", "apiToken", "groupId"] as const,
    fieldLabels: {
      apiUrl: "API Base URL",
      apiToken: "API Token",
      groupId: "Group / Chat Phone Number",
    },
    placeholders: {
      apiUrl: "https://live-mt-server.wati.io/XXXXX",
      apiToken: "Your WATI API token",
      groupId: "+919XXXXXXXXX",
    },
  },
  {
    value: "meta" as const,
    label: "Meta WA Business API",
    badge: "Official",
    badgeColor: "bg-gray-100 text-gray-700",
    description: "Official WhatsApp Business Cloud API — sends to individual opted-in phone numbers (not groups).",
    link: "https://developers.facebook.com/docs/whatsapp",
    fields: ["phoneId", "wabaToken", "groupId"] as const,
    fieldLabels: {
      phoneId: "Phone Number ID",
      wabaToken: "WA Business API Token",
      groupId: "Recipient Phone (with country code)",
    },
    placeholders: {
      phoneId: "Phone Number ID from Meta dashboard",
      wabaToken: "Meta WA Business token",
      groupId: "+919XXXXXXXXX",
    },
  },
];

export default function AdminChannelConfig() {
  const { toast } = useToast();
  const [channels, setChannels] = useState<DirectChannelSettings>(() => loadDirectChannels());
  const [dbLoading, setDbLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [fbStatus, setFbStatus] = useState<TestStatus>("idle");
  const [igStatus, setIgStatus] = useState<TestStatus>("idle");
  const [waStatus, setWaStatus] = useState<TestStatus>("idle");
  const [twStatus, setTwStatus] = useState<TestStatus>("idle");
  const [bsStatus, setBsStatus] = useState<TestStatus>("idle");
  const [waProviderOpen, setWaProviderOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [serverConfig, setServerConfig] = useState<{
    instagram: { hasToken: boolean; igUserId: string; tokenPrefix: string };
  } | null>(null);
  const [igValidating, setIgValidating] = useState(false);
  const [igValidation, setIgValidation] = useState<{
    valid: boolean; error?: string; expires_human?: string; is_expired?: boolean;
    has_publish_scope?: boolean; scopes?: string[]; account?: { username?: string; name?: string };
    app_secret_set?: boolean;
  } | null>(null);

  useEffect(() => {
    loadDirectChannelsDB()
      .then((settings) => { setChannels(settings); setDbLoading(false); })
      .catch((err: unknown) => {
        setDbError(err instanceof Error ? err.message : "Failed to load settings from database");
        setDbLoading(false);
      });

    fetch("/api/channels/server-config")
      .then((r) => r.json())
      .then((data) => setServerConfig(data as typeof serverConfig))
      .catch(() => { /* server config is optional */ });
  }, []);

  const WEBHOOK_CALLBACK_URL = "https://trichyinsight.online/api/instagram/webhook";
  const WEBHOOK_VERIFY_TOKEN = "trichy_insight_ig_webhook_2026";
  const IG_USER_ID = "17841447727738548";

  const copyText = (text: string, key: string) => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key);
      toast({ title: "Copied!" });
      setTimeout(() => setCopiedKey(null), 2000);
    });
  };

  const selectedWAProvider = WA_PROVIDERS.find((p) => p.value === channels.whatsapp.provider) ?? WA_PROVIDERS[0];

  const handleSave = () => {
    setSaving(true);
    saveDirectChannelsToDB(channels)
      .then(() => toast({ title: "Settings saved — synced across all devices" }))
      .catch(() => toast({ title: "Saved locally (DB sync failed)", variant: "destructive" }))
      .finally(() => setSaving(false));
  };

  const handleReset = () => {
    if (!confirm(
      "⚠️ Are you sure you want to reset ALL channel settings?\n\n" +
      "This will permanently delete all access tokens, page IDs, and credentials " +
      "from the database. You will need to re-enter them manually.\n\n" +
      "This action cannot be undone."
    )) return;
    const fresh = defaultDirectChannels();
    setChannels(fresh);
    saveDirectChannelsToDB(fresh)
      .then(() => toast({ title: "Channel settings reset" }))
      .catch(() => toast({ title: "Reset locally (DB sync failed)", variant: "destructive" }));
  };

  const handleTest = async (ch: "facebook" | "instagram" | "whatsapp" | "twitter" | "bluesky") => {
    const setStatus =
      ch === "facebook" ? setFbStatus :
      ch === "instagram" ? setIgStatus :
      ch === "whatsapp" ? setWaStatus :
      ch === "twitter" ? setTwStatus :
      setBsStatus;
    setStatus("testing");
    const result = await testChannel(ch, channels);
    setStatus(result.success ? "ok" : "fail");
    if (result.success) {
      toast({ title: `${ch} test sent!` });
    } else {
      toast({ title: `${ch} test failed`, description: result.error, variant: "destructive" });
    }
    setTimeout(() => setStatus("idle"), 5000);
  };

  const updateFB = (field: keyof DirectChannelSettings["facebook"], v: string | boolean) =>
    setChannels((p) => ({ ...p, facebook: { ...p.facebook, [field]: v } }));

  const updateIG = (field: keyof DirectChannelSettings["instagram"], v: string | boolean) =>
    setChannels((p) => ({ ...p, instagram: { ...p.instagram, [field]: v } }));

  const validateIGToken = async () => {
    setIgValidating(true);
    setIgValidation(null);
    try {
      const res = await fetch("/api/instagram/validate-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          access_token: channels.instagram.accessToken,
          ig_user_id: channels.instagram.igUserId || "17841447727738548",
        }),
      });
      const data = (await res.json()) as typeof igValidation;
      setIgValidation(data);
    } catch {
      setIgValidation({ valid: false, error: "Network error — server not reachable" });
    } finally {
      setIgValidating(false);
    }
  };

  const updateWA = (field: keyof DirectChannelSettings["whatsapp"], v: string | boolean) =>
    setChannels((p) => ({ ...p, whatsapp: { ...p.whatsapp, [field]: v } }));

  const updateTW = (field: keyof DirectChannelSettings["twitter"], v: string | boolean) =>
    setChannels((p) => ({ ...p, twitter: { ...p.twitter, [field]: v } }));

  const updateBS = (field: keyof DirectChannelSettings["bluesky"], v: string | boolean) =>
    setChannels((p) => ({ ...p, bluesky: { ...p.bluesky, [field]: v } }));

  const enabledCount = [
    channels.facebook.enabled,
    channels.instagram.enabled,
    channels.whatsapp.enabled,
    channels.twitter.enabled,
    channels.bluesky.enabled,
  ].filter(Boolean).length;

  return (
    <div className="space-y-6">
      {/* DB error banner */}
      {dbError && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Settings could not be loaded from database</p>
            <p className="text-xs mt-0.5 opacity-80">{dbError}</p>
            <p className="text-xs mt-1 opacity-80">
              Showing last locally-saved settings. Re-enter your tokens and click Save to re-sync.
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-heading text-xl uppercase">Direct Social Publishing</h2>
          <p className="text-muted-foreground text-sm mt-1">
            {dbLoading
              ? <span className="flex items-center gap-1.5"><Loader2 className="h-3 w-3 animate-spin" /> Loading settings from database...</span>
              : dbError
                ? <span className="flex items-center gap-1.5 text-amber-600"><AlertTriangle className="h-3 w-3" /> Settings loaded from local cache only — database unreachable</span>
                : <span className="flex items-center gap-1.5 text-green-700"><ShieldCheck className="h-3 w-3" /> {enabledCount} channel{enabledCount !== 1 ? "s" : ""} active — settings synced to database</span>
            }
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={dbLoading}
            className="text-destructive hover:text-destructive hover:border-destructive/50"
          >
            Reset
          </Button>
          <Button size="sm" onClick={handleSave} disabled={dbLoading || saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </div>

      {/* ── Facebook ────────────────────────────────── */}
      <Card className={channels.facebook.enabled ? "border-blue-500/40" : ""}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 text-white rounded-lg p-2"><Facebook className="h-5 w-5" /></div>
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  Facebook Page
                  {channels.facebook.enabled && <Badge className="text-[10px] bg-green-100 text-green-700">Active</Badge>}
                </CardTitle>
                <CardDescription className="text-xs">Posts article headline + excerpt + link to your Page</CardDescription>
              </div>
            </div>
            <Switch checked={channels.facebook.enabled} onCheckedChange={(v) => updateFB("enabled", v)} />
          </div>
        </CardHeader>

        {channels.facebook.enabled && (
          <CardContent className="space-y-5 pt-0">

            {/* Step 1 — OAuth Login */}
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="bg-muted/50 px-4 py-2.5 border-b border-border flex items-center gap-2">
                <span className="bg-primary text-primary-foreground text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">1</span>
                <span className="text-sm font-medium">Connect via Facebook Login</span>
              </div>
              <div className="p-4 space-y-3">
                <p className="text-xs text-muted-foreground">
                  Click the button below — Facebook will ask for permission to manage your Page. After you approve, you'll be redirected back here and the <strong>Page ID + token will be saved automatically</strong>.
                </p>

                {channels.facebook.accessToken && channels.facebook.pageId ? (
                  <div className="flex items-center gap-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg px-4 py-3">
                    <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-green-700 dark:text-green-300">Facebook Page இணைக்கப்பட்டது!</p>
                      <p className="text-xs text-green-600 dark:text-green-400 truncate">Page ID: {channels.facebook.pageId}</p>
                    </div>
                    <a
                      href={`https://www.facebook.com/dialog/oauth?client_id=1976213376265645&redirect_uri=${encodeURIComponent("https://trichyinsight.online/admin")}&scope=pages_manage_posts%2Cpages_read_engagement%2Cpages_show_list&response_type=code&state=facebook_oauth`}
                      className="text-xs text-blue-600 underline shrink-0"
                    >
                      மீண்டும் இணை
                    </a>
                  </div>
                ) : (
                  <a
                    href={`https://www.facebook.com/dialog/oauth?client_id=1976213376265645&redirect_uri=${encodeURIComponent("https://trichyinsight.online/admin")}&scope=pages_manage_posts%2Cpages_read_engagement%2Cpages_show_list&response_type=code&state=facebook_oauth`}
                    className="flex items-center justify-center gap-2 w-full rounded-lg py-2.5 px-4 text-sm font-semibold text-white bg-[#1877F2] hover:bg-[#166FE5] transition-colors"
                  >
                    <Facebook className="h-4 w-4" />
                    Connect with Facebook Page
                  </a>
                )}

                <div className="flex items-start gap-2 bg-muted/50 rounded p-2.5">
                  <div className="mt-0.5 text-amber-500 shrink-0">⚠</div>
                  <p className="text-[11px] text-muted-foreground">
                    Requires <strong>FACEBOOK_APP_SECRET</strong> (or INSTAGRAM_APP_SECRET) in Replit Secrets. The redirect goes back to <code className="text-[10px] bg-muted px-1 rounded">trichyinsight.online/admin</code> — must be listed as a valid OAuth redirect URI in your Meta App settings.
                  </p>
                </div>
              </div>
            </div>

            {/* Step 2 — Manual fields */}
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="bg-muted/50 px-4 py-2.5 border-b border-border flex items-center gap-2">
                <span className="bg-primary text-primary-foreground text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">2</span>
                <span className="text-sm font-medium">Or Enter Credentials Manually</span>
              </div>
              <div className="p-4 space-y-3">
                <p className="text-xs text-muted-foreground">
                  Alternatively, get your token from <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noopener noreferrer" className="text-primary underline">Graph API Explorer</a> and paste it here.
                </p>
                <FieldRow label="Facebook Page ID" id="fb-page-id" value={channels.facebook.pageId}
                  onChange={(v) => updateFB("pageId", v)} placeholder="123456789012345"
                  hint="Found in your Page's About → Page Transparency section" />
                <FieldRow label="Page Access Token" id="fb-token" value={channels.facebook.accessToken}
                  type="password" onChange={(v) => updateFB("accessToken", v)}
                  placeholder="EAAxxxxxx..." hint="Long-lived Page token — requires pages_manage_posts permission" />
                <div className="flex gap-2 pt-1">
                  <Button variant="outline" size="sm" onClick={() => void handleTest("facebook")} disabled={!channels.facebook.pageId || !channels.facebook.accessToken || fbStatus === "testing"}>
                    <StatusBadge status={fbStatus} />
                    {fbStatus === "idle" && "Test Post"}{fbStatus === "testing" && "Testing..."}{fbStatus === "ok" && "Sent!"}{fbStatus === "fail" && "Failed"}
                  </Button>
                  <Button variant="ghost" size="sm" asChild>
                    <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noopener noreferrer" className="gap-1.5">
                      <ExternalLink className="h-3.5 w-3.5" /> Graph API Explorer
                    </a>
                  </Button>
                </div>
              </div>
            </div>

          </CardContent>
        )}
      </Card>

      {/* ── Instagram ───────────────────────────────── */}
      <Card className={channels.instagram.enabled ? "border-pink-500/40" : ""}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 text-white rounded-lg p-2">
                <Instagram className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  Instagram — @trichyinsight
                  {channels.instagram.enabled && <Badge className="text-[10px] bg-green-100 text-green-700">Active</Badge>}
                </CardTitle>
                <CardDescription className="text-xs">Auto-posts cover image + caption when you publish an article</CardDescription>
              </div>
            </div>
            <Switch checked={channels.instagram.enabled} onCheckedChange={(v) => updateIG("enabled", v)} />
          </div>
        </CardHeader>

        {channels.instagram.enabled && (
          <CardContent className="space-y-5 pt-0">

            {/* Step 1 — Webhook */}
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="bg-muted/50 px-4 py-2.5 border-b border-border flex items-center gap-2">
                <span className="bg-primary text-primary-foreground text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">1</span>
                <span className="text-sm font-medium">Configure Webhook in Meta for Developers</span>
              </div>
              <div className="p-4 space-y-3">
                <p className="text-xs text-muted-foreground">
                  Go to your app in <a href="https://developers.facebook.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">Meta for Developers</a> → Instagram → Webhooks → enter these values:
                </p>

                <div className="space-y-2">
                  <Label className="text-xs font-medium">Callback URL</Label>
                  <div className="flex gap-2 items-center">
                    <code className="flex-1 bg-muted text-foreground rounded px-3 py-1.5 text-xs font-mono break-all">
                      {WEBHOOK_CALLBACK_URL}
                    </code>
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0"
                      onClick={() => copyText(WEBHOOK_CALLBACK_URL, "webhook-url")}>
                      {copiedKey === "webhook-url" ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-medium">Verify Token</Label>
                  <div className="flex gap-2 items-center">
                    <code className="flex-1 bg-muted text-foreground rounded px-3 py-1.5 text-xs font-mono">
                      {WEBHOOK_VERIFY_TOKEN}
                    </code>
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0"
                      onClick={() => copyText(WEBHOOK_VERIFY_TOKEN, "verify-token")}>
                      {copiedKey === "verify-token" ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Paste these exactly into the Meta Developer webhook configuration fields</p>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-medium">Webhook Subscription fields to enable</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {["mentions", "story_insights", "comments", "live_comments"].map((f) => (
                      <code key={f} className="bg-muted rounded px-2 py-0.5 text-[11px] font-mono">{f}</code>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Step 2 — Business Login */}
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="bg-muted/50 px-4 py-2.5 border-b border-border flex items-center gap-2">
                <span className="bg-primary text-primary-foreground text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">2</span>
                <span className="text-sm font-medium">Connect via Instagram Business Login</span>
              </div>
              <div className="p-4 space-y-3">
                <p className="text-xs text-muted-foreground">
                  Click the button below — it opens Instagram's permission screen. After you approve, you'll be redirected back here and the token will be saved <strong>automatically</strong>.
                </p>

                <a
                  href="https://www.instagram.com/oauth/authorize?force_reauth=true&client_id=1976213376265645&redirect_uri=https%3A%2F%2Ftrichyinsight.online%2Fadmin&response_type=code&scope=instagram_business_basic%2Cinstagram_business_manage_messages%2Cinstagram_business_manage_comments%2Cinstagram_business_content_publish%2Cinstagram_business_manage_insights"
                  className="flex items-center justify-center gap-2 w-full rounded-lg py-2.5 px-4 text-sm font-semibold text-white"
                  style={{ background: "linear-gradient(135deg, #833ab4, #fd1d1d, #fcb045)" }}
                >
                  <Instagram className="h-4 w-4" />
                  Connect @trichyinsight with Instagram
                </a>

                <div className="flex items-start gap-2 bg-muted/50 rounded p-2.5">
                  <div className="mt-0.5 text-amber-500 shrink-0">⚠</div>
                  <p className="text-[11px] text-muted-foreground">
                    The token exchange requires <strong>INSTAGRAM_APP_SECRET</strong> to be set in your environment secrets. Without it, the auto-save won't work — add it from Meta for Developers → App Settings → Basic → App Secret.
                  </p>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-medium">Your Instagram Business Account ID</Label>
                  <div className="flex gap-2 items-center">
                    <code className="flex-1 bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-300 rounded px-3 py-1.5 text-xs font-mono font-bold">
                      {IG_USER_ID}
                    </code>
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0"
                      onClick={() => copyText(IG_USER_ID, "ig-user-id")}>
                      {copiedKey === "ig-user-id" ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 3 — Fill fields */}
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="bg-muted/50 px-4 py-2.5 border-b border-border flex items-center gap-2">
                <span className="bg-primary text-primary-foreground text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">3</span>
                <span className="text-sm font-medium">Paste Token Here</span>
              </div>
              <div className="p-4 space-y-3">
                <FieldRow
                  label="Instagram Business Account ID"
                  id="ig-user-id-field"
                  value={channels.instagram.igUserId || IG_USER_ID}
                  onChange={(v) => updateIG("igUserId", v)}
                  placeholder={IG_USER_ID}
                  hint="Your account ID — already set to 17841447727738548"
                />
                {/* Server secret status */}
                {serverConfig?.instagram.hasToken && (
                  <div className={`flex items-center gap-2 rounded-md px-3 py-2 text-xs ${
                    channels.instagram.accessToken
                      ? "bg-green-50 border border-green-200 text-green-700"
                      : "bg-amber-50 border border-amber-200 text-amber-700"
                  }`}>
                    <KeyRound className="h-3.5 w-3.5 shrink-0" />
                    {channels.instagram.accessToken ? (
                      <span>
                        <strong>Token saved in database + Replit secret.</strong> Fully configured.
                      </span>
                    ) : (
                      <div className="flex items-center justify-between w-full gap-2">
                        <span>
                          <strong>Replit secret detected</strong> ({serverConfig.instagram.tokenPrefix}) — server can post without a token here.
                          Enter the token to also save it in the database for full sync.
                        </span>
                      </div>
                    )}
                  </div>
                )}
                <FieldRow
                  label="Access Token (from Step 2)"
                  id="ig-token"
                  type="password"
                  value={channels.instagram.accessToken}
                  onChange={(v) => updateIG("accessToken", v)}
                  placeholder="Paste the token generated from Meta for Developers here..."
                  hint="Token must include instagram_basic and instagram_content_publish permissions"
                />
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={igValidating || !channels.instagram.accessToken}
                    onClick={() => void validateIGToken()}
                  >
                    {igValidating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                    {igValidating ? "சரிபார்க்கிறது..." : "Validate Token"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={igStatus === "testing"}
                    onClick={() => void handleTest("instagram")}
                  >
                    <StatusBadge status={igStatus} />
                    {igStatus === "idle" && "Send Test Post"}{igStatus === "testing" && "Posting..."}{igStatus === "ok" && "Posted!"}{igStatus === "fail" && "Failed"}
                  </Button>
                  <Button variant="ghost" size="sm" asChild>
                    <a href="https://developers.facebook.com" target="_blank" rel="noopener noreferrer" className="gap-1.5">
                      <ExternalLink className="h-3.5 w-3.5" /> Open Meta for Developers
                    </a>
                  </Button>
                </div>

                {igValidation && (
                  <div className={`rounded-md border p-3 text-xs space-y-1.5 ${igValidation.valid ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-800"}`}>
                    <div className="flex items-center gap-1.5 font-semibold">
                      {igValidation.valid
                        ? <><CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> Token valid</>
                        : <><AlertCircle className="h-3.5 w-3.5 shrink-0" /> Token invalid</>}
                    </div>
                    {igValidation.error && <p>{igValidation.error}</p>}
                    {igValidation.valid && (
                      <>
                        {igValidation.account?.username && <p>Account: @{igValidation.account.username}</p>}
                        <p>Expires: {igValidation.expires_human ?? "Unknown"}{igValidation.is_expired ? " ⚠ EXPIRED" : ""}</p>
                        <p>Publish permission: {igValidation.has_publish_scope ? "✓ Yes" : "✗ Missing — reconnect and grant instagram_content_publish"}</p>
                        {igValidation.scopes && igValidation.scopes.length > 0 && (
                          <p className="text-[10px] opacity-70">Scopes: {igValidation.scopes.join(", ")}</p>
                        )}
                      </>
                    )}
                    {!igValidation.app_secret_set && (
                      <p className="text-amber-700 font-medium mt-1">⚠ INSTAGRAM_APP_SECRET not set — OAuth auto-save won't work. Add it in Replit Secrets.</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="bg-amber-50 dark:bg-amber-950/20 rounded p-3 text-xs text-amber-700 dark:text-amber-300">
              <strong>Step 4 — App Review:</strong> Meta requires app review before posting live. While in development mode, you can only post to test accounts. Submit your app for review at Meta for Developers → App Review.
            </div>

            <p className="text-xs text-muted-foreground">
              ℹ️ Instagram auto-posts will only work if the article has a cover image (public HTTPS URL).
            </p>
          </CardContent>
        )}
      </Card>

      {/* ── WhatsApp ────────────────────────────────── */}
      <Card className={channels.whatsapp.enabled ? "border-green-500/40" : ""}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="bg-[#25D366] text-white rounded-lg p-2"><MessageCircle className="h-5 w-5" /></div>
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  WhatsApp
                  {channels.whatsapp.enabled && <Badge className="text-[10px] bg-green-100 text-green-700">Active</Badge>}
                </CardTitle>
                <CardDescription className="text-xs">Auto-send article to WhatsApp group or broadcast</CardDescription>
              </div>
            </div>
            <Switch checked={channels.whatsapp.enabled} onCheckedChange={(v) => updateWA("enabled", v)} />
          </div>
        </CardHeader>

        {channels.whatsapp.enabled && (
          <CardContent className="space-y-4 pt-0">
            {/* Provider selector */}
            <div>
              <Label className="text-xs mb-2 block">WhatsApp Provider</Label>
              <button
                onClick={() => setWaProviderOpen((p) => !p)}
                className="w-full flex items-center justify-between border border-border rounded px-3 py-2 text-sm hover:border-primary transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span>{selectedWAProvider.label}</span>
                  <Badge className={`text-[10px] ${selectedWAProvider.badgeColor}`}>{selectedWAProvider.badge}</Badge>
                </div>
                {waProviderOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              {waProviderOpen && (
                <div className="border border-border rounded mt-1 overflow-hidden">
                  {WA_PROVIDERS.map((p) => (
                    <button
                      key={p.value}
                      onClick={() => { updateWA("provider", p.value); setWaProviderOpen(false); }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-muted/50 transition-colors border-b border-border last:border-0 ${channels.whatsapp.provider === p.value ? "bg-primary/5 text-primary" : ""}`}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{p.label}</span>
                          <Badge className={`text-[10px] ${p.badgeColor}`}>{p.badge}</Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{p.description}</p>
                      </div>
                      {channels.whatsapp.provider === p.value && <CheckCircle2 className="h-4 w-4 shrink-0" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Dynamic fields based on provider */}
            <div className="space-y-3">
              <div className="bg-green-50 dark:bg-green-950/20 rounded p-3 text-xs text-green-700 dark:text-green-300">
                <p>{selectedWAProvider.description}</p>
                <a href={selectedWAProvider.link} target="_blank" rel="noopener noreferrer" className="underline font-medium flex items-center gap-1 mt-1">
                  Get credentials at {selectedWAProvider.label} <ExternalLink className="h-3 w-3" />
                </a>
              </div>

              {(selectedWAProvider.fields as readonly string[]).map((field) => {
                const label = selectedWAProvider.fieldLabels[field as keyof typeof selectedWAProvider.fieldLabels] ?? field;
                const placeholder = selectedWAProvider.placeholders[field as keyof typeof selectedWAProvider.placeholders];
                const isSecret = field === "apiToken" || field === "wabaToken";
                const value = channels.whatsapp[field as keyof DirectChannelSettings["whatsapp"]] as string;
                return (
                  <FieldRow
                    key={field}
                    label={label}
                    id={`wa-${field}`}
                    type={isSecret ? "password" : "text"}
                    value={value}
                    onChange={(v) => updateWA(field as keyof DirectChannelSettings["whatsapp"], v)}
                    placeholder={placeholder}
                  />
                );
              })}
            </div>

            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                disabled={waStatus === "testing"}
                onClick={() => void handleTest("whatsapp")}
              >
                <StatusBadge status={waStatus} />
                {waStatus === "idle" && "Send Test"}{waStatus === "testing" && "Sending..."}{waStatus === "ok" && "Sent!"}{waStatus === "fail" && "Failed"}
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      {/* ── Twitter / X ─────────────────────────────── */}
      <Card className={channels.twitter.enabled ? "border-sky-500/40" : ""}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="bg-black text-white rounded-lg p-2 w-9 h-9 flex items-center justify-center font-bold text-base">𝕏</div>
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  Twitter / X
                  {channels.twitter.enabled && <Badge className="text-[10px] bg-green-100 text-green-700">Active</Badge>}
                </CardTitle>
                <CardDescription className="text-xs">Posts headline + article link as a tweet on publish</CardDescription>
              </div>
            </div>
            <Switch checked={channels.twitter.enabled} onCheckedChange={(v) => updateTW("enabled", v)} />
          </div>
        </CardHeader>

        {channels.twitter.enabled && (
          <CardContent className="space-y-3 pt-0">
            <div className="bg-sky-50 dark:bg-sky-950/20 rounded p-3 text-xs text-sky-700 dark:text-sky-300 space-y-1">
              <p className="font-medium">Setup steps:</p>
              <ol className="list-decimal list-inside space-y-0.5 text-[11px]">
                <li>Go to <a href="https://developer.twitter.com/en/portal/projects-and-apps" target="_blank" rel="noopener noreferrer" className="underline">developer.twitter.com</a> → Create App</li>
                <li>Under <strong>Keys and Tokens</strong> → generate Consumer Keys + Access Token & Secret</li>
                <li>Set App permissions to <strong>Read and Write</strong></li>
                <li>Requires <strong>Basic ($100/mo)</strong> or higher Twitter API plan for posting</li>
              </ol>
            </div>
            <FieldRow label="API Key (Consumer Key)" id="tw-api-key" value={channels.twitter.apiKey}
              onChange={(v) => updateTW("apiKey", v)} placeholder="your_api_key" />
            <FieldRow label="API Secret (Consumer Secret)" id="tw-api-secret" value={channels.twitter.apiSecret}
              type="password" onChange={(v) => updateTW("apiSecret", v)} placeholder="your_api_secret" />
            <FieldRow label="Access Token" id="tw-access-token" value={channels.twitter.accessToken}
              type="password" onChange={(v) => updateTW("accessToken", v)} placeholder="your_access_token" />
            <FieldRow label="Access Token Secret" id="tw-access-secret" value={channels.twitter.accessTokenSecret}
              type="password" onChange={(v) => updateTW("accessTokenSecret", v)} placeholder="your_access_token_secret" />
            <div className="flex gap-2 pt-1">
              <Button variant="outline" size="sm"
                onClick={() => void handleTest("twitter")}
                disabled={!channels.twitter.apiKey || !channels.twitter.accessToken || twStatus === "testing"}>
                <StatusBadge status={twStatus} />
                {twStatus === "idle" && "Test Tweet"}{twStatus === "testing" && "Posting..."}{twStatus === "ok" && "Sent!"}{twStatus === "fail" && "Failed"}
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <a href="https://developer.twitter.com/en/portal/projects-and-apps" target="_blank" rel="noopener noreferrer" className="gap-1.5">
                  <ExternalLink className="h-3.5 w-3.5" /> Developer Portal
                </a>
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      {/* ── Bluesky ──────────────────────────────────── */}
      <Card className={channels.bluesky.enabled ? "border-indigo-500/40" : ""}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-600 text-white rounded-lg p-2 w-9 h-9 flex items-center justify-center text-base">🦋</div>
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  Bluesky
                  {channels.bluesky.enabled && <Badge className="text-[10px] bg-green-100 text-green-700">Active</Badge>}
                  <Badge className="text-[10px] bg-green-100 text-green-700">Free</Badge>
                </CardTitle>
                <CardDescription className="text-xs">Posts headline + article link to Bluesky — completely free, no API plan needed</CardDescription>
              </div>
            </div>
            <Switch checked={channels.bluesky.enabled} onCheckedChange={(v) => updateBS("enabled", v)} />
          </div>
        </CardHeader>

        {channels.bluesky.enabled && (
          <CardContent className="space-y-3 pt-0">
            <div className="bg-indigo-50 dark:bg-indigo-950/20 rounded p-3 text-xs text-indigo-700 dark:text-indigo-300 space-y-1">
              <p className="font-medium">Setup steps (free, takes 2 minutes):</p>
              <ol className="list-decimal list-inside space-y-0.5 text-[11px]">
                <li>Create a <a href="https://bsky.app" target="_blank" rel="noopener noreferrer" className="underline">Bluesky account</a> for Trichy Insight</li>
                <li>Go to <strong>Settings → App Passwords → Add App Password</strong></li>
                <li>Name it "TrichyInsight CMS" and paste the generated password below</li>
              </ol>
            </div>
            <FieldRow label="Bluesky Handle" id="bs-handle" value={channels.bluesky.handle}
              onChange={(v) => updateBS("handle", v)} placeholder="trichyinsight.bsky.social"
              hint="Your Bluesky username (with or without @)" />
            <FieldRow label="App Password" id="bs-password" value={channels.bluesky.appPassword}
              type="password" onChange={(v) => updateBS("appPassword", v)}
              placeholder="xxxx-xxxx-xxxx-xxxx" hint="Generated from Settings → App Passwords — NOT your login password" />
            <div className="flex gap-2 pt-1">
              <Button variant="outline" size="sm"
                onClick={() => void handleTest("bluesky")}
                disabled={!channels.bluesky.handle || !channels.bluesky.appPassword || bsStatus === "testing"}>
                <StatusBadge status={bsStatus} />
                {bsStatus === "idle" && "Test Post"}{bsStatus === "testing" && "Posting..."}{bsStatus === "ok" && "Sent!"}{bsStatus === "fail" && "Failed"}
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <a href="https://bsky.app/settings" target="_blank" rel="noopener noreferrer" className="gap-1.5">
                  <ExternalLink className="h-3.5 w-3.5" /> Bluesky Settings
                </a>
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Google News (auto, no config) */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="bg-red-600 text-white rounded-lg p-2"><Globe className="h-5 w-5" /></div>
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                Google News
                <Badge className="text-[10px] bg-green-100 text-green-700">Auto-enabled</Badge>
              </CardTitle>
              <CardDescription className="text-xs">Sitemap ping sent automatically on every publish — no config needed</CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Publishing workflow */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-heading uppercase">Publishing Workflow</CardTitle>
          <CardDescription className="text-xs">What happens when you click "Publish Article"</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3">
            {[
              { n: 1, text: "Article saved to database with is_published = true" },
              { n: 2, text: "Facebook Page post created via Graph API (if enabled)" },
              { n: 3, text: "Instagram image post created via Graph API (if enabled + cover image)" },
              { n: 4, text: "WhatsApp group message sent via your chosen provider (if enabled)" },
              { n: 5, text: "Tweet posted to Twitter/X (if enabled — requires paid API plan)" },
              { n: 6, text: "Post published to Bluesky via AT Protocol (if enabled — free)" },
              { n: 7, text: "Google News sitemap ping triggered automatically" },
              { n: 8, text: "Zapier outbound trigger fires (if configured in Zapier tab)" },
              { n: 9, text: "RSS feed at /api/rss.xml updated — OpenClaw newsletter reads from here" },
            ].map(({ n, text }) => (
              <li key={n} className="flex items-start gap-3 text-sm">
                <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs shrink-0 mt-0.5 font-bold">{n}</span>
                <span className="text-muted-foreground">{text}</span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
      {/* OpenClaw RSS / Newsletter */}
      <Card className="border-violet-500/30">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="bg-violet-600 text-white rounded-lg p-2 w-9 h-9 flex items-center justify-center text-base">🦀</div>
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                OpenClaw RSS Feed
                <Badge className="text-[10px] bg-violet-100 text-violet-700">Auto-enabled</Badge>
              </CardTitle>
              <CardDescription className="text-xs">Live RSS feed of all published articles — connect to OpenClaw newsletter, Zapier, and more</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 bg-muted rounded-md px-3 py-2">
            <code className="text-xs flex-1 text-muted-foreground">https://trichyinsight.online/api/rss.xml</code>
            <Button variant="ghost" size="sm" className="h-7 px-2"
              onClick={() => copyText("https://trichyinsight.online/api/rss.xml", "rss-url")}>
              {copiedKey === "rss-url" ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
          </div>
          <div className="text-xs text-muted-foreground space-y-2">
            <p className="font-medium text-foreground">Connect to OpenClaw:</p>
            <ol className="list-decimal list-inside space-y-1 text-[11px]">
              <li>Install the <strong>newsletter-curator</strong> or <strong>rss-monitor</strong> skill in OpenClaw</li>
              <li>Set the RSS source URL to the feed URL above</li>
              <li>OpenClaw reads new articles → drafts weekly newsletter → sends to subscribers</li>
              <li>Use the OpenClaw Twitter skill (TweetClaw) to post from this feed automatically</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
