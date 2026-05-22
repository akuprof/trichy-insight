import { useEffect, useState } from "react";
import { BarChart3, Eye, TrendingUp, FileText, Users, ArrowUpRight, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ArticleStat {
  id: string;
  slug: string;
  title: string;
  category: string;
  published_at: string | null;
  views: number;
}

interface DayStat {
  date: string;
  views: number;
}

const AdminAnalytics = () => {
  const [topArticles, setTopArticles] = useState<ArticleStat[]>([]);
  const [dayStat, setDayStat] = useState<DayStat[]>([]);
  const [totalViews, setTotalViews] = useState(0);
  const [todayViews, setTodayViews] = useState(0);
  const [totalArticles, setTotalArticles] = useState(0);
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const [viewsRes, todayRes, postsRes] = await Promise.all([
        supabase
          .from("page_view_events")
          .select("post_id, viewed_at")
          .gte("viewed_at", thirtyDaysAgo)
          .limit(5000),
        supabase
          .from("page_view_events")
          .select("id", { count: "exact" })
          .gte("viewed_at", todayStart.toISOString()),
        supabase
          .from("news_posts")
          .select("id,slug,title,category,published_at")
          .eq("is_published", true)
          .order("published_at", { ascending: false, nullsFirst: false }),
      ]);

      const views = viewsRes.data || [];
      setTotalViews(views.length);
      setTodayViews(todayRes.count || 0);

      const posts = postsRes.data || [];
      setTotalArticles(posts.length);

      // Views by post_id
      const postCounts: Record<string, number> = {};
      views.forEach(({ post_id }) => {
        if (post_id) postCounts[post_id] = (postCounts[post_id] || 0) + 1;
      });

      // Top 10 articles by views
      const topIds = Object.entries(postCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([id]) => id);

      const topWithMeta = topIds
        .map((id) => {
          const post = posts.find((p) => p.id === id);
          return post
            ? { ...post, views: postCounts[id] }
            : null;
        })
        .filter(Boolean) as ArticleStat[];

      setTopArticles(topWithMeta);

      // Category distribution
      const cats: Record<string, number> = {};
      posts.forEach(({ category }) => {
        cats[category] = (cats[category] || 0) + 1;
      });
      setCategoryCounts(cats);

      // Views by day (last 14 days)
      const dayMap: Record<string, number> = {};
      const now = Date.now();
      for (let i = 13; i >= 0; i--) {
        const d = new Date(now - i * 86_400_000);
        const key = d.toISOString().slice(0, 10);
        dayMap[key] = 0;
      }
      views.forEach(({ viewed_at }) => {
        const key = viewed_at.slice(0, 10);
        if (key in dayMap) dayMap[key]++;
      });
      setDayStat(Object.entries(dayMap).map(([date, v]) => ({ date, views: v })));

      setLoading(false);
    };

    void load();
  }, []);

  const maxDayViews = Math.max(1, ...dayStat.map((d) => d.views));
  const maxArticleViews = Math.max(1, ...topArticles.map((a) => a.views));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <div className="text-center space-y-2">
          <BarChart3 className="h-8 w-8 mx-auto animate-pulse" />
          <p className="text-sm">Analytics ஏற்றப்படுகிறது...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "மொத்த பார்வைகள் (30 நாட்கள்)", value: totalViews.toLocaleString("ta-IN"), icon: Eye, color: "text-blue-500" },
          { label: "இன்றைய பார்வைகள்", value: todayViews.toLocaleString("ta-IN"), icon: TrendingUp, color: "text-green-500" },
          { label: "வெளியிடப்பட்ட செய்திகள்", value: totalArticles.toLocaleString("ta-IN"), icon: FileText, color: "text-[#DC2626]" },
          { label: "செய்தி பிரிவுகள்", value: Object.keys(categoryCounts).length.toString(), icon: Users, color: "text-purple-500" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground leading-snug">{label}</p>
                  <p className="text-2xl font-heading font-bold mt-1">{value}</p>
                </div>
                <Icon className={`h-5 w-5 ${color} shrink-0 mt-0.5`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Views by Day Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-heading uppercase tracking-wider flex items-center gap-2">
            <Calendar className="h-4 w-4 text-[#DC2626]" />
            கடந்த 14 நாட்களில் பார்வைகள்
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-1 h-32">
            {dayStat.map(({ date, views }) => (
              <div key={date} className="flex-1 flex flex-col items-center gap-1 group">
                <div className="relative flex-1 w-full flex items-end">
                  <div
                    className="w-full bg-[#DC2626]/80 hover:bg-[#DC2626] transition-colors rounded-t-sm"
                    style={{ height: `${Math.max(4, (views / maxDayViews) * 100)}%` }}
                    title={`${date}: ${views} பார்வைகள்`}
                  />
                </div>
                <span className="text-[9px] text-muted-foreground hidden sm:block rotate-45 origin-left w-6 overflow-hidden whitespace-nowrap">
                  {date.slice(5)}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Articles */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-heading uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-[#DC2626]" />
              அதிகம் பார்க்கப்பட்ட செய்திகள்
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topArticles.length === 0 ? (
              <p className="text-sm text-muted-foreground">போதுமான data இல்லை.</p>
            ) : (
              <div className="space-y-3">
                {topArticles.map((a, i) => (
                  <div key={a.id} className="space-y-1">
                    <div className="flex items-start gap-2">
                      <span className="text-xs font-bold text-muted-foreground w-4 shrink-0 mt-0.5">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <a
                          href={`/news/${a.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm font-medium line-clamp-1 hover:text-primary transition-colors flex items-center gap-1 group"
                        >
                          {a.title}
                          <ArrowUpRight className="h-3 w-3 opacity-0 group-hover:opacity-100 shrink-0" />
                        </a>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-primary font-heading uppercase">{a.category}</span>
                          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                            <Eye className="h-2.5 w-2.5" /> {a.views}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="ml-6">
                      <div
                        className="h-1 bg-[#DC2626]/20 rounded-full overflow-hidden"
                      >
                        <div
                          className="h-full bg-[#DC2626] rounded-full"
                          style={{ width: `${(a.views / maxArticleViews) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Category Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-heading uppercase tracking-wider flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-[#DC2626]" />
              பிரிவு வாரியான செய்திகள்
            </CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(categoryCounts).length === 0 ? (
              <p className="text-sm text-muted-foreground">செய்திகள் இல்லை.</p>
            ) : (
              <div className="space-y-2.5">
                {Object.entries(categoryCounts)
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, 8)
                  .map(([cat, count]) => {
                    const maxCat = Math.max(...Object.values(categoryCounts));
                    return (
                      <div key={cat} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium truncate">{cat}</span>
                          <span className="text-muted-foreground ml-2 shrink-0">{count}</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full"
                            style={{ width: `${(count / maxCat) * 100}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminAnalytics;
