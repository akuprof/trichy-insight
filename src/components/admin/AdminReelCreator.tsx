import { useState, useRef, useEffect, useCallback } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Film, Copy, Send, ImagePlay, Clapperboard,
  Download, Palette, Type, RefreshCw, ExternalLink,
} from "lucide-react";
import { loadDirectChannels } from "@/lib/channel-publish";

export interface ReelArticle {
  id: string;
  title: string;
  excerpt: string | null;
  cover_image_url: string | null;
  category: string;
  slug: string;
}

interface Props {
  article: ReelArticle | null;
  onClose: () => void;
}

const CANVAS_W = 1080;
const CANVAS_H = 1920;

const COLOR_PRESETS = [
  { label: "Red", from: "#b91c1c", to: "#450a0a" },
  { label: "Purple", from: "#7c3aed", to: "#1e1b4b" },
  { label: "Blue", from: "#1d4ed8", to: "#0c1445" },
  { label: "Green", from: "#15803d", to: "#052e16" },
  { label: "Orange", from: "#c2410c", to: "#431407" },
  { label: "Black", from: "#18181b", to: "#000000" },
];

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
): number {
  const words = text.split(" ");
  let line = "";
  let currentY = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, currentY);
      line = word;
      currentY += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, currentY);
  return currentY + lineHeight;
}

function buildCaption(article: ReelArticle) {
  const excerpt = article.excerpt?.trim() ? `\n\n${article.excerpt.trim()}` : "";
  return `${article.title}${excerpt}\n\n#திருச்சி #TrichyInsight #TamilNews #Trichy #தமிழ்செய்திகள்`;
}

