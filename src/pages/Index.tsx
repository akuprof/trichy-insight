import Navbar from "@/components/Navbar";
import WeatherWidget from "@/components/WeatherWidget";
import HeroSection from "@/components/HeroSection";
import YouTubeLiveSection from "@/components/YouTubeLiveSection";
import TrendingWidget from "@/components/TrendingWidget";
import LatestNews from "@/components/LatestNews";
import CategorySection from "@/components/CategorySection";
import NewsletterSignup from "@/components/NewsletterSignup";
import RateCard from "@/components/RateCard";
import Footer from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useEffect } from "react";

const Index = () => {
  const { user } = useAuth();

  useEffect(() => {
    const trackView = async () => {
      await supabase.from("page_view_events").insert({
        path: window.location.pathname,
        referrer: document.referrer || null,
        user_agent: navigator.userAgent || null,
        viewer_id: user?.id ?? null,
      });
    };
    void trackView();
  }, [user?.id]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <WeatherWidget />
        <HeroSection />
        <YouTubeLiveSection />
        <TrendingWidget />
        <LatestNews />
        <CategorySection />
        <NewsletterSignup />
        <RateCard />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
