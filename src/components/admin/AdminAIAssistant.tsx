import { FileText, Loader2, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface AdminAIAssistantProps {
  sourceUrl: string;
  sourceText: string;
  generating: boolean;
  mode: "full" | "breaking";
  onSourceUrlChange: (value: string) => void;
  onSourceTextChange: (value: string) => void;
  onModeChange: (mode: "full" | "breaking") => void;
  onGenerate: () => void;
}

const AdminAIAssistant = ({
  sourceUrl,
  sourceText,
  generating,
  mode,
  onSourceUrlChange,
  onSourceTextChange,
  onModeChange,
  onGenerate,
}: AdminAIAssistantProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-xl uppercase flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" /> AI News Generator
        </CardTitle>
        <CardDescription>
          URL அல்லது முக்கிய குறிப்புகள் கொடுக்கவும் — AI Trichy local style-ல் article, Reels script, image prompt உருவாக்கும்.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">

        {/* Mode toggle */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onModeChange("full")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${
              mode === "full"
                ? "border-violet-600 bg-violet-50 text-violet-700 dark:bg-violet-950/30"
                : "border-border text-muted-foreground hover:bg-muted/50"
            }`}
          >
            <FileText className="h-4 w-4" />
            Full Article
            <span className="text-[10px] opacity-70">300+ words</span>
          </button>
          <button
            type="button"
            onClick={() => onModeChange("breaking")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${
              mode === "breaking"
                ? "border-red-600 bg-red-50 text-red-700 dark:bg-red-950/30"
                : "border-border text-muted-foreground hover:bg-muted/50"
            }`}
          >
            <Zap className="h-4 w-4" />
            Breaking Flash
            <span className="text-[10px] opacity-70">30-50 words</span>
          </button>
        </div>

        {mode === "breaking" && (
          <div className="text-xs bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2 text-red-700 dark:text-red-400">
            🔴 Breaking mode: Category auto-set to அவசரம் · Short flash only · Fast publish
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="ai-url">Source URL (Optional)</Label>
          <Input
            id="ai-url"
            placeholder="https://example.com/news-story"
            value={sourceUrl}
            onChange={(e) => onSourceUrlChange(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="ai-text">News Notes / Raw Input</Label>
          <Textarea
            id="ai-text"
            rows={4}
            placeholder="விரைவான குறிப்புகள், facts, location, event details — உதா: 'சத்திரம் அருகே இரு வாகனம் மோதல், 2 பேர் காயம்'"
            value={sourceText}
            onChange={(e) => onSourceTextChange(e.target.value)}
          />
        </div>

        <Button
          type="button"
          onClick={onGenerate}
          disabled={generating}
          className={mode === "breaking" ? "bg-red-600 hover:bg-red-700 text-white" : ""}
        >
          {generating ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> AI உருவாக்குகிறது...</>
          ) : mode === "breaking" ? (
            <><Zap className="h-4 w-4" /> 🔴 Flash Generate</>
          ) : (
            <><Sparkles className="h-4 w-4" /> AI Generate / Regenerate</>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};

export default AdminAIAssistant;
