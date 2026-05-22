import { useState } from "react";
import { Check, ChevronDown, ChevronUp, MessageCircle, Phone, Send } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const packages = [
  {
    name: "கடை விளம்பரம்",
    price: "₹3,000",
    period: "/மாதம்",
    features: ["வீடியோ பிரமோஷன்", "சமூக ஊடக பதிவு", "சேனல் குறிப்பிடல்", "1 மாத காட்சிப்படுத்தல்"],
    highlight: false,
  },
  {
    name: "நேர்காணல் பேக்கேஜ்",
    price: "₹5,000",
    period: "/வீடியோ",
    features: ["தொழில்முறை நேர்காணல்", "YouTube வெளியீடு", "சமூக ஊடக பிரமோஷன்", "நிரந்தர பட்டியல்"],
    highlight: true,
  },
  {
    name: "நிகழ்வு கவரேஜ்",
    price: "₹10,000",
    period: "முதல்",
    features: ["முழு நிகழ்வு செய்திக்கவனம்", "பல தள வெளியீடு", "ஹைலைட் ரீல்", "லைவ் ஸ்ட்ரீமிங் விருப்பம்"],
    highlight: false,
  },
  {
    name: "டிஜிட்டல் பண்டில்",
    price: "₹20,000",
    period: "/மாதம்",
    features: ["முழுமையான காட்சியளிப்பு", "இணையதள பேனர்", "வீடியோ + சமூக ஊடகம்", "முன்னுரிமை கவனம்", "அனலிட்டிக்ஸ் அறிக்கை"],
    highlight: false,
  },
];

const PHONE = "8903952591";

const RateCard = () => {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", business: "", package: "", message: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim() || !form.business.trim()) {
      toast({ title: "தகவல் தேவை", description: "பெயர், தொலைபேசி, வணிகப் பெயர் அவசியம்.", variant: "destructive" });
      return;
    }
    const text = encodeURIComponent(
      `வணக்கம் Trichy Insight!\n\nபெயர்: ${form.name.trim()}\nதொலைபேசி: ${form.phone.trim()}\nவணிகம்: ${form.business.trim()}\nபேக்கேஜ்: ${form.package || "குறிப்பிடவில்லை"}\nசெய்தி: ${form.message.trim() || "—"}`,
    );
    window.open(`https://wa.me/91${PHONE}?text=${text}`, "_blank");
    toast({ title: "WhatsApp திறக்கப்பட்டது!" });
    setForm({ name: "", phone: "", business: "", package: "", message: "" });
  };

  return (
    <section id="advertise" className="border-t border-border bg-muted/30">
      {/* ── Compact header bar ── */}
      <div className="container">
        <div className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div className="flex items-center gap-3">
            <div className="h-5 w-0.5 bg-primary shrink-0" />
            <div>
              <span className="font-heading text-sm uppercase tracking-wider">எங்களுடன் விளம்பரம் செய்யுங்கள்</span>
              <span className="text-muted-foreground text-xs ml-3">
                ₹3,000 முதல் · WhatsApp:{" "}
                <a href={`https://wa.me/91${PHONE}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  +91 {PHONE}
                </a>
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={`https://wa.me/91${PHONE}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-heading uppercase px-3 py-1.5 transition-colors"
            >
              <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
            </a>
            <button
              onClick={() => { setExpanded((v) => !v); if (expanded) setShowForm(false); }}
              className="inline-flex items-center gap-1.5 border border-border bg-card hover:bg-muted text-xs font-heading uppercase px-3 py-1.5 transition-colors"
            >
              {expanded ? <><ChevronUp className="h-3.5 w-3.5" /> மறை</> : <><ChevronDown className="h-3.5 w-3.5" /> விலைகள் பார்க்க</>}
            </button>
          </div>
        </div>

        {/* ── Expanded: pricing cards ── */}
        {expanded && (
          <div className="pb-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              {packages.map((pkg) => (
                <div
                  key={pkg.name}
                  className={`border p-4 flex flex-col relative ${pkg.highlight ? "border-primary bg-primary/5" : "border-border bg-card"}`}
                >
                  {pkg.highlight && (
                    <span className="absolute -top-2.5 left-3 bg-primary text-primary-foreground px-2 py-0.5 text-[10px] font-heading uppercase tracking-wider">
                      பிரபலமானது
                    </span>
                  )}
                  <h3 className="font-heading text-sm uppercase leading-tight">{pkg.name}</h3>
                  <div className="mt-2 mb-3">
                    <span className="text-xl font-heading font-bold">{pkg.price}</span>
                    <span className="text-muted-foreground text-xs">{pkg.period}</span>
                  </div>
                  <ul className="space-y-1 flex-1 mb-3">
                    {pkg.features.map((f) => (
                      <li key={f} className="flex items-start gap-1.5 text-xs">
                        <Check className="h-3 w-3 text-primary shrink-0 mt-0.5" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => { setForm((p) => ({ ...p, package: pkg.name })); setShowForm(true); }}
                    className={`py-1.5 font-heading uppercase tracking-wider text-xs font-bold transition-colors ${pkg.highlight ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"}`}
                  >
                    தொடங்குங்கள்
                  </button>
                </div>
              ))}
            </div>

            {/* ── Contact form (inline, collapsed until a package is chosen) ── */}
            <div className="border border-border bg-card">
              <button
                onClick={() => setShowForm((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-primary" />
                  <span className="font-heading text-sm uppercase tracking-wider">விளம்பரம் செய்ய தொடர்புகொள்ளுங்கள்</span>
                  <span className="text-muted-foreground text-xs hidden sm:inline">
                    +91 {PHONE} · WhatsApp வழியாக
                  </span>
                </div>
                {showForm ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </button>

              {showForm && (
                <form onSubmit={handleSubmit} className="px-4 pb-4 space-y-3 border-t border-border pt-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs font-medium mb-1 block">பெயர் *</label>
                      <Input className="h-8 text-sm" placeholder="உங்கள் பெயர்" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} maxLength={100} />
                    </div>
                    <div>
                      <label className="text-xs font-medium mb-1 block">தொலைபேசி *</label>
                      <Input className="h-8 text-sm" placeholder="98765 43210" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} maxLength={15} />
                    </div>
                    <div>
                      <label className="text-xs font-medium mb-1 block">வணிகப் பெயர் *</label>
                      <Input className="h-8 text-sm" placeholder="உங்கள் வணிகம்" value={form.business} onChange={(e) => setForm((p) => ({ ...p, business: e.target.value }))} maxLength={100} />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium mb-1 block">பேக்கேஜ்</label>
                      <select
                        value={form.package}
                        onChange={(e) => setForm((p) => ({ ...p, package: e.target.value }))}
                        className="flex h-8 w-full border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      >
                        <option value="">தேர்வு செய்யவும்</option>
                        {packages.map((p) => (
                          <option key={p.name} value={p.name}>{p.name} — {p.price}{p.period}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium mb-1 block">செய்தி</label>
                      <Input className="h-8 text-sm" placeholder="உங்கள் தேவைகளை எழுதுங்கள்..." value={form.message} onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))} maxLength={300} />
                    </div>
                  </div>
                  <Button type="submit" size="sm" className="font-heading uppercase tracking-wider">
                    <Send className="h-3.5 w-3.5 mr-1.5" /> WhatsApp வழியாக அனுப்பு
                  </Button>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default RateCard;
