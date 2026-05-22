import { useMemo } from "react";
import { AlertCircle, CheckCircle2, Clock, Search, TrendingUp, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface FormData {
  title: string;
  slug: string;
  category: string;
  excerpt: string;
  content: string;
  meta_title: string;
  meta_description: string;
  meta_keywords: string;
}

interface AdminSEOPanelProps {
  form: FormData;
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function readingTime(wordCount: number): string {
  const mins = Math.ceil(wordCount / 200);
  return mins <= 1 ? "1 min" : `${mins} mins`;
}

type CheckResult = { label: string; pass: boolean; hint: string };

const AdminSEOPanel = ({ form }: AdminSEOPanelProps) => {
  const wordCount = useMemo(() => countWords(form.content), [form.content]);
  const readTime = useMemo(() => readingTime(wordCount), [wordCount]);

  const checks = useMemo<CheckResult[]>(() => {
    const titleLen = form.title.trim().length;
    const metaTitleLen = form.meta_title.trim().length;
    const metaDescLen = form.meta_description.trim().length;
    const keywordsArr = form.meta_keywords.split(",").map((k) => k.trim()).filter(Boolean);
    const excerptLen = form.excerpt.trim().length;
    const hasSlug = form.slug.trim().length > 0;
    const contentIncldesTitle =
      form.content.toLowerCase().includes(form.title.toLowerCase().slice(0, 20)) ||
      form.meta_keywords
        .toLowerCase()
        .split(",")
        .some((kw) => form.content.toLowerCase().includes(kw.trim()));

    return [
      {
        label: "Title length (30–70 chars)",
        pass: titleLen >= 30 && titleLen <= 70,
        hint: titleLen < 30 ? `Too short (${titleLen})` : titleLen > 70 ? `Too long (${titleLen})` : `Good (${titleLen})`,
      },
      {
        label: "Meta title set",
        pass: metaTitleLen >= 20,
        hint: metaTitleLen === 0 ? "Add a meta title" : metaTitleLen < 20 ? "Too short" : "Good",
      },
      {
        label: "Meta description (120–160 chars)",
        pass: metaDescLen >= 120 && metaDescLen <= 160,
        hint:
          metaDescLen === 0
            ? "Add a meta description"
            : metaDescLen < 120
            ? `Too short (${metaDescLen})`
            : metaDescLen > 160
            ? `Too long (${metaDescLen})`
            : `Good (${metaDescLen})`,
      },
      {
        label: "Keywords defined",
        pass: keywordsArr.length >= 3,
        hint: keywordsArr.length === 0 ? "Add keywords" : `${keywordsArr.length} keywords`,
      },
      {
        label: "Excerpt present",
        pass: excerptLen >= 60,
        hint: excerptLen === 0 ? "Add an excerpt" : excerptLen < 60 ? "Too short" : "Good",
      },
      {
        label: "URL slug set",
        pass: hasSlug,
        hint: hasSlug ? "Slug ready" : "Slug auto-generated from title",
      },
      {
        label: "Content length (≥300 words)",
        pass: wordCount >= 300,
        hint: `${wordCount} words`,
      },
      {
        label: "Keyword in content",
        pass: contentIncldesTitle,
        hint: contentIncldesTitle ? "Found in content" : "Use primary keyword in content",
      },
    ];
  }, [form, wordCount]);

  const score = useMemo(() => {
    const passed = checks.filter((c) => c.pass).length;
    return Math.round((passed / checks.length) * 100);
  }, [checks]);

  const scoreColor = score >= 80 ? "text-green-600" : score >= 50 ? "text-yellow-600" : "text-red-600";
  const scoreBg = score >= 80 ? "bg-green-600" : score >= 50 ? "bg-yellow-500" : "bg-red-500";

  const contentQuality = useMemo(() => {
    const avgSentenceLength = form.content.split(/[.!?]/).filter((s) => s.trim().length > 10).reduce(
      (acc, s, _i, arr) => acc + countWords(s) / arr.length,
      0
    );
    if (avgSentenceLength < 8) return { label: "Very short sentences", level: "warn" };
    if (avgSentenceLength > 30) return { label: "Very long sentences — consider breaking up", level: "warn" };
    return { label: "Sentence length looks good", level: "ok" };
  }, [form.content]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2 uppercase tracking-wide">
            <Search className="h-4 w-4 text-primary" /> SEO Score
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className={`text-4xl font-bold ${scoreColor}`}>{score}</span>
            <span className="text-muted-foreground text-sm">/ 100</span>
          </div>
          <Progress value={score} className="h-2" style={{ "--progress-color": scoreBg } as React.CSSProperties} />
          <p className="text-xs text-muted-foreground">
            {score >= 80 ? "Excellent! Ready to publish." : score >= 50 ? "Good — a few tweaks recommended." : "Needs attention before publishing."}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2 uppercase tracking-wide">
            <Clock className="h-4 w-4 text-primary" /> Content Stats
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Reading time</span>
            <span className="font-medium">{readTime}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Word count</span>
            <span className="font-medium">{wordCount}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Title length</span>
            <span className="font-medium">{form.title.length} chars</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Meta desc</span>
            <span className="font-medium">{form.meta_description.length} chars</span>
          </div>
          <div className="pt-1">
            <Badge variant={contentQuality.level === "ok" ? "secondary" : "outline"} className="text-xs">
              {contentQuality.level === "ok" ? "✓" : "⚠"} {contentQuality.label}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2 uppercase tracking-wide">
            <TrendingUp className="h-4 w-4 text-primary" /> SEO Checklist
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {checks.map((check) => (
            <div key={check.label} className="flex items-start gap-2">
              {check.pass ? (
                <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
              )}
              <div className="min-w-0">
                <p className="text-xs font-medium leading-tight">{check.label}</p>
                <p className="text-xs text-muted-foreground">{check.hint}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2 uppercase tracking-wide">
            <Zap className="h-4 w-4 text-primary" /> Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs text-muted-foreground">
          {!checks[0].pass && <p>• Title-ஐ 30–70 characters வரை வையுங்கள்.</p>}
          {!checks[2].pass && <p>• Meta description 120–160 characters இருக்க வேண்டும்.</p>}
          {!checks[6].pass && <p>• Content குறைந்தது 300 words இருக்க வேண்டும்.</p>}
          {!checks[7].pass && <p>• Primary keyword content-ல் இருக்க வேண்டும்.</p>}
          {checks.every((c) => c.pass) && (
            <p className="text-green-600 font-medium">✓ All checks passed! Great work.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminSEOPanel;
