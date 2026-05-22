import { supabase } from "@/integrations/supabase/client";

export type SocialPublishSource = "chat" | "manual-form" | "toggle-publish";

type SocialPublishResponse = {
  success?: boolean;
  skipped?: boolean;
  error?: string;
};

export const triggerSocialPublish = async (postId: string, source: SocialPublishSource) => {
  const { data, error } = await supabase.functions.invoke("post-news-to-social", {
    body: {
      postId,
      source,
      publicBaseUrl: window.location.origin,
    },
  });

  if (error) {
    return {
      success: false,
      skipped: false,
      error: error.message,
    };
  }

  const payload = (data || {}) as SocialPublishResponse;

  return {
    success: !!payload.success,
    skipped: !!payload.skipped,
    error: payload.error || null,
  };
};
