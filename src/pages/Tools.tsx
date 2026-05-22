import { useState } from "react";
import { Calculator, Fuel, Gem } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

type Tab = "emi" | "gold" | "fuel";

/* ── EMI Calculator ── */
function EmiCalc() {
  const [principal, setPrincipal] = useState("");
  const [rate, setRate] = useState("");
  const [tenure, setTenure] = useState("");
  const [result, setResult] = useState<{ emi: number; total: number; interest: number } | null>(null);

  const calculate = () => {
    const P = parseFloat(principal);
    const annualRate = parseFloat(rate);
    const n = parseFloat(tenure);
    if (!P || !annualRate || !n || P <= 0 || annualRate <= 0 || n <= 0) return;
    const r = annualRate / 12 / 100;
    const emi = (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    const total = emi * n;
    setResult({ emi, total, interest: total - P });
  };

  const fmt = (v: number) =>
    new Intl.NumberFormat("ta-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v);

  return (
    <div className="space-y-5">
      <p className="text-xs text-muted-foreground">
        வீட்டுக்கடன், கார் கடன் அல்லது தனிநபர் கடனுக்கான மாதாந்திர தவணை கணக்கிடுங்கள்.
      </p>
      <div className="grid sm:grid-cols-3 gap-4">
        <label className="block space-y-1.5">
          <span className="text-xs font-heading uppercase tracking-wider text-muted-foreground">கடன் தொகை (₹)</span>
          <input type="number" placeholder="உ.ம்: 2500000"
            value={principal} onChange={e => setPrincipal(e.target.value)}
            className="w-full border border-muted-foreground/20 bg-background px-3 py-2 text-sm focus:outline-none focus:border-primary rounded" />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-heading uppercase tracking-wider text-muted-foreground">வட்டி விகிதம் (% ஆண்டு)</span>
          <input type="number" step="0.1" placeholder="உ.ம்: 8.5"
            value={rate} onChange={e => setRate(e.target.value)}
            className="w-full border border-muted-foreground/20 bg-background px-3 py-2 text-sm focus:outline-none focus:border-primary rounded" />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-heading uppercase tracking-wider text-muted-foreground">காலம் (மாதங்கள்)</span>
          <input type="number" placeholder="உ.ம்: 240"
            value={tenure} onChange={e => setTenure(e.target.value)}
            className="w-full border border-muted-foreground/20 bg-background px-3 py-2 text-sm focus:outline-none focus:border-primary rounded" />
        </label>
      </div>
      <button onClick={calculate}
        className="bg-primary text-primary-foreground text-xs font-heading uppercase tracking-widest px-6 py-2.5 rounded hover:opacity-90 transition-opacity">
        கணக்கிடு
      </button>

      {result && (
        <div className="grid sm:grid-cols-3 gap-4 border border-muted-foreground/15 p-4 rounded mt-2">
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">மாதாந்திர தவணை (EMI)</p>
            <p className="text-2xl font-heading font-bold text-primary">{fmt(result.emi)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">மொத்த வட்டி</p>
            <p className="text-2xl font-heading font-bold text-red-600">{fmt(result.interest)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">மொத்த செலுத்துகை</p>
            <p className="text-2xl font-heading font-bold">{fmt(result.total)}</p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Gold Calculator ── */
function GoldCalc() {
  const [pricePerGram, setPricePerGram] = useState("");
  const [weight, setWeight] = useState("");
  const [unit, setUnit] = useState<"grams" | "sovereigns">("sovereigns");
  const [making, setMaking] = useState("10");
  const [gst, setGst] = useState("3");
  const [result, setResult] = useState<{ goldValue: number; makingCharges: number; gstAmount: number; total: number } | null>(null);

  const calculate = () => {
    const pg = parseFloat(pricePerGram);
    const w = parseFloat(weight);
    const mk = parseFloat(making) / 100;
    const gstPct = parseFloat(gst) / 100;
    if (!pg || !w || pg <= 0 || w <= 0) return;
    const grams = unit === "sovereigns" ? w * 8 : w;
    const goldValue = pg * grams;
    const makingCharges = goldValue * mk;
    const gstAmount = (goldValue + makingCharges) * gstPct;
    const total = goldValue + makingCharges + gstAmount;
    setResult({ goldValue, makingCharges, gstAmount, total });
  };

  const fmt = (v: number) =>
    new Intl.NumberFormat("ta-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v);

  return (
    <div className="space-y-5">
      <p className="text-xs text-muted-foreground">
        திருச்சியில் தங்கம் வாங்கும் முன் — தங்க மூல மதிப்பு, செய்கூலி மற்றும் GST உட்பட மொத்த விலை அறிந்துகொள்ளுங்கள்.
      </p>
      <div className="grid sm:grid-cols-2 gap-4">
        <label className="block space-y-1.5">
          <span className="text-xs font-heading uppercase tracking-wider text-muted-foreground">1 கிராம் தங்க விலை (₹)</span>
          <input type="number" placeholder="உ.ம்: 7500"
            value={pricePerGram} onChange={e => setPricePerGram(e.target.value)}
            className="w-full border border-muted-foreground/20 bg-background px-3 py-2 text-sm focus:outline-none focus:border-primary rounded" />
        </label>
        <div className="space-y-1.5">
          <span className="text-xs font-heading uppercase tracking-wider text-muted-foreground block">எடை</span>
          <div className="flex gap-2">
            <input type="number" step="0.001" placeholder="எடை"
              value={weight} onChange={e => setWeight(e.target.value)}
              className="flex-1 border border-muted-foreground/20 bg-background px-3 py-2 text-sm focus:outline-none focus:border-primary rounded" />
            <select value={unit} onChange={e => setUnit(e.target.value as "grams" | "sovereigns")}
              className="border border-muted-foreground/20 bg-background px-2 py-2 text-sm focus:outline-none focus:border-primary rounded">
              <option value="sovereigns">பவுன் (Sovereign)</option>
              <option value="grams">கிராம்</option>
            </select>
          </div>
          <p className="text-[11px] text-muted-foreground">1 பவுன் = 8 கிராம்</p>
        </div>
        <label className="block space-y-1.5">
          <span className="text-xs font-heading uppercase tracking-wider text-muted-foreground">செய்கூலி (%)</span>
          <input type="number" step="0.5" placeholder="10"
            value={making} onChange={e => setMaking(e.target.value)}
            className="w-full border border-muted-foreground/20 bg-background px-3 py-2 text-sm focus:outline-none focus:border-primary rounded" />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-heading uppercase tracking-wider text-muted-foreground">GST (%)</span>
          <input type="number" step="0.5" placeholder="3"
            value={gst} onChange={e => setGst(e.target.value)}
            className="w-full border border-muted-foreground/20 bg-background px-3 py-2 text-sm focus:outline-none focus:border-primary rounded" />
        </label>
      </div>
      <button onClick={calculate}
        className="bg-primary text-primary-foreground text-xs font-heading uppercase tracking-widest px-6 py-2.5 rounded hover:opacity-90 transition-opacity">
        கணக்கிடு
      </button>

      {result && (
        <div className="border border-muted-foreground/15 p-4 rounded space-y-3">
          <div className="flex justify-between text-sm border-b border-muted-foreground/10 pb-2">
            <span className="text-muted-foreground">தங்க மதிப்பு</span>
            <span className="font-semibold">{fmt(result.goldValue)}</span>
          </div>
          <div className="flex justify-between text-sm border-b border-muted-foreground/10 pb-2">
            <span className="text-muted-foreground">செய்கூலி</span>
            <span className="font-semibold">{fmt(result.makingCharges)}</span>
          </div>
          <div className="flex justify-between text-sm border-b border-muted-foreground/10 pb-2">
            <span className="text-muted-foreground">GST</span>
            <span className="font-semibold">{fmt(result.gstAmount)}</span>
          </div>
          <div className="flex justify-between text-base font-bold">
            <span>மொத்த விலை</span>
            <span className="text-primary">{fmt(result.total)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Fuel Calculator ── */
function FuelCalc() {
  const [distance, setDistance] = useState("");
  const [efficiency, setEfficiency] = useState("");
  const [price, setPrice] = useState("");
  const [passengers, setPassengers] = useState("1");
  const [result, setResult] = useState<{ liters: number; totalCost: number; perPerson: number } | null>(null);

  const calculate = () => {
    const d = parseFloat(distance);
    const e = parseFloat(efficiency);
    const p = parseFloat(price);
    const pax = Math.max(1, parseInt(passengers) || 1);
    if (!d || !e || !p || d <= 0 || e <= 0 || p <= 0) return;
    const liters = d / e;
    const totalCost = liters * p;
    setResult({ liters, totalCost, perPerson: totalCost / pax });
  };

  const ROUTES = [
    { label: "திருச்சி → சென்னை", km: 336 },
    { label: "திருச்சி → மதுரை", km: 143 },
    { label: "திருச்சி → கோவை", km: 213 },
    { label: "திருச்சி → தஞ்சாவூர்", km: 56 },
  ];

  return (
    <div className="space-y-5">
      <p className="text-xs text-muted-foreground">
        திருச்சியிலிருந்து ஒரு பயணத்திற்கு எவ்வளவு எரிபொருள் செலவாகும் என்று முன்கூட்டியே தெரிந்துகொள்ளுங்கள்.
      </p>

      {/* Quick routes */}
      <div>
        <p className="text-xs font-heading uppercase tracking-wider text-muted-foreground mb-2">பொதுவான பயண வழிகள்</p>
        <div className="flex flex-wrap gap-2">
          {ROUTES.map(r => (
            <button key={r.label} onClick={() => setDistance(String(r.km))}
              className="text-xs border border-muted-foreground/20 px-3 py-1 rounded hover:border-primary hover:text-primary transition-colors">
              {r.label} ({r.km} கி.மீ)
            </button>
          ))}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <label className="block space-y-1.5">
          <span className="text-xs font-heading uppercase tracking-wider text-muted-foreground">தூரம் (கி.மீ)</span>
          <input type="number" placeholder="உ.ம்: 336"
            value={distance} onChange={e => setDistance(e.target.value)}
            className="w-full border border-muted-foreground/20 bg-background px-3 py-2 text-sm focus:outline-none focus:border-primary rounded" />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-heading uppercase tracking-wider text-muted-foreground">மைலேஜ் (கி.மீ/லிட்டர்)</span>
          <input type="number" step="0.5" placeholder="உ.ம்: 15"
            value={efficiency} onChange={e => setEfficiency(e.target.value)}
            className="w-full border border-muted-foreground/20 bg-background px-3 py-2 text-sm focus:outline-none focus:border-primary rounded" />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-heading uppercase tracking-wider text-muted-foreground">எரிபொருள் விலை (₹/லிட்டர்)</span>
          <input type="number" step="0.01" placeholder="உ.ம்: 102.5"
            value={price} onChange={e => setPrice(e.target.value)}
            className="w-full border border-muted-foreground/20 bg-background px-3 py-2 text-sm focus:outline-none focus:border-primary rounded" />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-heading uppercase tracking-wider text-muted-foreground">பயணிகள் எண்ணிக்கை</span>
          <input type="number" min="1" max="50" placeholder="1"
            value={passengers} onChange={e => setPassengers(e.target.value)}
            className="w-full border border-muted-foreground/20 bg-background px-3 py-2 text-sm focus:outline-none focus:border-primary rounded" />
        </label>
      </div>
      <button onClick={calculate}
        className="bg-primary text-primary-foreground text-xs font-heading uppercase tracking-widest px-6 py-2.5 rounded hover:opacity-90 transition-opacity">
        கணக்கிடு
      </button>

      {result && (
        <div className="grid sm:grid-cols-3 gap-4 border border-muted-foreground/15 p-4 rounded">
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">தேவையான எரிபொருள்</p>
            <p className="text-2xl font-heading font-bold">{result.liters.toFixed(1)} L</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">மொத்த செலவு</p>
            <p className="text-2xl font-heading font-bold text-primary">
              ₹{result.totalCost.toFixed(0)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">ஒருவருக்கு</p>
            <p className="text-2xl font-heading font-bold text-emerald-600">
              ₹{result.perPerson.toFixed(0)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Main page ── */
const TABS: { id: Tab; label: string; icon: React.ReactNode; title: string }[] = [
  { id: "emi",  label: "கடன் தவணை",    icon: <Calculator className="h-4 w-4" />, title: "EMI Calculator · கடன் தவணை கணக்கீடு" },
  { id: "gold", label: "தங்க மதிப்பு", icon: <Gem className="h-4 w-4" />,        title: "Gold Price Calculator · தங்க விலை கணக்கீடு" },
  { id: "fuel", label: "எரிபொருள்",    icon: <Fuel className="h-4 w-4" />,       title: "Fuel Cost Calculator · எரிபொருள் செலவு" },
];

const Tools = () => {
  const [tab, setTab] = useState<Tab>("emi");
  const active = TABS.find(t => t.id === tab)!;

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 container py-12 max-w-3xl">

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2 rounded-lg bg-primary/10">
            <Calculator className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="font-heading text-2xl uppercase tracking-wide">கணக்கீட்டு கருவிகள்</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Online Tools for Trichy Residents</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 border-b border-muted-foreground/20 mb-8">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-heading uppercase tracking-wider border-b-2 transition-colors -mb-px ${
                tab === t.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}>
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* Tool title */}
        <div className="mb-6">
          <h2 className="font-heading text-lg">{active.title}</h2>
        </div>

        {/* Active tool */}
        <div className="border border-muted-foreground/15 p-6 rounded-lg">
          {tab === "emi"  && <EmiCalc />}
          {tab === "gold" && <GoldCalc />}
          {tab === "fuel" && <FuelCalc />}
        </div>

        <p className="text-[11px] text-muted-foreground mt-4 text-center">
          இந்த கணக்கீடுகள் தோராயமானவை. முதலீடு அல்லது கடன் முன் நிதி ஆலோசகரை அணுகவும்.
        </p>
      </main>
      <Footer />
    </div>
  );
};

export default Tools;
