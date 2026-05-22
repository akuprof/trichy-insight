import { useState } from "react";
import {
  AlertCircle, CheckCircle2, ChevronDown, ChevronUp,
  Copy, ExternalLink, Loader2, Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  buildZapierPayload,
  defaultZapierHooks,
  loadZapierHooks,
  saveZapierHooks,
  sendZapierWebhook,
  type ZapierHooks,
} from "@/lib/zapier-publish";

const ZAPIER_HOOK_EVENTS = [
  {
    key: "published" as const,
    event: "article.published" as const,
    label: "Article Published",
    description: "Fired every time an article is published or toggled live. Use this to auto-post to social media, send Slack alerts, or add to your RSS aggregator.",
    color: "text-green-500",
    badgeColor: "bg-green-100 text-green-700",
  },
  {
    key: "scheduled" as const,
    event: "article.scheduled" as const,
    label: "Article Scheduled",
    description: "Fired when an article is saved with a future publish date. Use to notify your team or add to a Google Calendar event.",
    color: "text-yellow-500",
    badgeColor: "bg-yellow-100 text-yellow-700",
  },
  {
    key: "draft" as const,
    event: "article.draft_saved" as const,
    label: "Draft Saved",
    description: "Fired when any draft is saved. Use for backup workflows, Notion sync, or editorial review notifications.",
    color: "text-blue-500",
    badgeColor: "bg-blue-100 text-blue-700",
  },
] as const;

const DEMO_POST = {
  id: "demo-00001",
  title: "திருச்சியில் புதிய மாநகராட்சி திட்டம் அறிவிப்பு",
  slug: "trichy-corporation-new-project-announcement",
  category: "குடிமை",
  excerpt: "திருச்சி மாநகராட்சி புதிய உட்கட்டமைப்பு திட்டத்தை இன்று அறிவித்தது.",
  content: "முழு செய்தி உள்ளடக்கம்...",
  cover_image_url: "https://trichyinsight.online/og-image.jpg",
  video_url: null,
  meta_title: "புதிய மாநகராட்சி திட்டம் | Trichy Insight",
  meta_description: "திருச்சி மாநகராட்சியின் புதிய திட்டம் பற்றிய விரிவான செய்தி.",
  meta_keywords: ["trichy", "corporation", "infrastructure"],
  published_at: new Date().toISOString(),
  is_published: true,
};

const INBOUND_URL = `${window.location.origin.replace(/\/$/, "")}/api/zapier/article`;

type HookStatus = "idle" | "testing" | "success" | "error";

