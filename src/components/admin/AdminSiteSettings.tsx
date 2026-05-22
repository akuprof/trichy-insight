import { useEffect, useState } from "react";
import { Plus, Save, Trash2, Palette, Globe, Users, Phone, Search, Tag, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_SETTINGS, useSiteSettings, type SiteCategory, type SiteSettings } from "@/contexts/SiteSettingsContext";

const Section = ({ icon: Icon, title, description, children }: {
  icon: React.ElementType; title: string; description: string; children: React.ReactNode;
}) => (
  <Card className="mb-6">
    <CardHeader className="pb-3">
      <CardTitle className="flex items-center gap-2 text-base">
        <Icon className="h-4 w-4 text-primary" />
        {title}
      </CardTitle>
      <CardDescription className="text-xs">{description}</CardDescription>
    </CardHeader>
    <CardContent className="space-y-4">{children}</CardContent>
  </Card>
);

const Field = ({ label, id, value, onChange, type = "text", placeholder, hint }: {
  label: string; id: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; hint?: string;
}) => (
  <div className="space-y-1">
    <Label htmlFor={id} className="text-xs font-medium">{label}</Label>
    <Input id={id} type={type} value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder} className="text-sm h-9" />
    {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
  </div>
);

export default function AdminSiteSettings() {
  const { settings: live, refresh } = useSiteSettings();
  const [form, setForm] = useState<SiteSettings>(DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => { setForm(live); }, [live]);

  const set = (key: keyof SiteSettings) => (val: string) =>
    setForm(f => ({ ...f, [key]: val }));

  const addCategory = () =>
    setForm(f => ({
      ...f,
      categories: [...f.categories, { id: `cat_${Date.now()}`, label: "", color: "#6366F1" }],
    }));

  const removeCategory = (idx: number) =>
    setForm(f => ({ ...f, categories: f.categories.filter((_, i) => i !== idx) }));

  const updateCategory = (idx: number, field: keyof SiteCategory, val: string) =>
    setForm(f => ({
      ...f,
      categories: f.categories.map((c, i) => i === idx ? { ...c, [field]: val } : c),
    }));

  const save = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("site_settings")
        .upsert({ id: 1, settings: form as unknown as import("@/integrations/supabase/types").Json }, { onConflict: "id" });
      if (error) throw error;
      await refresh();
      toast({ title: "அமைப்புகள் சேமிக்கப்பட்டன ✓", description: "தளத்தில் மாற்றங்கள் உடனடியாக பிரதிபலிக்கும்." });
    } catch (err) {
      toast({ title: "சேமிப்பு தோல்வி", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const isNewInstall = live.site_name === "Trichy Insight" && live.domain === "trichyinsight.online";

  return (
    <div className="space-y-2 max-w-3xl">
      {isNewInstall && (
        <Card className="border-amber-400 bg-amber-50 dark:bg-amber-950/30 mb-6">
          <CardContent className="pt-4 pb-3">
            <div className="flex gap-3 items-start">
              <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">புதிய நிறுவல் கண்டறியப்பட்டது</p>
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                  இது இன்னும் Trichy Insight இன் இயல்புநிலை அமைப்புகளில் இயங்குகிறது.
                  உங்கள் வெளியீட்டின் பெயர், லோகோ மற்றும் தொடர்பு விவரங்களை கீழே புதுப்பிக்கவும்.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Section icon={Globe} title="தள அடையாளம்" description="வெளியீட்டின் பெயர், குறிச்சொல் மற்றும் அடிப்படை விவரங்கள்">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="வெளியீட்டின் பெயர் (Publication Name)" id="site_name" value={form.site_name} onChange={set("site_name")} placeholder="உ.கா: Chennai Times" />
          <Field label="குறிச்சொல் (Tagline)" id="tagline" value={form.tagline} onChange={set("tagline")} placeholder="உ.கா: சென்னையின் குரல்" />
          <Field label="டொமைன் (Domain)" id="domain" value={form.domain} onChange={set("domain")} placeholder="உ.கா: chennaitimes.online" hint="https:// இல்லாமல் உள்ளிடவும்" />
          <Field label="இருப்பிடம் (Location)" id="location" value={form.location} onChange={set("location")} placeholder="உ.கா: சென்னை, தமிழ்நாடு" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="லோகோ URL (Logo URL)" id="logo_url" value={form.logo_url} onChange={set("logo_url")} placeholder="https://..." hint="காலி விட்டால் இயல்புநிலை லோகோ பயன்படுத்தப்படும்" />
          {form.logo_url && (
            <div className="flex items-center gap-3 p-2 border rounded">
              <img src={form.logo_url} alt="Logo preview" className="h-10 w-auto object-contain" onError={e => { e.currentTarget.style.display = "none"; }} />
              <span className="text-xs text-muted-foreground">மேற்காட்சி</span>
            </div>
          )}
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-medium">தள விளக்கம் (About Text)</Label>
          <Textarea value={form.about_text} onChange={e => set("about_text")(e.target.value)}
            placeholder="உங்கள் வெளியீட்டைப் பற்றிய சுருக்கமான விளக்கம்..." rows={3} className="text-sm resize-none" />
        </div>
      </Section>

      <Section icon={Palette} title="தீம் வண்ணம்" description="முதன்மை வண்ணம் — நேவிகேஷன் பட்டி, கொடி மற்றும் சிறப்பம்சங்களில் தோன்றும்">
        <div className="flex items-center gap-4">
          <div className="space-y-1">
            <Label className="text-xs font-medium">முதன்மை வண்ணம் (Primary Color)</Label>
            <div className="flex items-center gap-3">
              <input type="color" value={form.primary_color} onChange={e => set("primary_color")(e.target.value)}
                className="h-10 w-16 rounded border cursor-pointer" />
              <Input value={form.primary_color} onChange={e => set("primary_color")(e.target.value)}
                className="w-32 font-mono text-sm h-9" placeholder="#DC2626" />
            </div>
          </div>
          <div className="mt-5 flex gap-2">
            {["#DC2626","#2563EB","#16A34A","#9333EA","#EA580C","#0F172A"].map(c => (
              <button key={c} onClick={() => set("primary_color")(c)}
                className="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110"
                style={{ backgroundColor: c, borderColor: form.primary_color === c ? "#000" : "transparent" }}
                title={c} />
            ))}
          </div>
        </div>
      </Section>

      <Section icon={Users} title="சமூக ஊடக இணைப்புகள்" description="கீழ்பகுதி மற்றும் பகிர்வு பொத்தான்களில் தோன்றும் URL கள்">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="YouTube Channel URL" id="youtube_url" value={form.youtube_url} onChange={set("youtube_url")} placeholder="https://www.youtube.com/@yourhandle" />
          <Field label="Instagram Profile URL" id="instagram_url" value={form.instagram_url} onChange={set("instagram_url")} placeholder="https://www.instagram.com/yourhandle/" />
          <Field label="Facebook Page URL" id="facebook_url" value={form.facebook_url} onChange={set("facebook_url")} placeholder="https://www.facebook.com/yourpage" />
          <Field label="Twitter/X Handle" id="twitter_handle" value={form.twitter_handle} onChange={set("twitter_handle")} placeholder="@yourhandle" hint="@ உட்பட உள்ளிடவும்" />
        </div>
      </Section>

      <Section icon={Phone} title="தொடர்பு விவரங்கள்" description="கீழ்பகுதியில் காட்டப்படும் தொடர்பு தகவல்கள்">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="மின்னஞ்சல் (Email)" id="contact_email" value={form.contact_email} onChange={set("contact_email")} placeholder="contact@yournews.online" type="email" />
          <Field label="தொலைபேசி (Phone)" id="contact_phone" value={form.contact_phone} onChange={set("contact_phone")} placeholder="+91 98765 43210" />
          <Field label="WhatsApp எண் (தேசக்குறியீடு உட்பட)" id="whatsapp_number" value={form.whatsapp_number} onChange={set("whatsapp_number")} placeholder="919876543210" hint="+ இல்லாமல் — உ.கா: 919876543210" />
          <Field label="Google Maps URL" id="maps_url" value={form.maps_url} onChange={set("maps_url")} placeholder="https://maps.google.com/?q=..." />
        </div>
      </Section>

      <Section icon={Search} title="SEO & Google அமைப்புகள்" description="Google News, Publisher Center மற்றும் RSS தொடர்பான அமைப்புகள்">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Google Publisher Center ID (Publication ID)" id="publication_id" value={form.publication_id} onChange={set("publication_id")} placeholder="CAowx7nGDA" hint="publishercenter.google.com இல் உள்ள ID" />
          <Field label="RSS விளக்கம் (RSS Description)" id="rss_description" value={form.rss_description} onChange={set("rss_description")} placeholder="உங்கள் தளத்தின் RSS விளக்கம்..." />
          <Field label="VAPID Email (Push Notifications)" id="vapid_email" value={form.vapid_email} onChange={set("vapid_email")} placeholder="admin@yournews.online" type="email" hint="Push notification sender identity" />
        </div>
      </Section>

      <Section icon={Tag} title="செய்தி பிரிவுகள்" description="இந்த பிரிவுகள் முகப்புப் பக்கம் மற்றும் நேவிகேஷனில் தோன்றும்">
        <div className="space-y-3">
          {form.categories.map((cat, idx) => (
            <div key={idx} className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30">
              <input type="color" value={cat.color}
                onChange={e => updateCategory(idx, "color", e.target.value)}
                className="h-8 w-10 rounded border cursor-pointer shrink-0" />
              <div className="flex-1 grid grid-cols-2 gap-2">
                <div className="space-y-0.5">
                  <Label className="text-[10px] text-muted-foreground">பிரிவு பெயர்</Label>
                  <Input value={cat.label} onChange={e => updateCategory(idx, "label", e.target.value)}
                    placeholder="பிரிவு பெயர்" className="h-8 text-xs" />
                </div>
                <div className="space-y-0.5">
                  <Label className="text-[10px] text-muted-foreground">ID (URL slug)</Label>
                  <Input value={cat.id} onChange={e => updateCategory(idx, "id", e.target.value.toLowerCase().replace(/\s+/g, "-"))}
                    placeholder="category-id" className="h-8 text-xs font-mono" />
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => removeCategory(idx)}
                className="h-8 w-8 text-destructive hover:text-destructive shrink-0">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addCategory} className="gap-2 h-8">
            <Plus className="h-3.5 w-3.5" /> பிரிவு சேர்க்கவும்
          </Button>
        </div>
      </Section>

      <div className="flex justify-end pb-6">
        <Button onClick={save} disabled={saving} size="lg" className="gap-2 min-w-40">
          {saving ? (
            <><span className="animate-spin">⟳</span> சேமிக்கிறது...</>
          ) : (
            <><Save className="h-4 w-4" /> அமைப்புகளை சேமி</>
          )}
        </Button>
      </div>
    </div>
  );
}
