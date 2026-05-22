import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertCircle, CheckCircle2, Download, ExternalLink,
  Filter, Loader2, RefreshCw, Rss, Shield,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

const API_BASE = "/api";

const SOURCES = [
  { name: "Dinamalar",           url: "https://www.dinamalar.com/rss/news.xml",       category: "செய்திகள்", region: "Tamil Nadu" },
  { name: "Dinamani",            url: "https://www.dinamani.com/latest-news?rss=1",    category: "செய்திகள்", region: "Tamil Nadu" },
  { name: "OneIndia Tamil",      url: "https://tamil.oneindia.com/rss/tamil-news.xml", category: "தேசியம்",   region: "National"   },
  { name: "Vikatan",             url: "https://www.vikatan.com/feed",                   category: "பொது",      region: "Tamil Nadu" },
  { name: "Puthiya Thalaimurai", url: "https://puthiyathalaimurai.com/feed/",           category: "செய்திகள்", region: "Tamil Nadu" },
  { name: "Maalaimalar",         url: "https://www.maalaimalar.com/rss/news.xml",       category: "செய்திகள்", region: "Tamil Nadu" },
  { name: "Tamil Murasu",        url: "https://www.tamilmurasu.com.sg/feed",            category: "சர்வதேசம்", region: "Global"     },
];

interface SourceResult {
  source: string;
  fetched: number;
  saved: number;
  filtered: number;
  held: number;
  errors: string[];
}

interface FetchResponse {
  ok: boolean;
  totalSaved: number;
  totalFiltered: number;
  totalHeld: number;
  results: SourceResult[];
}

