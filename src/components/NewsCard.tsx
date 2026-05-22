import { Clock } from "lucide-react";
import { Link } from "react-router-dom";
import logo from "@/assets/logo.png";

interface NewsCardProps {
  category: string;
  title: string;
  excerpt: string;
  time: string;
  views: string;
  featured?: boolean;
  link?: string;
  imageUrl?: string;
  videoUrl?: string;
}

const CategoryPill = ({ label, small }: { label: string; small?: boolean }) => (
  <span
    className={`inline-block max-w-full truncate bg-primary text-primary-foreground font-heading font-bold uppercase tracking-wider leading-none ${
      small ? "text-[9px] px-1.5 py-0.5" : "text-[11px] px-2 py-1"
    }`}
    title={label}
  >
    {label}
  </span>
);

const Watermark = ({ featured }: { featured?: boolean }) => (
  <img
    src={logo}
    alt=""
    aria-hidden
    className={`absolute pointer-events-none select-none ${
      featured ? "bottom-3 right-3 w-10 opacity-20" : "bottom-1 right-1 w-6 opacity-15"
    }`}
    loading="lazy"
  />
);

const FALLBACK = "/placeholder.svg";

const MediaBox = ({
  videoUrl,
  imageUrl,
  title,
  featured,
}: {
  videoUrl?: string;
  imageUrl?: string;
  title: string;
  featured?: boolean;
}) => (
  <div className="absolute inset-0">
    {videoUrl ? (
      <video
        src={videoUrl}
        className="w-full h-full object-cover"
        muted
        playsInline
        preload="metadata"
      />
    ) : imageUrl ? (
      <img
        src={imageUrl}
        alt={title}
        className="w-full h-full object-cover"
        loading={featured ? "eager" : "lazy"}
        fetchPriority={featured ? "high" : "auto"}
        decoding={featured ? "sync" : "async"}
        onError={(e) => { (e.currentTarget as HTMLImageElement).src = FALLBACK; }}
      />
    ) : (
      <div className="w-full h-full bg-secondary/80 flex items-center justify-center">
        <span className="text-muted-foreground text-xs">படம் இல்லை</span>
      </div>
    )}
    <Watermark featured={featured} />
  </div>
);

/* ── Featured (large) card ── */
const FeaturedArticle = ({
  category, title, excerpt, time, imageUrl, videoUrl,
}: Omit<NewsCardProps, "featured" | "link" | "views">) => (
  <article className="group bg-card border border-border hover:border-primary/60 hover:shadow-lg hover:shadow-primary/10 transition-all duration-300 overflow-hidden">
    <div className="relative overflow-hidden" style={{ paddingTop: "56.25%" }}>
      <MediaBox videoUrl={videoUrl} imageUrl={imageUrl} title={title} featured />
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
      {/* Category at bottom-left */}
      <div className="absolute bottom-3 left-3 right-12">
        <CategoryPill label={category} />
      </div>
    </div>
    <div className="p-3 sm:p-4">
      <h3 className="font-heading text-base sm:text-lg uppercase leading-tight group-hover:text-primary transition-colors line-clamp-2">
        {title}
      </h3>
      {excerpt && (
        <p className="text-muted-foreground text-xs sm:text-sm mt-2 line-clamp-2 leading-relaxed">
          {excerpt}
        </p>
      )}
      <div className="flex items-center gap-1 mt-3 text-xs text-muted-foreground">
        <Clock className="h-3 w-3 shrink-0" />
        {time}
      </div>
    </div>
  </article>
);

/* ── Compact (sidebar) card ── */
const CompactArticle = ({
  category, title, time, imageUrl, videoUrl,
}: Omit<NewsCardProps, "featured" | "link" | "excerpt" | "views">) => (
  <article className="group flex gap-3 py-3 px-3 border-b border-border last:border-0 hover:bg-muted/40 transition-colors cursor-pointer">
    <div className="relative w-20 h-14 shrink-0 overflow-hidden bg-secondary">
      <MediaBox videoUrl={videoUrl} imageUrl={imageUrl} title={title} />
    </div>
    <div className="flex-1 min-w-0">
      <CategoryPill label={category.split("/")[0].trim()} small />
      <h4 className="font-heading text-xs sm:text-sm uppercase leading-snug mt-1 group-hover:text-primary transition-colors line-clamp-2">
        {title}
      </h4>
      <span className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground">
        <Clock className="h-2.5 w-2.5" />
        {time}
      </span>
    </div>
  </article>
);

/* ── Default export ── */
const NewsCard = ({
  category, title, excerpt, time, views, featured, link, imageUrl, videoUrl,
}: NewsCardProps) => {
  const props = { category, title, excerpt: excerpt ?? "", time, views, imageUrl, videoUrl };

  if (featured) {
    return link ? (
      <Link to={link} className="block">
        <FeaturedArticle {...props} />
      </Link>
    ) : (
      <div>
        <FeaturedArticle {...props} />
      </div>
    );
  }

  return link ? (
    <Link to={link} className="block">
      <CompactArticle {...props} />
    </Link>
  ) : (
    <div>
      <CompactArticle {...props} />
    </div>
  );
};

export default NewsCard;
