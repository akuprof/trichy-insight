import { useState } from "react";
import { Mail, CheckCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "/api";

export default function NewsletterSubscribe() {
  const { settings } = useSiteSettings();
  const { toast } = useToast();
  const pc = settings.primary_color;

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [subscribed, setSubscribed] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/newsletter/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), name: name.trim() || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "சந்தா பதிவு தோல்வியடைந்தது");
      setSubscribed(true);
    } catch (err) {
      toast({
        title: "சந்தா பதிவு தோல்வி",
        description: err instanceof Error ? err.message : "மீண்டும் முயற்சிக்கவும்",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (subscribed) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <CheckCircle className="h-12 w-12" style={{ color: pc }} />
        <h3 className="text-xl font-bold text-white">நன்றி! சந்தா பதிவு வெற்றி!</h3>
        <p className="text-slate-400 text-sm max-w-xs">
          திருச்சி இன்சைட்டின் புதிய செய்திகள் உங்கள் மின்னஞ்சலுக்கு வரும்.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-[#1E293B] border border-slate-700 p-6 sm:p-8">
      <div className="flex items-center gap-3 mb-4">
        <div className="rounded-full p-2" style={{ backgroundColor: `${pc}22` }}>
          <Mail className="h-5 w-5" style={{ color: pc }} />
        </div>
        <div>
          <h3 className="font-bold text-white text-lg leading-tight">நியூஸ்லெட்டர் பதிவு</h3>
          <p className="text-slate-400 text-xs">புதிய செய்திகள் நேரடியாக உங்கள் இன்பாக்ஸுக்கு</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <Input
          type="text"
          placeholder="உங்கள் பெயர் (விருப்பம்)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="bg-[#0F172A] border-slate-600 text-white placeholder:text-slate-500"
          disabled={loading}
        />
        <Input
          type="email"
          placeholder="உங்கள் மின்னஞ்சல் முகவரி *"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="bg-[#0F172A] border-slate-600 text-white placeholder:text-slate-500"
          disabled={loading}
        />
        <Button
          type="submit"
          className="w-full font-semibold text-white"
          style={{ backgroundColor: pc }}
          disabled={loading || !email.trim()}
        >
          {loading ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> சந்தா பதிவாகிறது...</>
          ) : (
            "சந்தா சேர்க்கவும்"
          )}
        </Button>
      </form>

      <p className="text-slate-500 text-xs mt-3 text-center">
        இலவசம். எப்போதும் நிறுத்தலாம். ஸ்பேம் இல்லை.
      </p>
    </div>
  );
}