export default function AdminNewsAggregator() {
  const { toast } = useToast();
  const [selectedSources, setSelectedSources] = useState<Set<string>>(
    new Set(SOURCES.map((s) => s.url))
  );
  const [trichyOnly, setTrichyOnly] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [lastResults, setLastResults] = useState<SourceResult[] | null>(null);
  const [totalSaved, setTotalSaved] = useState<number | null>(null);
  const [totalFiltered, setTotalFiltered] = useState<number | null>(null);
  const [totalHeld, setTotalHeld] = useState<number | null>(null);

  const toggleSource = (url: string) => {
    setSelectedSources((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedSources.size === SOURCES.length) {
      setSelectedSources(new Set());
    } else {
      setSelectedSources(new Set(SOURCES.map((s) => s.url)));
    }
  };

  const handleFetch = async () => {
    if (selectedSources.size === 0) {
      toast({ title: "No sources selected", variant: "destructive" });
      return;
    }
    setFetching(true);
    setLastResults(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${API_BASE}/aggregator/fetch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ sourceUrls: Array.from(selectedSources), trichyOnly }),
      });
      const data = await res.json() as FetchResponse;
      setLastResults(data.results);
      setTotalSaved(data.totalSaved);
      setTotalFiltered(data.totalFiltered ?? 0);
      setTotalHeld(data.totalHeld ?? 0);

      if (data.totalSaved > 0) {
        const holdMsg = (data.totalHeld ?? 0) > 0
          ? ` (${data.totalHeld} marked ⚠️ HOLD — review before publish)`
          : "";
        toast({
          title: `${data.totalSaved} new Trichy articles imported as drafts`,
          description: `Review in the Editor tab and publish.${holdMsg}`,
        });
      } else if ((data.totalFiltered ?? 0) > 0) {
        toast({
          title: "No Trichy articles found in this batch",
          description: `${data.totalFiltered} non-Trichy articles filtered out. Try turning off the Trichy Filter to import all Tamil news.`,
        });
      } else {
        toast({ title: "No new articles found", description: "All recent articles already exist in your CMS" });
      }
    } catch (e) {
      toast({ title: "Fetch failed", description: String(e), variant: "destructive" });
    } finally {
      setFetching(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="font-heading text-xl uppercase">Tamil News Aggregator</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Pull latest headlines from major Tamil news sources into the CMS as draft articles.
        </p>
      </div>

      {/* Trichy Smart Filter */}
      <Card className="border-orange-500/40 bg-orange-50/30 dark:bg-orange-950/10">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4 text-orange-600" />
            Trichy Smart Filter
            <Badge variant={trichyOnly ? "default" : "outline"} className={trichyOnly ? "bg-orange-600 text-white text-[10px]" : "text-[10px]"}>
              {trichyOnly ? "ON" : "OFF"}
            </Badge>
          </CardTitle>
          <CardDescription className="text-xs">
            When enabled, only articles mentioning Trichy or local areas (Srirangam, Chatram, KK Nagar, Woraiyur, Ponmalai, Samayapuram…) are saved.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Switch
              id="trichy-filter"
              checked={trichyOnly}
              onCheckedChange={setTrichyOnly}
            />
            <Label htmlFor="trichy-filter" className="text-sm cursor-pointer">
              {trichyOnly
                ? "Trichy-only mode — non-local articles automatically discarded"
                : "All Tamil news mode — showing everything (manual filter needed)"}
            </Label>
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
            {[
              "திருச்சி / Trichy",
              "ஸ்ரீரங்கம் / Srirangam",
              "சத்திரம் / Chatram",
              "KK நகர் / KK Nagar",
              "வோராியூர் / Woraiyur",
              "போன்மலை / Ponmalai",
              "சமயபுரம் / Samayapuram",
              "விமான நிலையம் / Airport",
              "மலைக்கோட்டை / Rockfort",
            ].map((area) => (
              <div key={area} className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0" />
                {area}
              </div>
            ))}
          </div>

          {/* Auto-category info */}
          <div className="border-t pt-3 space-y-1.5">
            <p className="text-xs font-medium flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5 text-violet-600" />
              Auto-detect enabled
            </p>
            <div className="flex flex-wrap gap-1.5">
              {[
                { label: "விபத்து", desc: "accident/death" },
                { label: "குற்றம்", desc: "crime/arrest" },
                { label: "அரசியல்", desc: "politics" },
                { label: "அவசரம்", desc: "breaking" },
                { label: "பொது", desc: "default" },
              ].map((c) => (
                <span key={c.label} className="text-[10px] bg-muted rounded px-1.5 py-0.5">
                  {c.label} <span className="text-muted-foreground">({c.desc})</span>
                </span>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Sensitive content (communal, unverified deaths) is automatically flagged ⚠️ HOLD for review.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* How it works */}
      <Card className="border-violet-500/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Rss className="h-4 w-4 text-violet-600" />
            How the Aggregator Works
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-2 text-sm text-muted-foreground">
            {[
              "Fetches RSS feeds from selected Tamil news sources",
              "Trichy filter checks headline + first 2 lines for local keywords",
              "Category is auto-detected (விபத்து, குற்றம், அரசியல், அவசரம், பொது)",
              "Sensitive content is flagged ⚠️ HOLD — visible in Editor before publish",
              "Saves new headlines as unpublished draft articles (no duplicates)",
              "Review drafts in Editor tab — edit, localize, and publish",
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="bg-violet-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] shrink-0 mt-0.5 font-bold">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      {/* Source selection */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">News Sources</CardTitle>
            <Button variant="ghost" size="sm" onClick={toggleAll} className="text-xs">
              {selectedSources.size === SOURCES.length ? "Deselect All" : "Select All"}
            </Button>
          </div>
          <CardDescription className="text-xs">
            {selectedSources.size} of {SOURCES.length} sources selected
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {SOURCES.map((source) => {
            const selected = selectedSources.has(source.url);
            const result = lastResults?.find((r) => r.source === source.name);
            return (
              <div
                key={source.url}
                onClick={() => toggleSource(source.url)}
                className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                  selected ? "border-violet-500/50 bg-violet-50 dark:bg-violet-950/20" : "border-border hover:bg-muted/50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                    selected ? "border-violet-600 bg-violet-600" : "border-muted-foreground"
                  }`}>
                    {selected && <CheckCircle2 className="h-3 w-3 text-white" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{source.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">{source.category}</Badge>
                      <span className="text-[11px] text-muted-foreground">{source.region}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {result && (
                    <div className="text-right text-[11px] space-y-0.5">
                      {result.errors.length > 0 ? (
                        <span className="text-destructive flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" /> Error
                        </span>
                      ) : (
                        <>
                          <div className="text-muted-foreground">
                            {result.fetched} fetched
                            {(result.filtered ?? 0) > 0 && (
                              <span className="text-orange-600"> · {result.filtered} filtered</span>
                            )}
                          </div>
                          <div>
                            <span className="text-green-600 font-medium">{result.saved} saved</span>
                            {(result.held ?? 0) > 0 && (
                              <span className="text-amber-600 ml-1">· {result.held} on hold</span>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Fetch button + results summary */}
      <div className="space-y-3">
        <Button
          onClick={() => void handleFetch()}
          disabled={fetching || selectedSources.size === 0}
          className="gap-2"
        >
          {fetching ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Fetching articles...</>
          ) : (
            <><Download className="h-4 w-4" /> Fetch Latest Articles</>
          )}
        </Button>

        {totalSaved !== null && !fetching && (
          <div className="flex flex-wrap gap-4 text-sm">
            <span className="text-green-600 font-medium">{totalSaved} new articles saved</span>
            {(totalFiltered ?? 0) > 0 && (
              <span className="text-orange-600">{totalFiltered} articles filtered — not Trichy relevant</span>
            )}
            {(totalHeld ?? 0) > 0 && (
              <span className="text-amber-600">⚠️ {totalHeld} on hold — review before publish</span>
            )}
          </div>
        )}
      </div>

      {/* Error details */}
      {lastResults && lastResults.some((r) => r.errors.length > 0) && (
        <Card className="border-destructive/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-destructive flex items-center gap-2">
              <AlertCircle className="h-4 w-4" /> Some Sources Failed
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {lastResults.filter((r) => r.errors.length > 0).map((r) => (
              <div key={r.source} className="text-xs">
                <span className="font-medium">{r.source}:</span>{" "}
                <span className="text-muted-foreground">{r.errors.join(", ")}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* OpenClaw newsletter info */}
      <Card className="bg-muted/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-violet-600" />
            Automate with OpenClaw
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground space-y-2">
          <p>
            Point OpenClaw's <strong>newsletter-curator</strong> skill to your RSS feed for fully automated weekly newsletters:
          </p>
          <div className="bg-background rounded border px-3 py-2 font-mono text-[11px]">
            https://trichyinsight.online/api/rss.xml
          </div>
          <p>
            OpenClaw reads published articles → selects the top 5–7 → writes editorial intro → sends newsletter draft for your approval.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
