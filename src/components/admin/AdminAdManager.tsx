import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, Eye, MousePointerClick, ToggleLeft, ToggleRight, Copy, ExternalLink, AlertCircle, Upload, Loader2, X, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { uploadToNewsMedia } from "@/lib/news-media";

const SETUP_SQL = `-- Run this in your Supabase SQL Editor:
create table if not exists public.ads (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slot text not null,
  type text not null default 'image',
  client_name text,
  image_url text,
  link_url text,
  html_code text,
  is_active boolean not null default true,
  priority int not null default 0,
  start_date timestamptz,
  end_date timestamptz,
  impression_count int not null default 0,
  click_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.ads enable row level security;
create policy "Anyone can read active ads" on public.ads for select using (is_active = true);
create policy "Authenticated can manage ads" on public.ads for all using (auth.role() = 'authenticated');`;

const AD_SLOTS = [
  {
    value: "homepage_banner",
    label: "முகப்பு — மேல் பேனர்",
    size: "970 × 90 px",
    placement: "முகப்பு பக்கம் மேல்",
    daily: "₹500",
    weekly: "₹2,500",
    monthly: "₹8,000",
    notes: "Leaderboard — அதிக பார்வையாளர்கள்",
  },
  {
    value: "homepage_mid",
    label: "முகப்பு — நடுவில்",
    size: "728 × 90 px",
    placement: "Hero section மற்றும் news grid இடையில்",
    daily: "₹400",
    weekly: "₹2,000",
    monthly: "₹6,500",
    notes: "Banner — scroll செய்யும்போது கண்ணில் படும்",
  },
  {
    value: "homepage_bottom",
    label: "முகப்பு — கீழே",
    size: "728 × 90 px",
    placement: "முகப்பு செய்திகளுக்கு கீழே",
    daily: "₹300",
    weekly: "₹1,500",
    monthly: "₹5,000",
    notes: "Banner — படிக்கும் வாசகர்களை இலக்காக",
  },
  {
    value: "article_top",
    label: "கட்டுரை — மேல்",
    size: "728 × 90 px",
    placement: "கட்டுரை படிக்கும் முன் பார்க்கும் இடம்",
    daily: "₹400",
    weekly: "₹2,000",
    monthly: "₹6,500",
    notes: "Banner — கட்டுரைக்கு முன் high attention",
  },
  {
    value: "article_bottom",
    label: "கட்டுரை — கீழே",
    size: "728 × 90 px",
    placement: "கட்டுரை படித்த பின் காண்பிக்கும்",
    daily: "₹350",
    weekly: "₹1,750",
    monthly: "₹5,500",
    notes: "Banner — engaged வாசகர்களை இலக்காக",
  },
  {
    value: "sidebar",
    label: "பக்கப்பட்டி",
    size: "300 × 250 px",
    placement: "பக்கவாட்டு — எல்லா பக்கங்களிலும்",
    daily: "₹300",
    weekly: "₹1,500",
    monthly: "₹5,000",
    notes: "Medium Rectangle — நிரந்தர பார்வை",
  },
];

const AD_TYPES = [
  { value: "image", label: "படம் + இணைப்பு" },
  { value: "html",  label: "HTML / Embed Code" },
];

type Ad = {
  id: string;
  title: string;
  slot: string;
  type: string;
  client_name: string | null;
  image_url: string | null;
  link_url: string | null;
  html_code: string | null;
  is_active: boolean;
  priority: number;
  start_date: string | null;
  end_date: string | null;
  impression_count: number;
  click_count: number;
  created_at: string;
};

const emptyForm = {
  title: "",
  slot: "homepage_banner",
  type: "image",
  client_name: "",
  image_url: "",
  link_url: "",
  html_code: "",
  is_active: true,
  priority: 0,
  start_date: "",
  end_date: "",
};