export default function AdminReelCreator({ article, onClose }: Props) {
  const { toast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  const [caption, setCaption] = useState(article ? buildCaption(article) : "");
  const [overlayTitle, setOverlayTitle] = useState(article?.title ?? "");
  const [colorPreset, setColorPreset] = useState(COLOR_PRESETS[0]);
  const [posting, setPosting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatedBlob, setGeneratedBlob] = useState<Blob | null>(null);

  if (!article) return null;

  const imageUrl = article.cover_image_url ?? "";
  const REEL_APP_URL = `https://trichyinsightnews.replit.app/?title=${encodeURIComponent(article.title)}&image=${encodeURIComponent(imageUrl)}&excerpt=${encodeURIComponent(article.excerpt ?? "")}&category=${encodeURIComponent(article.category)}`;

  // ── Draw reel card onto canvas ───────────────────────────────────
  const drawCard = useCallback(async (
    targetCanvas: HTMLCanvasElement,
    scale = 1,
  ): Promise<void> => {
    const ctx = targetCanvas.getContext("2d");
    if (!ctx) return;

    const W = CANVAS_W * scale;
    const H = CANVAS_H * scale;
    targetCanvas.width = W;
    targetCanvas.height = H;

    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, colorPreset.from);
    grad.addColorStop(1, colorPreset.to);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Load and draw image
    if (imageUrl) {
      await new Promise<void>((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          // Cover-fill the top 70% of the canvas
          const imgH = H * 0.72;
          const imgAspect = img.naturalWidth / img.naturalHeight;
          const canvasAspect = W / imgH;
          let drawW = W, drawH = imgH, drawX = 0, drawY = 0;
          if (imgAspect > canvasAspect) {
            drawW = imgH * imgAspect;
            drawX = -(drawW - W) / 2;
          } else {
            drawH = W / imgAspect;
            drawY = -(drawH - imgH) / 2;
          }
          ctx.save();
          ctx.beginPath();
          ctx.rect(0, 0, W, imgH);
          ctx.clip();
          ctx.drawImage(img, drawX, drawY, drawW, drawH);
          ctx.restore();
          resolve();
        };
        img.onerror = () => resolve();
        img.src = imageUrl;
      });
    }

    // Bottom gradient overlay (over image bottom + text area)
    const overlay = ctx.createLinearGradient(0, H * 0.45, 0, H);
    overlay.addColorStop(0, "rgba(0,0,0,0)");
    overlay.addColorStop(0.35, "rgba(0,0,0,0.85)");
    overlay.addColorStop(1, "rgba(0,0,0,0.97)");
    ctx.fillStyle = overlay;
    ctx.fillRect(0, H * 0.45, W, H * 0.55);

    // Category badge
    const badgeX = 60 * scale;
    const badgeY = H * 0.7;
    const badgePad = 18 * scale;
    ctx.font = `bold ${28 * scale}px Arial, sans-serif`;
    const badgeText = article.category.toUpperCase();
    const badgeW = ctx.measureText(badgeText).width + badgePad * 2;
    ctx.fillStyle = colorPreset.from;
    ctx.beginPath();
    const r = 10 * scale;
    ctx.moveTo(badgeX + r, badgeY);
    ctx.lineTo(badgeX + badgeW - r, badgeY);
    ctx.quadraticCurveTo(badgeX + badgeW, badgeY, badgeX + badgeW, badgeY + r);
    ctx.lineTo(badgeX + badgeW, badgeY + 44 * scale - r);
    ctx.quadraticCurveTo(badgeX + badgeW, badgeY + 44 * scale, badgeX + badgeW - r, badgeY + 44 * scale);
    ctx.lineTo(badgeX + r, badgeY + 44 * scale);
    ctx.quadraticCurveTo(badgeX, badgeY + 44 * scale, badgeX, badgeY + 44 * scale - r);
    ctx.lineTo(badgeX, badgeY + r);
    ctx.quadraticCurveTo(badgeX, badgeY, badgeX + r, badgeY);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.fillText(badgeText, badgeX + badgePad, badgeY + 34 * scale);

    // Title text
    const titleY = H * 0.7 + 70 * scale;
    ctx.font = `bold ${62 * scale}px Arial, sans-serif`;
    ctx.fillStyle = "#ffffff";
    ctx.textBaseline = "top";
    const finalY = wrapText(ctx, overlayTitle, 60 * scale, titleY, W - 120 * scale, 78 * scale);

    // Divider
    ctx.fillStyle = colorPreset.from;
    ctx.fillRect(60 * scale, finalY + 20 * scale, 80 * scale, 6 * scale);

    // Branding
    ctx.font = `bold ${30 * scale}px Arial, sans-serif`;
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.fillText("TRICHY INSIGHT", 60 * scale, finalY + 52 * scale);

    // Website
    ctx.font = `${24 * scale}px Arial, sans-serif`;
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.fillText("trichyinsight.online", 60 * scale, finalY + 96 * scale);
  }, [imageUrl, colorPreset, overlayTitle, article.category]);

  // Render preview (scaled down)
  useEffect(() => {
    if (!previewCanvasRef.current) return;
    void drawCard(previewCanvasRef.current, 0.22);
  }, [drawCard]);

  const handleGenerate = async () => {
    if (!canvasRef.current) return;
    setGenerating(true);
    try {
      await drawCard(canvasRef.current, 1);
      const blob = await new Promise<Blob | null>((res) =>
        canvasRef.current!.toBlob(res, "image/jpeg", 0.92)
      );
      setGeneratedBlob(blob);
      toast({ title: "Reel card ready!", description: "Click Download or Post to Instagram." });
    } catch {
      toast({ title: "Generation failed", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!canvasRef.current) return;
    const link = document.createElement("a");
    link.download = `reel-${article.slug}.jpg`;
    link.href = canvasRef.current.toDataURL("image/jpeg", 0.92);
    link.click();
  };

  const handleCopyCaption = () => {
    void navigator.clipboard.writeText(caption).then(() => {
      toast({ title: "Caption copied!" });
    });
  };

  const handlePostInstagram = async () => {
    if (!generatedBlob && !imageUrl) {
      toast({ title: "Generate the reel card first", description: "Click 'Generate Reel Card' then post.", variant: "destructive" });
      return;
    }
    setPosting(true);
    try {
      const channels = loadDirectChannels();
      if (!channels.instagram.enabled) {
        toast({ title: "Instagram not configured", description: "Enable Instagram in the Channels tab first.", variant: "destructive" });
        return;
      }

      // Use generated reel card if available, otherwise article cover image
      let postImageUrl = imageUrl;
      if (generatedBlob) {
        postImageUrl = canvasRef.current!.toDataURL("image/jpeg", 0.92);
        // Instagram requires a publicly accessible URL — use cover image as fallback
        toast({ title: "Note", description: "Instagram requires a hosted image URL. Using article cover image. Download the reel card and upload manually for custom card." });
        postImageUrl = imageUrl;
      }

      const body = {
        article: {
          id: article.id,
          title: article.title,
          slug: article.slug,
          category: article.category,
          excerpt: caption,
          cover_image_url: postImageUrl,
        },
        siteUrl: window.location.origin + import.meta.env.BASE_URL,
        instagram: channels.instagram,
      };

      const res = await fetch("/api/social/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = (await res.json()) as {
        results?: { instagram?: { success: boolean; error?: string } | null };
      };

      if (data.results?.instagram?.success) {
        toast({ title: "Posted to Instagram!" });
      } else {
        throw new Error(data.results?.instagram?.error ?? `Server error ${res.status}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ title: "Instagram post failed", description: msg, variant: "destructive" });
    } finally {
      setPosting(false);
    }
  };

  return (
    <Dialog open={!!article} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-5xl w-full h-[92vh] flex flex-col gap-0 p-0 overflow-hidden">

        {/* Header */}
        <DialogHeader className="px-6 pt-5 pb-3 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2 font-heading uppercase text-base">
            <Clapperboard className="h-4 w-4 text-primary" />
            Create Reel
            <span className="font-normal text-muted-foreground text-sm truncate max-w-sm ml-1">
              — {article.title}
            </span>
          </DialogTitle>
        </DialogHeader>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden min-h-0">

          {/* ── Left: Live preview card ── */}
          <div className="w-56 shrink-0 flex flex-col border-r bg-muted/20 items-center py-4 gap-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground self-start px-4">
              Live Preview
            </p>

            {/* Canvas preview (scaled-down) */}
            <div className="rounded-xl overflow-hidden shadow-lg border border-border/50"
              style={{ width: 180, height: 320 }}>
              {imageUrl ? (
                <canvas
                  ref={previewCanvasRef}
                  style={{ width: 180, height: 320, display: "block" }}
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-b from-primary/60 to-black flex items-center justify-center">
                  <ImagePlay className="h-8 w-8 text-white/30" />
                </div>
              )}
            </div>

            {/* Color presets */}
            <div className="px-4 w-full">
              <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5 flex items-center gap-1">
                <Palette className="h-3 w-3" /> Color Theme
              </p>
              <div className="grid grid-cols-3 gap-1.5">
                {COLOR_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    onClick={() => setColorPreset(p)}
                    title={p.label}
                    className={`h-7 rounded-md transition-all ${colorPreset.label === p.label ? "ring-2 ring-offset-1 ring-foreground scale-105" : "hover:scale-105"}`}
                    style={{ background: `linear-gradient(135deg, ${p.from}, ${p.to})` }}
                  />
                ))}
              </div>
            </div>

            {/* Generate button */}
            <div className="px-4 w-full mt-auto">
              <Button
                size="sm"
                className="w-full gap-1.5 text-xs h-8"
                onClick={() => void handleGenerate()}
                disabled={generating}
              >
                {generating ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Film className="h-3 w-3" />}
                {generating ? "Generating…" : "Generate Card"}
              </Button>
              {generatedBlob !== null && (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full gap-1.5 text-xs h-8 mt-1.5"
                  onClick={handleDownload}
                >
                  <Download className="h-3 w-3" /> Download JPG
                </Button>
              )}
            </div>
          </div>

          {/* ── Right: Editor ── */}
          <div className="flex-1 flex flex-col min-w-0 overflow-y-auto p-6 gap-5">

            {/* Article info strip */}
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/40 border">
              {imageUrl && (
                <img src={imageUrl} alt="" className="h-14 w-14 rounded-md object-cover shrink-0" />
              )}
              <div className="min-w-0">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{article.category}</p>
                <p className="font-medium text-sm leading-snug line-clamp-2">{article.title}</p>
                {article.excerpt && (
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{article.excerpt}</p>
                )}
              </div>
            </div>

            {/* Card title (overlay text editor) */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
                <Type className="h-3.5 w-3.5" /> Card Overlay Text
              </Label>
              <Input
                value={overlayTitle}
                onChange={(e) => setOverlayTitle(e.target.value)}
                placeholder="Text shown on the reel card image..."
                className="text-sm"
              />
              <p className="text-[10px] text-muted-foreground">Edit to shorten or rephrase for visual impact. Pre-filled from article title.</p>
            </div>

            {/* Caption */}
            <div className="space-y-1.5 flex-1">
              <Label className="text-xs font-semibold uppercase tracking-wider">
                Post Caption
              </Label>
              <Textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                className="text-sm resize-none"
                rows={8}
                placeholder="Caption for Instagram, Facebook, etc..."
              />
              <p className="text-[10px] text-muted-foreground">Pre-filled with title, excerpt, and Tamil hashtags. Edit freely.</p>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2 pt-1">
              <Button variant="outline" className="gap-1.5 text-sm" onClick={handleCopyCaption}>
                <Copy className="h-4 w-4" /> Copy Caption
              </Button>
              <Button
                className="gap-1.5 text-sm bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-700 hover:to-pink-600 text-white border-0"
                onClick={() => void handlePostInstagram()}
                disabled={posting}
              >
                <Send className="h-4 w-4" />
                {posting ? "Posting to Instagram…" : "Post to Instagram"}
              </Button>
              <Button
                variant="ghost"
                className="gap-1.5 text-sm ml-auto text-muted-foreground"
                onClick={() => window.open(`https://trichyinsightnews.replit.app/?title=${encodeURIComponent(article.title)}&image=${encodeURIComponent(imageUrl)}`, "_blank")}
              >
                <ExternalLink className="h-4 w-4" /> Open Reel App
              </Button>
            </div>

            {/* How-to */}
            <div className="rounded-lg bg-muted/40 border p-4 text-xs text-muted-foreground space-y-2">
              <p className="font-semibold text-foreground text-[11px] uppercase tracking-wide">How to use</p>
              <ol className="list-decimal list-inside space-y-1 leading-relaxed">
                <li>Choose a colour theme on the left — the preview updates live.</li>
                <li>Edit the <strong>Card Overlay Text</strong> to shorten the headline for visual impact.</li>
                <li>Click <strong>Generate Card</strong> to render the full 1080×1920 reel image.</li>
                <li>Click <strong>Download JPG</strong> to save it, or <strong>Post to Instagram</strong> to publish directly.</li>
                <li>Edit the <strong>Post Caption</strong> before posting — it's pre-filled with the article content and hashtags.</li>
              </ol>
            </div>
          </div>
        </div>

        {/* Hidden full-res canvas */}
        <canvas ref={canvasRef} style={{ display: "none" }} />
      </DialogContent>
    </Dialog>
  );
}
