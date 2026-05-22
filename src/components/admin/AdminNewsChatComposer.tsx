import { useMemo, useRef, useState } from "react";
import { Loader2, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { uploadToNewsMedia } from "@/lib/news-media";
import { triggerGoogleNewsPublish } from "@/lib/google-news-publish";
import { triggerSocialPublish } from "@/lib/social-publish";

type ChatMessage = {
  id: string;
  role: "user" | "system";
  text: string;
};

type GeneratedArticle = {
  title?: string;
  slug?: string;
  category?: string;
  excerpt?: string;
  content?: string;
  cover_image_url?: string | null;
  video_url?: string | null;
  meta_title?: string;
  meta_description?: string;
  meta_keywords?: string[];
};

interface AdminNewsChatComposerProps {
  userId: string;
  onPostCreated: () => Promise<void>;
}

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

const AdminNewsChatComposer = ({ userId, onPostCreated }: AdminNewsChatComposerProps) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [message, setMessage] = useState("");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  const selectedImageLabel = useMemo(() => {
    if (!selectedImage) return "";
    const mb = selectedImage.size / (1024 * 1024);
    return `${selectedImage.name} (${mb.toFixed(2)} MB)`;
  }, [selectedImage]);

  const appendChat = (entry: ChatMessage) => {
    setChatMessages((prev) => [...prev, entry]);
  };

  const doesSlugExist = async (slug: string) => {
    const { count, error } = await supabase.from("news_posts").select("id", { count: "exact", head: true }).eq("slug", slug);
    if (error) throw error;
    return (count || 0) > 0;
  };

  const getUniqueSlug = async (rawSlug: string) => {
    const baseSlug = slugify(rawSlug) || `news-${Date.now()}`;
    let candidate = baseSlug;
    let suffix = 2;

    while (await doesSlugExist(candidate)) {
      candidate = `${baseSlug}-${suffix}`;
      suffix += 1;
      if (suffix > 100) {
        throw new Error("Slug உருவாக்க முடியவில்லை. வேறு தலைப்புடன் முயற்சிக்கவும்.");
      }
    }

    return candidate;
  };

  const resetComposer = () => {
    setMessage("");
    setSelectedImage(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSend = async () => {
    const text = message.trim();
    if (!text) {
      toast({ title: "செய்தி உரை தேவை", description: "News update message எழுதவும்.", variant: "destructive" });
      return;
    }

    if (selectedImage && !selectedImage.type.startsWith("image/")) {
      toast({ title: "படம் மட்டும் upload செய்யவும்", variant: "destructive" });
      return;
    }

    setSending(true);
    appendChat({
      id: crypto.randomUUID(),
      role: "user",
      text: selectedImage ? `${text}\n\n📷 ${selectedImage.name}` : text,
    });

    try {
      let uploadedImageUrl: string | null = null;
      if (selectedImage) {
        uploadedImageUrl = await uploadToNewsMedia(userId, selectedImage);
      }

      const { data, error } = await supabase.functions.invoke("generate-news-article", {
        body: {
          sourceText: text,
          imageUrl: uploadedImageUrl,
        },
      });

      if (error) throw error;

      const ai = (data || {}) as GeneratedArticle;
      const title = ai.title?.trim() || text.slice(0, 70);
      const content = ai.content?.trim() || "";
      const videoUrl = ai.video_url?.trim() || null;
      const coverImageUrl = uploadedImageUrl || ai.cover_image_url?.trim() || null;

      if (!content) {
        throw new Error("AI உள்ளடக்கம் உருவாக்கப்படவில்லை.");
      }

      if (!coverImageUrl && !videoUrl) {
        throw new Error("Image அல்லது video இல்லாமல் auto publish செய்ய முடியவில்லை.");
      }

      const finalSlug = await getUniqueSlug(ai.slug || title);
      const excerpt = (ai.excerpt?.trim() || content.slice(0, 220)).trim();

      const { data: inserted, error: insertError } = await supabase
        .from("news_posts")
        .insert({
          title,
          slug: finalSlug,
          category: ai.category?.trim() || "உள்ளூர்",
          excerpt,
          content,
          cover_image_url: coverImageUrl,
          video_url: videoUrl,
          meta_title: (ai.meta_title?.trim() || title).slice(0, 60),
          meta_description: (ai.meta_description?.trim() || excerpt).slice(0, 160),
          meta_keywords: Array.isArray(ai.meta_keywords) ? ai.meta_keywords.map((item) => item.trim()).filter(Boolean) : [],
          is_published: true,
          published_at: new Date().toISOString(),
          created_by: userId,
        })
        .select("id, title, slug")
        .single();

      if (insertError) throw insertError;

      const [socialResult, googleNewsResult] = await Promise.all([
        triggerSocialPublish(inserted.id, "chat"),
        triggerGoogleNewsPublish(inserted.id, "chat"),
      ]);

      appendChat({
        id: crypto.randomUUID(),
        role: "system",
        text: `✅ வெளியிடப்பட்டது: ${inserted.title} (${inserted.slug})`,
      });

      if (!socialResult.success && !socialResult.skipped) {
        appendChat({
          id: crypto.randomUUID(),
          role: "system",
          text: `⚠️ சமூக பகிர்வு தோல்வி: ${socialResult.error || "Unknown error"}`,
        });
      }

      if (!googleNewsResult.success && !googleNewsResult.skipped) {
        appendChat({
          id: crypto.randomUUID(),
          role: "system",
          text: `⚠️ Google News auto publish தோல்வி: ${googleNewsResult.error || "Unknown error"}`,
        });
      }

      toast({
        title: socialResult.success || googleNewsResult.success ? "செய்தி auto publish செய்யப்பட்டது" : "செய்தி publish ஆனது",
        description: !socialResult.success || !googleNewsResult.success ? "சில auto publish சேனல்களில் சிக்கல்." : undefined,
      });
      resetComposer();
      await onPostCreated();
    } catch (error) {
      const description = error instanceof Error ? error.message : "Unexpected error";
      appendChat({
        id: crypto.randomUUID(),
        role: "system",
        text: `❌ தோல்வி: ${description}`,
      });
      toast({ title: "Auto publish தோல்வி", description, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-xl uppercase flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" /> Chat News Publisher
        </CardTitle>
        <CardDescription>செய்தி உரை (மற்றும் விருப்பமான படம்) அனுப்புங்கள் — புதிய செய்தி உருவாக்கி உடனே publish செய்யப்படும்.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ScrollArea className="h-52 rounded-md border border-border p-3">
          <div className="space-y-2">
            {chatMessages.length === 0 ? (
              <p className="text-sm text-muted-foreground">இங்கே chat history வரும்.</p>
            ) : (
              chatMessages.map((entry) => (
                <div key={entry.id} className={`flex ${entry.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] whitespace-pre-wrap rounded-md px-3 py-2 text-sm ${
                      entry.role === "user" ? "bg-secondary text-secondary-foreground" : "bg-muted text-foreground"
                    }`}
                  >
                    {entry.text}
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        <div className="space-y-2">
          <Label htmlFor="chat-news-input">News Message</Label>
          <Textarea
            id="chat-news-input"
            rows={4}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Breaking update, இடம், நேரம், முக்கிய விவரங்கள்..."
            disabled={sending}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="chat-news-image">Image (Optional)</Label>
          <Input
            id="chat-news-image"
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={(event) => setSelectedImage(event.target.files?.[0] ?? null)}
            disabled={sending}
            className="max-w-sm"
          />
          {selectedImageLabel && <p className="text-xs text-muted-foreground">Selected: {selectedImageLabel}</p>}
        </div>

        <Button type="button" onClick={handleSend} disabled={sending}>
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {sending ? "அனுப்பப்படுகிறது..." : "Send & Auto Publish"}
        </Button>
      </CardContent>
    </Card>
  );
};

export default AdminNewsChatComposer;
