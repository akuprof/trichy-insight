import { useState } from "react";
import { Loader2, RefreshCcw, Upload, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { uploadToNewsMedia } from "@/lib/news-media";

interface ArticleMediaUpdaterProps {
  postId: string;
  userId: string;
  currentImageUrl?: string | null;
  currentVideoUrl?: string | null;
  onUpdated: () => Promise<void>;
}

const ArticleMediaUpdater = ({ postId, userId, currentImageUrl, currentVideoUrl, onUpdated }: ArticleMediaUpdaterProps) => {
  const { toast } = useToast();
  const [updating, setUpdating] = useState(false);

  const updatePostMedia = async (mediaPatch: { cover_image_url?: string | null; video_url?: string | null }) => {
    const { error } = await supabase.from("news_posts").update(mediaPatch).eq("id", postId);
    if (error) throw error;
  };

  const handleReplaceImage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "படம் file மட்டும் upload செய்யவும்", variant: "destructive" });
      return;
    }

    try {
      setUpdating(true);
      const imageUrl = await uploadToNewsMedia(userId, file);
      await updatePostMedia({ cover_image_url: imageUrl });
      await onUpdated();
      toast({ title: "Image replace வெற்றிகரமாக முடிந்தது" });
    } catch (error) {
      toast({ title: "Image replace தோல்வி", description: error instanceof Error ? error.message : "Failed", variant: "destructive" });
    } finally {
      setUpdating(false);
      event.target.value = "";
    }
  };

  const handleReplaceVideo = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      toast({ title: "வீடியோ file மட்டும் upload செய்யவும்", variant: "destructive" });
      return;
    }

    try {
      setUpdating(true);
      const videoUrl = await uploadToNewsMedia(userId, file);
      await updatePostMedia({ video_url: videoUrl });
      await onUpdated();
      toast({ title: "Video replace வெற்றிகரமாக முடிந்தது" });
    } catch (error) {
      toast({ title: "Video replace தோல்வி", description: error instanceof Error ? error.message : "Failed", variant: "destructive" });
    } finally {
      setUpdating(false);
      event.target.value = "";
    }
  };

  const clearPlaceholder = async () => {
    try {
      setUpdating(true);
      const patch: { cover_image_url?: string | null; video_url?: string | null } = {};
      if ((currentImageUrl || "").includes("/placeholder.svg")) patch.cover_image_url = null;
      if ((currentVideoUrl || "").includes("placeholder")) patch.video_url = null;
      if (Object.keys(patch).length) {
        await updatePostMedia(patch);
        await onUpdated();
      }
      toast({ title: "Placeholder cleanup முடிந்தது" });
    } catch (error) {
      toast({ title: "Cleanup தோல்வி", description: error instanceof Error ? error.message : "Failed", variant: "destructive" });
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="space-y-2 w-full">
      <div className="flex flex-wrap gap-2">
        <Input type="file" accept="image/*" onChange={handleReplaceImage} disabled={updating} className="max-w-48" />
        <Input type="file" accept="video/*" onChange={handleReplaceVideo} disabled={updating} className="max-w-48" />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={updating} onClick={clearPlaceholder}>
          {updating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />} Clear Placeholder
        </Button>
        <Button type="button" variant="secondary" disabled>
          <Upload className="h-4 w-4" /> Image
        </Button>
        <Button type="button" variant="secondary" disabled>
          <Video className="h-4 w-4" /> Video
        </Button>
      </div>
    </div>
  );
};

export default ArticleMediaUpdater;