const AdminAdManager = () => {
  const { toast } = useToast();
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableExists, setTableExists] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [sqlCopied, setSqlCopied] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAdImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "படம் மட்டும் upload செய்யவும்", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "படம் 5 MB-க்கு குறைவாக இருக்க வேண்டும்", variant: "destructive" });
      return;
    }
    try {
      setUploading(true);
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id ?? "ads";
      const publicUrl = await uploadToNewsMedia(userId, file);
      f("image_url", publicUrl);
      toast({ title: "விளம்பர படம் upload ஆனது!" });
    } catch (err) {
      toast({
        title: "Upload தோல்வி",
        description: err instanceof Error ? err.message : "Upload failed",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const fetchAds = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("ads" as never)
      .select("*")
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      if (
        error.code === "42P01" ||
        error.code === "PGRST204" ||
        error.code === "PGRST200" ||
        error.message?.includes("does not exist") ||
        error.message?.includes("schema cache") ||
        error.message?.includes("Could not find")
      ) {
        setTableExists(false);
      } else {
        toast({ title: "பிழை", description: error.message, variant: "destructive" });
      }
      setLoading(false);
      return;
    }
    setTableExists(true);
    setAds((data as Ad[]) || []);
    setLoading(false);
  };

  useEffect(() => { void fetchAds(); }, []);

  const f = (key: keyof typeof form, val: string | boolean | number) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  const resetForm = () => { setForm(emptyForm); setEditId(null); setShowForm(false); };

  const startEdit = (ad: Ad) => {
    setForm({
      title: ad.title,
      slot: ad.slot,
      type: ad.type,
      client_name: ad.client_name || "",
      image_url: ad.image_url || "",
      link_url: ad.link_url || "",
      html_code: ad.html_code || "",
      is_active: ad.is_active,
      priority: ad.priority,
      start_date: ad.start_date ? ad.start_date.slice(0, 10) : "",
      end_date: ad.end_date ? ad.end_date.slice(0, 10) : "",
    });
    setEditId(ad.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSave = async () => {
    if (!form.title.trim()) { toast({ title: "தலைப்பு தேவை", variant: "destructive" }); return; }
    if (form.type === "image" && !form.image_url.trim()) { toast({ title: "படத்தின் URL தேவை", variant: "destructive" }); return; }
    if (form.type === "html" && !form.html_code.trim()) { toast({ title: "HTML code தேவை", variant: "destructive" }); return; }

    setSaving(true);
    const payload = {
      title: form.title.trim(),
      slot: form.slot,
      type: form.type,
      client_name: form.client_name.trim() || null,
      image_url: form.type === "image" ? form.image_url.trim() : null,
      link_url: form.link_url.trim() || null,
      html_code: form.type === "html" ? form.html_code.trim() : null,
      is_active: form.is_active,
      priority: Number(form.priority),
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      updated_at: new Date().toISOString(),
    };

    const { error } = editId
      ? await supabase.from("ads" as never).update(payload as never).eq("id", editId)
      : await supabase.from("ads" as never).insert(payload as never);

    if (error) {
      toast({ title: "சேமிக்க முடியவில்லை", description: error.message, variant: "destructive" });
    } else {
      toast({ title: editId ? "விளம்பரம் புதுப்பிக்கப்பட்டது" : "விளம்பரம் சேர்க்கப்பட்டது" });
      resetForm();
      void fetchAds();
    }
    setSaving(false);
  };

  const handleToggle = async (ad: Ad) => {
    const { error } = await supabase
      .from("ads" as never)
      .update({ is_active: !ad.is_active, updated_at: new Date().toISOString() } as never)
      .eq("id", ad.id);
    if (error) { toast({ title: "பிழை", description: error.message, variant: "destructive" }); return; }
    setAds((prev) => prev.map((a) => a.id === ad.id ? { ...a, is_active: !a.is_active } : a));
  };

  const handleDelete = async (id: string) => {
    if (!confirm("இந்த விளம்பரத்தை நீக்கவா?")) return;
    const { error } = await supabase.from("ads" as never).delete().eq("id", id);
    if (error) { toast({ title: "நீக்க முடியவில்லை", description: error.message, variant: "destructive" }); return; }
    toast({ title: "நீக்கப்பட்டது" });
    setAds((prev) => prev.filter((a) => a.id !== id));
  };

  const copySQL = async () => {
    await navigator.clipboard.writeText(SETUP_SQL);
    setSqlCopied(true);
    setTimeout(() => setSqlCopied(false), 2000);
  };

  const slotLabel = (slot: string) => AD_SLOTS.find((s) => s.value === slot)?.label ?? slot;

  if (!tableExists) {
    return (
      <div className="space-y-4">
        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-yellow-600">
              <AlertCircle className="h-5 w-5" /> Database அமைவு தேவை
            </CardTitle>
            <CardDescription>
              விளம்பரங்களை நிர்வகிக்க Supabase-ல் ஒரு table உருவாக்க வேண்டும்.
              கீழே உள்ள SQL-ஐ Supabase Dashboard → SQL Editor-ல் ஒட்டி Run செய்யவும்.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <pre className="text-xs bg-muted rounded p-3 overflow-x-auto whitespace-pre-wrap border border-border">
              {SETUP_SQL}
            </pre>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={copySQL}>
                <Copy className="h-3.5 w-3.5 mr-1" /> {sqlCopied ? "நகலெடுக்கப்பட்டது!" : "SQL நகலெடு"}
              </Button>
              <Button size="sm" variant="outline" asChild>
                <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer">
                  <ExternalLink className="h-3.5 w-3.5 mr-1" /> Supabase திற
                </a>
              </Button>
              <Button size="sm" onClick={() => void fetchAds()}>மீண்டும் சோதி</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardDescription className="text-xs">மொத்த விளம்பரங்கள்</CardDescription>
            <CardTitle className="text-2xl">{ads.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardDescription className="text-xs">செயலில் உள்ளவை</CardDescription>
            <CardTitle className="text-2xl text-green-600">{ads.filter((a) => a.is_active).length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardDescription className="text-xs flex items-center gap-1"><Eye className="h-3 w-3" /> மொத்த views</CardDescription>
            <CardTitle className="text-2xl">{ads.reduce((s, a) => s + (a.impression_count || 0), 0).toLocaleString()}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardDescription className="text-xs flex items-center gap-1"><MousePointerClick className="h-3 w-3" /> மொத்த clicks</CardDescription>
            <CardTitle className="text-2xl">{ads.reduce((s, a) => s + (a.click_count || 0), 0).toLocaleString()}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Create / Edit form */}
      {showForm && (
        <Card className="border-primary/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{editId ? "விளம்பரம் திருத்து" : "புதிய விளம்பரம் சேர்"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>தலைப்பு (உள் பெயர்) *</Label>
                <Input value={form.title} onChange={(e) => f("title", e.target.value)} placeholder="e.g. Hero Banner – March 2025" />
              </div>
              <div className="space-y-1.5">
                <Label>விளம்பரதாரர் பெயர்</Label>
                <Input value={form.client_name} onChange={(e) => f("client_name", e.target.value)} placeholder="e.g. Trichy Mall" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>இடம் (Slot) *</Label>
                <Select value={form.slot} onValueChange={(v) => f("slot", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {AD_SLOTS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>வகை *</Label>
                <Select value={form.type} onValueChange={(v) => f("type", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {AD_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>முன்னுரிமை (0–100)</Label>
                <Input type="number" value={form.priority} onChange={(e) => f("priority", Number(e.target.value))} min={0} max={100} />
              </div>
            </div>

            {form.type === "image" && (
              <div className="space-y-4">
                {/* Upload zone */}
                <div className="space-y-1.5">
                  <Label>விளம்பர படம் *</Label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAdImageUpload}
                    disabled={uploading}
                  />
                  {form.image_url ? (
                    <div className="border border-border rounded-lg overflow-hidden">
                      <div className="relative bg-muted/30">
                        <img
                          src={form.image_url}
                          alt="Ad preview"
                          className="w-full max-h-48 object-contain"
                        />
                        <div className="absolute top-2 right-2 flex gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            className="h-7 text-xs gap-1 shadow-sm"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploading}
                          >
                            {uploading
                              ? <Loader2 className="h-3 w-3 animate-spin" />
                              : <Upload className="h-3 w-3" />}
                            மாற்று
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            className="h-7 text-xs gap-1 shadow-sm text-destructive hover:text-destructive"
                            onClick={() => f("image_url", "")}
                          >
                            <X className="h-3 w-3" /> நீக்கு
                          </Button>
                        </div>
                      </div>
                      <div className="px-3 py-2 text-[10px] text-muted-foreground truncate border-t border-border bg-muted/20">
                        {form.image_url}
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={uploading}
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full border-2 border-dashed border-border rounded-lg px-4 py-8 flex flex-col items-center gap-3 text-center hover:border-primary/50 hover:bg-muted/30 transition-colors disabled:opacity-60 cursor-pointer"
                    >
                      {uploading ? (
                        <>
                          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Upload ஆகிறது...</span>
                        </>
                      ) : (
                        <>
                          <div className="bg-muted rounded-full p-3">
                            <ImageIcon className="h-6 w-6 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">படம் Upload செய்ய கிளிக் செய்யவும்</p>
                            <p className="text-xs text-muted-foreground mt-0.5">JPG, PNG, WebP • அதிகபட்சம் 5 MB</p>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Upload className="h-3.5 w-3.5" /> கம்ப்யூட்டரிலிருந்து தேர்வு செய்யவும்
                          </div>
                        </>
                      )}
                    </button>
                  )}
                </div>

                {/* URL paste fallback */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">அல்லது படத்தின் URL நேரடியாக ஒட்டவும்</Label>
                  <Input
                    value={form.image_url}
                    onChange={(e) => f("image_url", e.target.value)}
                    placeholder="https://example.com/ad-banner.jpg"
                    className="text-xs"
                  />
                </div>

                {/* Click URL */}
                <div className="space-y-1.5">
                  <Label>இணைப்பு URL (Click URL)</Label>
                  <Input value={form.link_url} onChange={(e) => f("link_url", e.target.value)} placeholder="https://..." />
                </div>
              </div>
            )}

            {form.type === "html" && (
              <div className="space-y-1.5">
                <Label>HTML / Embed Code *</Label>
                <Textarea
                  rows={5}
                  value={form.html_code}
                  onChange={(e) => f("html_code", e.target.value)}
                  placeholder="<script>...</script> அல்லது <ins class='adsbygoogle' ...>"
                  className="font-mono text-xs"
                />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>தொடக்க தேதி</Label>
                <Input type="date" value={form.start_date} onChange={(e) => f("start_date", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>முடிவு தேதி</Label>
                <Input type="date" value={form.end_date} onChange={(e) => f("end_date", e.target.value)} />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={(v) => f("is_active", v)} id="ad-active" />
              <Label htmlFor="ad-active">உடனே செயல்படுத்து</Label>
            </div>

            <div className="flex gap-2">
              <Button onClick={() => void handleSave()} disabled={saving}>
                {saving ? "சேமிக்கிறது..." : editId ? "புதுப்பி" : "சேர்"}
              </Button>
              <Button variant="outline" onClick={resetForm}>ரத்து</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add button */}
      {!showForm && (
        <Button onClick={() => setShowForm(true)} className="gap-1.5">
          <Plus className="h-4 w-4" /> புதிய விளம்பரம்
        </Button>
      )}

      {/* Ads list */}
      {loading ? (
        <div className="text-sm text-muted-foreground">ஏற்றுகிறது...</div>
      ) : ads.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-muted-foreground">
            <p className="text-sm">விளம்பரங்கள் இல்லை. மேலே "புதிய விளம்பரம்" கிளிக் செய்யவும்.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {ads.map((ad) => (
            <Card key={ad.id} className={`border ${!ad.is_active ? "opacity-60" : ""}`}>
              <CardContent className="flex flex-col sm:flex-row sm:items-center gap-3 py-3 px-4">
                {/* Thumbnail */}
                {ad.type === "image" && ad.image_url && (
                  <img src={ad.image_url} alt={ad.title} className="w-20 h-14 object-cover rounded border border-border shrink-0" />
                )}
                {ad.type === "html" && (
                  <div className="w-20 h-14 bg-muted rounded border border-border flex items-center justify-center shrink-0">
                    <span className="text-[10px] text-muted-foreground font-mono">HTML</span>
                  </div>
                )}

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5 mb-1">
                    <span className="font-medium text-sm truncate">{ad.title}</span>
                    <Badge variant={ad.is_active ? "default" : "secondary"} className="text-[10px] px-1.5 py-0">
                      {ad.is_active ? "Active" : "Paused"}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">{slotLabel(ad.slot)}</Badge>
                  </div>
                  {ad.client_name && (
                    <p className="text-xs text-muted-foreground truncate">{ad.client_name}</p>
                  )}
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-0.5"><Eye className="h-3 w-3" /> {(ad.impression_count || 0).toLocaleString()}</span>
                    <span className="flex items-center gap-0.5"><MousePointerClick className="h-3 w-3" /> {(ad.click_count || 0).toLocaleString()}</span>
                    {ad.impression_count > 0 && (
                      <span>CTR: {((ad.click_count / ad.impression_count) * 100).toFixed(1)}%</span>
                    )}
                    {ad.end_date && <span>வரை: {new Date(ad.end_date).toLocaleDateString("ta-IN")}</span>}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => handleToggle(ad)} title={ad.is_active ? "நிறுத்து" : "தொடங்கு"}>
                    {ad.is_active ? <ToggleRight className="h-4 w-4 text-green-600" /> : <ToggleLeft className="h-4 w-4" />}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => startEdit(ad)}>திருத்து</Button>
                  <Button size="sm" variant="ghost" onClick={() => void handleDelete(ad.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Rate Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            விளம்பர விலை மற்றும் அளவு
          </CardTitle>
          <CardDescription>
            விளம்பரதாரர்களுக்கு வழங்க வேண்டிய Rate Card. படத்தை upload செய்யும்போது சரியான அளவைப் பயன்படுத்தவும்.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-xs uppercase font-heading tracking-wider text-muted-foreground">
                  <th className="px-4 py-2.5 text-left">இடம்</th>
                  <th className="px-4 py-2.5 text-left">அளவு (px)</th>
                  <th className="px-4 py-2.5 text-left hidden md:table-cell">இடம் விளக்கம்</th>
                  <th className="px-4 py-2.5 text-right">தினம்</th>
                  <th className="px-4 py-2.5 text-right">வாரம்</th>
                  <th className="px-4 py-2.5 text-right">மாதம்</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {AD_SLOTS.map((s, i) => (
                  <tr key={s.value} className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}>
                    <td className="px-4 py-3">
                      <div className="font-medium">{s.label}</div>
                      <div className="text-[10px] text-muted-foreground font-mono mt-0.5">{s.value}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5 md:hidden">{s.notes}</div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="font-mono text-[11px] whitespace-nowrap">
                        {s.size}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-xs text-muted-foreground">
                      <div>{s.placement}</div>
                      <div className="text-primary text-[10px] mt-0.5">{s.notes}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-sm">{s.daily}</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-sm">{s.weekly}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-sm text-primary">{s.monthly}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Size reference visuals */}
      <Card className="border-dashed">
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="text-sm">படத்தின் அளவு வழிகாட்டி</CardTitle>
          <CardDescription className="text-xs">விளம்பர படங்களை இந்த exact dimensions-ல் உருவாக்கவும். JPG அல்லது PNG format-ல் 72–150 DPI ஆக export செய்யவும்.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            { label: "Leaderboard", size: "970 × 90 px", ratio: "10.8:1", slots: ["homepage_banner"], color: "bg-blue-500/10 border-blue-500/30" },
            { label: "Banner", size: "728 × 90 px", ratio: "8:1", slots: ["homepage_mid", "homepage_bottom", "article_top", "article_bottom"], color: "bg-green-500/10 border-green-500/30" },
            { label: "Medium Rectangle", size: "300 × 250 px", ratio: "6:5", slots: ["sidebar"], color: "bg-purple-500/10 border-purple-500/30" },
          ].map((dim) => (
            <div key={dim.label} className={`rounded border p-3 ${dim.color}`}>
              <div className="font-heading text-xs uppercase tracking-wider mb-2">{dim.label}</div>
              <div className="font-mono font-bold text-base mb-1">{dim.size}</div>
              <div className="text-xs text-muted-foreground mb-2">Aspect ratio {dim.ratio}</div>
              <div className="flex flex-wrap gap-1">
                {dim.slots.map((slot) => (
                  <Badge key={slot} variant="secondary" className="text-[9px] px-1 py-0 font-mono">{slot}</Badge>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Terms */}
      <Card className="border-dashed bg-muted/30">
        <CardContent className="py-3 px-4">
          <p className="text-xs font-heading uppercase tracking-wider text-muted-foreground mb-2">விளம்பர விதிமுறைகள்</p>
          <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
            <li>விளம்பர கட்டணம் முன்பணமாக (advance) செலுத்தப்பட வேண்டும்</li>
            <li>JPG / PNG format மட்டுமே; file size 500KB-க்கு மிகாமல் இருக்கவும்</li>
            <li>Trichy Insight-இன் editorial standards-க்கு பொருந்தாத விளம்பரங்கள் நிராகரிக்கப்படும்</li>
            <li>விளம்பர காலத்தில் impression மற்றும் click report வழங்கப்படும்</li>
            <li>விலை GST தவிர — 18% GST கூடுதலாக பொருந்தும்</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminAdManager;
