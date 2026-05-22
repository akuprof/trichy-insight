import { supabase } from "@/integrations/supabase/client";

const sanitizeFileName = (name: string) =>
  name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9.-]/g, "");

export const uploadToNewsMedia = async (userId: string, file: File) => {
  const safeName = sanitizeFileName(file.name) || `media-${Date.now()}`;
  const filePath = `${userId}/${Date.now()}-${safeName}`;

  const { error } = await supabase.storage.from("news-media").upload(filePath, file, {
    cacheControl: "3600",
    upsert: false,
  });

  if (error) throw error;

  const { data } = supabase.storage.from("news-media").getPublicUrl(filePath);
  return data.publicUrl;
};
