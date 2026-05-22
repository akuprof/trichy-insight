import { useState } from "react";
import { Loader2, Sparkles, Upload, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { uploadToNewsMedia } from "@/lib/news-media";

interface AdminMediaFieldsProps {
  userId: string;
  imageUrl: string;
  videoUrl: string;
  aiContext: {
    title: string;
    category: string;
    excerpt: string;
  };
  onImageUrlChange: (value: string) => void;
  onVideoUrlChange: (value: string) => void;
}

const AdminMediaFields = ({ userId, imageUrl, videoUrl, aiContext, onImageUrlChange, onVideoUrlChange }: AdminMediaFieldsProps) => {
  const { toast } = useToast();
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({ title: "படம் மட்டும் upload செய்யவும்", variant: "destructive" });
      return;
    }

    try {
      setUploadingImage(true);
      const publicUrl = await uploadToNewsMedia(userId, file);
      onImageUrlChange(publicUrl);
      toast({ title: "படம் upload ஆனது" });
    } catch (error) {
      toast({
        title: "Image upload தோல்வி",
        description: error instanceof Error ? error.message : "Upload failed",
        variant: "destructive",
      });
    } finally {
      setUploadingImage(false);
      event.target.value = "";
    }
  };

  const handleVideoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("video/")) {
      toast({ title: "வீடியோ file மட்டும் upload செய்யவும்", variant: "destructive" });
      return;
    }

    try {
      setUploadingVideo(true);
      const publicUrl = await uploadToNewsMedia(userId, file);
      onVideoUrlChange(publicUrl);
      toast({ title: "வீடியோ upload ஆனது" });
    } catch (error) {
      toast({
        title: "Video upload தோல்வி",
        description: error instanceof Error ? error.message : "Upload failed",
        variant: "destructive",
      });
    } finally {
      setUploadingVideo(false);
      event.target.value = "";
    }
  };

  const handleGenerateAiImage = async () => {
    if (!aiContext.title.trim()) {
      toast({ title: "தலைப்பு தேவை", description: "AI thumbnail generate செய்ய title நிரப்பவும்.", variant: "destructive" });
      return;
    }

    try {
      setGeneratingImage(true);
      const { data, error } = await supabase.functions.invoke("generate-news-thumbnail", {
        body: {
          title: aiContext.title.trim(),
          category: aiContext.category.trim() || "உள்ளூர்",
          excerpt: aiContext.excerpt.trim() || null,
        },
      });

      if (error) throw error;

      const imageUrl = (data as { imageUrl?: string } | null)?.imageUrl;
      if (!imageUrl) {
        throw new Error("AI image URL not returned");
      }

      onImageUrlChange(imageUrl);
      toast({ title: "AI thumbnail உருவாக்கப்பட்டது" });
    } catch (error) {
      toast({
        title: "AI thumbnail தோல்வி",
        description: error instanceof Error ? error.message : "Generation failed",
        variant: "destructive",
      });
    } finally {
      setGeneratingImage(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="cover">Cover Image URL</Label>
        <Input id="cover" value={imageUrl} onChange={(e) => onImageUrlChange(e.target.value)} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="image-upload">Image Upload</Label>
        <div className="flex flex-wrap items-center gap-2">
          <Input id="image-upload" type="file" accept="image/*" onChange={handleImageUpload} disabled={uploadingImage || generatingImage} className="max-w-sm" />
          <Button type="button" variant="secondary" disabled={uploadingImage || generatingImage}>
            {uploadingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {uploadingImage ? "Uploading..." : "Upload Image"}
          </Button>
          <Button type="button" variant="outline" onClick={handleGenerateAiImage} disabled={generatingImage || uploadingImage}>
            {generatingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {generatingImage ? "Generating..." : "AI Generate Thumbnail"}
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="video-url">Video URL</Label>
        <Input
          id="video-url"
          placeholder="https://.../clip.mp4 அல்லது embed URL"
          value={videoUrl}
          onChange={(e) => onVideoUrlChange(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="video-upload">Video Upload</Label>
        <div className="flex flex-wrap items-center gap-2">
          <Input id="video-upload" type="file" accept="video/*" onChange={handleVideoUpload} disabled={uploadingVideo} className="max-w-sm" />
          <Button type="button" variant="secondary" disabled={uploadingVideo}>
            {uploadingVideo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4" />}
            {uploadingVideo ? "Uploading..." : "Upload Video"}
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">ஒவ்வொரு செய்திக்கும் image அல்லது video அவசியம். Placeholder media இருந்தால் upload அல்லது AI thumbnail கொண்டு replace செய்யலாம்.</p>
    </div>
  );
};

export default AdminMediaFields;