export default function AdminZapierPanel() {
  const { toast } = useToast();
  const [hooks, setHooks] = useState<ZapierHooks>(() => loadZapierHooks());
  const [hookStatus, setHookStatus] = useState<Record<string, HookStatus>>({});
  const [payloadOpen, setPayloadOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const updateHook = <K extends keyof ZapierHooks>(
    hookKey: K,
    field: keyof ZapierHooks[K],
    value: unknown
  ) => {
    setHooks((prev) => ({
      ...prev,
      [hookKey]: { ...(prev[hookKey] as object), [field]: value },
    }));
  };

  const handleSave = () => {
    setSaving(true);
    saveZapierHooks(hooks);
    setTimeout(() => {
      setSaving(false);
      toast({ title: "Zapier settings saved" });
    }, 300);
  };

  const handleReset = () => {
    const fresh = defaultZapierHooks();
    setHooks(fresh);
    saveZapierHooks(fresh);
    toast({ title: "Zapier settings reset" });
  };

  const handleTest = async (hookKey: "published" | "scheduled" | "draft", event: typeof ZAPIER_HOOK_EVENTS[number]["event"]) => {
    const hook = hooks[hookKey];
    if (!hook.url?.trim()) {
      toast({ title: "Webhook URL தேவை", variant: "destructive" });
      return;
    }
    setHookStatus((p) => ({ ...p, [hookKey]: "testing" }));
    const payload = buildZapierPayload(event, DEMO_POST);
    const result = await sendZapierWebhook({ ...hook, enabled: true }, payload);
    setHookStatus((p) => ({ ...p, [hookKey]: result.success ? "success" : "error" }));
    if (result.success) {
      toast({ title: `Test payload sent! (${result.status ?? "OK"})` });
    } else {
      toast({ title: "Test failed", description: result.error || `HTTP ${result.status}`, variant: "destructive" });
    }
    setTimeout(() => setHookStatus((p) => ({ ...p, [hookKey]: "idle" })), 4000);
  };

  const copyToClipboard = (text: string, key: string) => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    });
  };

  const demoPayload = buildZapierPayload("article.published", DEMO_POST);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-heading text-xl uppercase flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" /> Zapier Automation
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Connect Trichy Insight to 6,000+ apps via Zapier webhooks.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={handleReset}>Reset</Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save All"}
          </Button>
        </div>
      </div>

      {/* Quick setup guide */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="pt-4 pb-4">
          <p className="text-sm font-medium mb-2">⚡ Quick Setup</p>
          <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
            <li>Go to <a href="https://zapier.com/apps/webhooks" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 inline-flex items-center gap-0.5">zapier.com <ExternalLink className="h-3 w-3" /></a> and create a new Zap</li>
            <li>Choose <strong>Webhooks by Zapier</strong> → <strong>Catch Hook</strong> as the trigger</li>
            <li>Copy the Zapier webhook URL and paste it into the field below</li>
            <li>Click <strong>Test</strong> to send a sample payload</li>
            <li>Configure your action (Twitter, WhatsApp, Google Sheets, Slack, etc.)</li>
          </ol>
        </CardContent>
      </Card>

      {/* Outbound triggers */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs font-heading uppercase tracking-wider text-muted-foreground px-2">Outbound Triggers (CMS → Zapier)</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        {ZAPIER_HOOK_EVENTS.map(({ key, event, label, description, badgeColor }) => {
          const hook = hooks[key];
          const status = hookStatus[key] ?? "idle";
          return (
            <Card key={key} className={hook.enabled && hook.url ? "border-border" : "border-dashed border-muted-foreground/30"}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="font-heading text-base uppercase flex items-center gap-2">
                      {label}
                      <Badge className={`text-[10px] font-normal ${badgeColor}`}>{event}</Badge>
                    </CardTitle>
                    <CardDescription className="text-xs mt-1">{description}</CardDescription>
                  </div>
                  <Switch
                    checked={hook.enabled}
                    onCheckedChange={(v) => updateHook(key, "enabled", v)}
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">Zapier Webhook URL</Label>
                    <Input
                      placeholder="https://hooks.zapier.com/hooks/catch/..."
                      value={hook.url}
                      onChange={(e) => updateHook(key, "url", e.target.value)}
                      disabled={!hook.enabled}
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!hook.url?.trim() || status === "testing"}
                      onClick={() => void handleTest(key, event)}
                      className="gap-1.5 min-w-[80px]"
                    >
                      {status === "testing" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : status === "success" ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : status === "error" ? (
                        <AlertCircle className="h-4 w-4 text-destructive" />
                      ) : (
                        <Zap className="h-4 w-4" />
                      )}
                      {status === "testing" ? "..." : "Test"}
                    </Button>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Secret Token (Optional)</Label>
                  <Input
                    type="password"
                    placeholder="Sent as X-Zapier-Secret header"
                    value={hook.secret ?? ""}
                    onChange={(e) => updateHook(key, "secret", e.target.value)}
                    disabled={!hook.enabled}
                  />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Inbound endpoint */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs font-heading uppercase tracking-wider text-muted-foreground px-2">Inbound Webhook (Zapier → CMS)</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-base uppercase">Receive Content from Zapier</CardTitle>
            <CardDescription>
              Use this endpoint in a Zapier Action step to automatically create draft articles in your CMS from any source — RSS feeds, Google Sheets, AI tools, and more.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label className="text-xs">Endpoint URL</Label>
              <div className="flex gap-2 items-center">
                <code className="flex-1 bg-muted rounded px-3 py-2 text-xs font-mono break-all">{INBOUND_URL}</code>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => copyToClipboard(INBOUND_URL, "url")}>
                  {copiedKey === "url" ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Method</Label>
              <code className="block bg-muted rounded px-3 py-2 text-xs font-mono">POST</code>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Required JSON Fields</Label>
              <div className="bg-muted rounded p-3 text-xs font-mono space-y-1">
                <div><span className="text-primary">title</span> — Article headline</div>
                <div><span className="text-primary">category</span> — e.g. "அரசியல்"</div>
                <div><span className="text-primary">content</span> — Full article body</div>
                <div className="text-muted-foreground pt-1">Optional: slug, excerpt, cover_image_url, video_url, meta_title, meta_description, meta_keywords, publish (bool)</div>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Inbound Secret (Optional — set ZAPIER_INBOUND_SECRET in env)</Label>
              <div className="flex gap-2 items-center">
                <Input
                  placeholder="Your inbound secret for X-Zapier-Inbound-Secret header"
                  value={hooks.inbound_secret}
                  onChange={(e) => setHooks((p) => ({ ...p, inbound_secret: e.target.value }))}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Add this as a header in Zapier: <code>x-zapier-inbound-secret: your-secret</code>
              </p>
            </div>

            <div>
              <Button variant="outline" size="sm" asChild>
                <a href={INBOUND_URL.replace("/article", "/test")} target="_blank" rel="noopener noreferrer" className="gap-1.5">
                  <ExternalLink className="h-4 w-4" /> Verify endpoint is live
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payload preview */}
      <Card>
        <CardHeader className="cursor-pointer pb-3" onClick={() => setPayloadOpen((p) => !p)}>
          <div className="flex items-center justify-between">
            <CardTitle className="font-heading text-base uppercase">Payload Preview</CardTitle>
            {payloadOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
          <CardDescription className="text-xs">The exact JSON Zapier receives for each article event</CardDescription>
        </CardHeader>
        {payloadOpen && (
          <CardContent>
            <div className="relative">
              <pre className="bg-muted rounded p-4 text-xs font-mono overflow-x-auto max-h-80 overflow-y-auto leading-relaxed">
                {JSON.stringify(demoPayload, null, 2)}
              </pre>
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 h-7 w-7"
                onClick={() => copyToClipboard(JSON.stringify(demoPayload, null, 2), "payload")}
              >
                {copiedKey === "payload" ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Popular Zap ideas */}
      <Card className="border-dashed">
        <CardContent className="pt-4 pb-4">
          <p className="text-xs font-heading uppercase tracking-wider text-muted-foreground mb-3">Popular Zap Ideas</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[
              { icon: "📱", title: "Auto WhatsApp", desc: "Post to WhatsApp group on publish" },
              { icon: "🐦", title: "Auto Tweet", desc: "Tweet headline + URL on publish" },
              { icon: "📊", title: "Google Sheets Log", desc: "Log every article to a spreadsheet" },
              { icon: "🔔", title: "Slack Notify", desc: "Alert team when article goes live" },
              { icon: "📰", title: "RSS → CMS", desc: "Import feeds as draft articles" },
              { icon: "🤖", title: "ChatGPT Pipeline", desc: "AI-summarize then create draft" },
            ].map((idea) => (
              <div key={idea.title} className="flex items-center gap-2.5 bg-muted/40 rounded p-2.5 text-xs">
                <span className="text-lg leading-none">{idea.icon}</span>
                <div>
                  <div className="font-medium">{idea.title}</div>
                  <div className="text-muted-foreground">{idea.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
