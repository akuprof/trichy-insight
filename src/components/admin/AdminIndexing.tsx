import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, Loader2, Zap, RefreshCw, ExternalLink, Info, ChevronDown, ChevronUp, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface IndexingStatus {
  configured: boolean;
  clientEmail?: string;
  projectId?: string;
  error?: string;
}

interface VerifyStartResult {
  success?: boolean;
  filename?: string;
  fileContent?: string;
  message?: string;
  error?: string;
}

interface VerifyConfirmResult {
  success?: boolean;
  message?: string;
  error?: unknown;
}

interface BatchResult {
  url: string;
  title: string;
  status: "ok" | "error";
  code?: number;
}

interface BatchResponse {
  submitted: number;
  failed: number;
  total: number;
  results: BatchResult[];
}

const AdminIndexing = () => {
  const [status, setStatus] = useState<IndexingStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [batching, setBatching] = useState(false);
  const [batchResult, setBatchResult] = useState<BatchResponse | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [verifyStep, setVerifyStep] = useState<"idle" | "starting" | "ready" | "confirming" | "done" | "error">("idle");
  const [verifyData, setVerifyData] = useState<VerifyStartResult | null>(null);
  const [verifyConfirm, setVerifyConfirm] = useState<VerifyConfirmResult | null>(null);

  const fetchStatus = () => {
    setLoadingStatus(true);
    fetch("/api/indexing/status")
      .then(r => r.json())
      .then(setStatus)
      .catch(() => setStatus({ configured: false, error: "Could not reach API" }))
      .finally(() => setLoadingStatus(false));
  };

  useEffect(() => { fetchStatus(); }, []);

  const startVerify = async () => {
    setVerifyStep("starting");
    setVerifyData(null);
    try {
      const r = await fetch("/api/indexing/verify/start", { method: "POST" });
      const d = await r.json() as VerifyStartResult;
      if (d.success && d.filename) {
        setVerifyData(d);
        setVerifyStep("ready");
      } else {
        setVerifyData(d);
        setVerifyStep("error");
      }
    } catch {
      setVerifyData({ error: "Network error" });
      setVerifyStep("error");
    }
  };

  const confirmVerify = async () => {
    setVerifyStep("confirming");
    try {
      const r = await fetch("/api/indexing/verify/confirm", { method: "POST" });
      const d = await r.json() as VerifyConfirmResult;
      setVerifyConfirm(d);
      setVerifyStep(d.success ? "done" : "error");
    } catch {
      setVerifyConfirm({ error: "Network error" });
      setVerifyStep("error");
    }
  };

  const runBatch = async () => {
    setBatching(true);
    setBatchResult(null);
    try {
      const automationKey = prompt("AUTOMATION_API_KEY உள்ளிடுங்கள்:");
      if (!automationKey) { setBatching(false); return; }
      const r = await fetch("/api/indexing/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": automationKey },
      });
      const d = await r.json() as BatchResponse;
      setBatchResult(d);
    } catch (err) {
      setBatchResult({ submitted: 0, failed: 0, total: 0, results: [] });
    } finally {
      setBatching(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-xl uppercase">Google Instant Indexing</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Google Indexing API மூலம் புதிய செய்திகளை நிமிடங்களில் Google Search-ல் தோன்ற வைக்கலாம்.
          வெளியிடும்போது தானாக அனுப்பப்படும் — இங்கே கையேடாக அல்லது மொத்தமாக அனுப்பலாம்.
        </p>
      </div>

      {/* Status card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Service Account நிலை</CardTitle>
            <Button variant="ghost" size="sm" onClick={fetchStatus} disabled={loadingStatus}>
              <RefreshCw className={`h-3.5 w-3.5 ${loadingStatus ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loadingStatus ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> சரிபார்க்கிறது...
            </div>
          ) : status?.configured ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-sm font-medium">கட்டமைக்கப்பட்டது (Configured)</span>
              </div>
              {status.clientEmail && (
                <p className="text-xs text-muted-foreground ml-6">
                  Service Account: <code className="bg-muted px-1 rounded">{status.clientEmail}</code>
                </p>
              )}
              <p className="text-xs text-muted-foreground ml-6">
                வெளியீடும்போது தானாக நிமிடங்களில் Google-ல் அனுப்பப்படும்.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-red-600">
                <XCircle className="h-4 w-4" />
                <span className="text-sm font-medium">கட்டமைக்கப்படவில்லை (Not configured)</span>
              </div>
              {status?.error && (
                <p className="text-xs text-red-500 ml-6">{status.error}</p>
              )}
              <p className="text-xs text-muted-foreground ml-6">
                <code className="bg-muted px-1 rounded">GOOGLE_SERVICE_ACCOUNT_JSON</code> secret சேர்க்கவும்.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Automatic indexing info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4 text-yellow-500" />
            தானியங்கி Indexing
          </CardTitle>
          <CardDescription>புதிய செய்திகள் வெளியிடும்போது Google-க்கு தானாக அனுப்பப்படும்</CardDescription>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { event: "புதிய செய்தி வெளியீடு", trigger: "POST /api/publish", type: "URL_UPDATED", color: "bg-green-50 border-green-200 text-green-800" },
              { event: "செய்தி திருத்தம்",    trigger: "PATCH /api/publish/:id", type: "URL_UPDATED", color: "bg-blue-50 border-blue-200 text-blue-800" },
              { event: "Dashboard Toggle",   trigger: "Publish Switch",           type: "URL_UPDATED", color: "bg-purple-50 border-purple-200 text-purple-800" },
            ].map(item => (
              <div key={item.event} className={`p-3 rounded border ${item.color}`}>
                <p className="font-medium text-xs">{item.event}</p>
                <p className="text-[10px] mt-0.5 opacity-70">{item.trigger}</p>
                <Badge variant="outline" className="mt-1.5 text-[10px]">{item.type}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Bulk indexing */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">மொத்த Indexing (Bulk)</CardTitle>
          <CardDescription>வெளியிடப்பட்ட அனைத்து செய்திகளையும் Google-க்கு அனுப்பவும்</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Google Indexing API quota: <strong>200 URLs/day</strong>.
            ஒவ்வொரு URL-க்கும் 120ms delay செய்யப்படும் (rate limit தவிர்க்க).
            AUTOMATION_API_KEY தேவை.
          </p>
          <Button onClick={runBatch} disabled={batching || !status?.configured} className="gap-2">
            {batching
              ? <><Loader2 className="h-4 w-4 animate-spin" /> அனுப்புகிறது...</>
              : <><Zap className="h-4 w-4" /> அனைத்தையும் Index செய்</>
            }
          </Button>

          {batchResult && (
            <div className="space-y-3">
              <div className="flex gap-4 text-sm">
                <span className="text-green-600 font-medium flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" /> {batchResult.submitted} வெற்றி
                </span>
                {batchResult.failed > 0 && (
                  <span className="text-red-600 font-medium flex items-center gap-1">
                    <XCircle className="h-3.5 w-3.5" /> {batchResult.failed} தோல்வி
                  </span>
                )}
                <span className="text-muted-foreground">/ {batchResult.total} மொத்தம்</span>
              </div>

              {batchResult.results.length > 0 && (
                <div className="border rounded overflow-hidden">
                  <div className="max-h-64 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-muted sticky top-0">
                        <tr>
                          <th className="text-left px-3 py-2 font-medium">செய்தி</th>
                          <th className="text-left px-3 py-2 font-medium w-20">நிலை</th>
                        </tr>
                      </thead>
                      <tbody>
                        {batchResult.results.map((r, i) => (
                          <tr key={i} className="border-t border-border">
                            <td className="px-3 py-2">
                              <a href={r.url} target="_blank" rel="noreferrer"
                                className="hover:text-primary flex items-center gap-1 group">
                                <span className="truncate max-w-xs">{r.title}</span>
                                <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 shrink-0" />
                              </a>
                            </td>
                            <td className="px-3 py-2">
                              {r.status === "ok"
                                ? <span className="text-green-600 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> OK</span>
                                : <span className="text-red-600 flex items-center gap-1"><XCircle className="h-3 w-3" /> {r.code ?? "Err"}</span>
                              }
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Search Console Verification */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-blue-500" />
            Search Console உரிமை நிரூபிப்பு (Alternative)
          </CardTitle>
          <CardDescription>
            "Failed to add user" பிழை வந்தால் இதை பயன்படுத்துங்கள் — Service account-ஐ தானாக Owner ஆக்கும்.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Step indicators */}
          <div className="flex items-start gap-3 text-xs">
            {[
              { n: "1", label: "கோப்பு உருவாக்கு", active: verifyStep === "idle" || verifyStep === "starting" },
              { n: "2", label: "Deploy செய்", active: verifyStep === "ready" },
              { n: "3", label: "உரிமை உறுதி செய்", active: verifyStep === "confirming" || verifyStep === "ready" },
            ].map(s => (
              <div key={s.n} className={`flex items-center gap-1.5 px-2 py-1 rounded ${s.active ? "bg-blue-50 text-blue-700 font-medium" : "text-muted-foreground"}`}>
                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${s.active ? "bg-blue-600 text-white" : "bg-muted"}`}>{s.n}</span>
                {s.label}
              </div>
            ))}
          </div>

          {/* Step 1 */}
          {(verifyStep === "idle" || verifyStep === "starting" || verifyStep === "error") && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Google-ல் இருந்து verification கோப்பை பெற்று உங்கள் தளத்தில் தானாக வைக்கும்.
              </p>
              <Button size="sm" onClick={startVerify} disabled={verifyStep === "starting" || !status?.configured} className="gap-2">
                {verifyStep === "starting"
                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> கோப்பு உருவாக்குகிறது...</>
                  : <><ShieldCheck className="h-3.5 w-3.5" /> Verification கோப்பு உருவாக்கு</>}
              </Button>
              {verifyStep === "error" && verifyData?.error && (
                <p className="text-xs text-red-600 flex items-center gap-1"><XCircle className="h-3 w-3" />{verifyData.error}</p>
              )}
            </div>
          )}

          {/* Step 2 — file generated, need to deploy */}
          {verifyStep === "ready" && verifyData && (
            <div className="space-y-3">
              <div className="bg-green-50 border border-green-200 rounded p-3 space-y-1.5">
                <p className="text-xs font-medium text-green-800 flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Verification கோப்பு உருவாக்கப்பட்டது
                </p>
                <p className="text-xs text-green-700">
                  கோப்பு: <code className="bg-white/60 px-1 rounded">{verifyData.filename}</code>
                </p>
                <p className="text-xs text-green-700">
                  URL:{" "}
                  <a href={`https://trichyinsight.online/${verifyData.filename}`} target="_blank" rel="noreferrer"
                    className="underline flex items-center gap-0.5 inline-flex">
                    trichyinsight.online/{verifyData.filename} <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                </p>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded p-3">
                <p className="text-xs font-medium text-amber-800">⚠️ Deploy தேவை</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  கோப்பு உங்கள் codebase-ல் சேர்க்கப்பட்டது. முதலில் <strong>Deploy</strong> செய்யுங்கள்,
                  பின்பு கோப்பு accessible ஆனதை உறுதி செய்து Confirm பொத்தானை அழுத்துங்கள்.
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={confirmVerify} className="gap-2">
                  <ShieldCheck className="h-3.5 w-3.5" /> உரிமை உறுதி செய் (Confirm)
                </Button>
                <Button size="sm" variant="outline" onClick={() => setVerifyStep("idle")}>மீண்டும் தொடங்கு</Button>
              </div>
            </div>
          )}

          {/* Confirming */}
          {verifyStep === "confirming" && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Google-ல் உரிமை உறுதி செய்கிறது...
            </div>
          )}

          {/* Done */}
          {verifyStep === "done" && verifyConfirm && (
            <div className="bg-green-50 border border-green-200 rounded p-3 space-y-1">
              <p className="text-sm font-medium text-green-800 flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4" /> உரிமை நிரூபிக்கப்பட்டது!
              </p>
              <p className="text-xs text-green-700">{verifyConfirm.message}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Service account இப்போது Search Console Owner. Indexing API இயங்கும்.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Setup guide */}
      <Card>
        <CardHeader className="pb-2 cursor-pointer" onClick={() => setShowGuide(g => !g)}>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Info className="h-4 w-4 text-blue-500" />
              Setup வழிகாட்டி
            </CardTitle>
            {showGuide ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </div>
        </CardHeader>
        {showGuide && (
          <CardContent className="text-sm space-y-4">
            <ol className="space-y-4 list-none">
              {[
                {
                  step: "1",
                  title: "Google Search Console-ல் உரிமை நிரூபிக்கவும்",
                  body: "search.google.com/search-console → Add property → trichyinsight.online → Verify ownership.",
                },
                {
                  step: "2",
                  title: "Google Cloud Console-ல் Service Account உருவாக்கவும்",
                  body: "console.cloud.google.com → IAM & Admin → Service Accounts → Create Service Account. JSON key download செய்யுங்கள்.",
                },
                {
                  step: "3",
                  title: "Indexing API Enable செய்யவும்",
                  body: "Cloud Console → APIs & Services → Library → \"Web Search Indexing API\" → Enable.",
                },
                {
                  step: "4",
                  title: "Search Console-ல் Service Account சேர்க்கவும்",
                  body: "Search Console → Settings → Users and permissions → Add user → Service account email paste செய்யுங்கள் → Owner அனுமதி தரவும்.",
                },
                {
                  step: "5",
                  title: "Replit Secret சேர்க்கவும்",
                  body: "Replit Secrets → GOOGLE_SERVICE_ACCOUNT_JSON → JSON key file-ஐ முழுவதும் paste செய்யுங்கள்.",
                },
              ].map(item => (
                <li key={item.step} className="flex gap-3">
                  <span className="bg-primary text-primary-foreground font-heading text-xs w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                    {item.step}
                  </span>
                  <div>
                    <p className="font-medium">{item.title}</p>
                    <p className="text-muted-foreground text-xs mt-0.5">{item.body}</p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="text-xs text-muted-foreground border-t pt-3">
              <strong>குறிப்பு:</strong> Google Indexing API quota: 200 URLs/day, 600 calls/minute.
              JobPosting மற்றும் BroadcastEvent schema இல்லாத URLs-க்கு Google
              <a href="https://developers.google.com/search/apis/indexing-api/v3/quickstart" target="_blank" rel="noreferrer" className="text-primary hover:underline ml-1">
                Indexing API docs ↗
              </a>
            </p>
          </CardContent>
        )}
      </Card>
    </div>
  );
};

export default AdminIndexing;
