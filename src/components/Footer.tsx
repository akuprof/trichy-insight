import { Facebook, Globe, Instagram, Mail, MapPin, Phone, Youtube, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import logo from "@/assets/logo.png";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";
import NewsletterSubscribe from "@/components/NewsletterSubscribe";

const Footer = () => {
  const { settings } = useSiteSettings();
  const pc = settings.primary_color;
  const siteName = settings.site_name;
  const [nameFirst, ...nameRest] = siteName.split(" ");

  const socialLinks = [
    { href: settings.youtube_url, icon: Youtube, label: "YouTube" },
    { href: settings.instagram_url, icon: Instagram, label: "Instagram" },
    { href: settings.facebook_url, icon: Facebook, label: "Facebook" },
    { href: `https://${settings.domain}`, icon: Globe, label: "Website" },
  ].filter(s => s.href);

  const categoryLinks = settings.categories.map(c => ({
    label: c.label,
    href: `#${c.id}`,
  }));

  return (
    <footer className="bg-[#0F172A] text-white" style={{ borderTop: `4px solid ${pc}` }}>
      <div className="container py-12 sm:py-16">
        {/* Newsletter */}
        <div className="mb-10">
          <NewsletterSubscribe />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-12">

          {/* Brand column */}
          <div className="sm:col-span-2 lg:col-span-1">
            <Link to="/" className="flex items-center gap-2.5 mb-5 group w-fit">
              {settings.logo_url ? (
                <img src={settings.logo_url} alt={siteName} className="h-11 w-auto"
                  onError={e => { e.currentTarget.style.display = "none"; }} />
              ) : (
                <img src={logo} alt={siteName} className="h-11 w-auto" />
              )}
              <div>
                <div className="font-heading text-lg uppercase font-bold leading-none text-white">
                  {nameFirst}{" "}
                  {nameRest.length > 0 && <span style={{ color: pc }}>{nameRest.join(" ")}</span>}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">{settings.tagline}</div>
              </div>
            </Link>
            <p className="text-slate-400 text-sm leading-relaxed mb-6 max-w-xs">
              {settings.about_text}
            </p>
            <div className="flex gap-3">
              {socialLinks.map(({ href, icon: Icon, label }) => (
                <a key={label} href={href} target="_blank" rel="noopener noreferrer" aria-label={label}
                  className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center text-white transition-all duration-200 hover:-translate-y-1"
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = pc)}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = "")}>
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Quick links */}
          <div>
            <h3 className="font-heading uppercase text-xs tracking-widest mb-5 flex items-center gap-2">
              <span className="w-2 h-2 inline-block" style={{ backgroundColor: pc }} />
              பிரிவுகள்
            </h3>
            <ul className="space-y-3">
              {[{ label: "சமீபத்திய செய்திகள்", href: "#latest" }, ...categoryLinks].map(({ label, href }) => (
                <li key={href}>
                  <a href={href}
                    className="text-sm text-slate-400 hover:text-white transition-colors flex items-center gap-2 group">
                    <ChevronRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" style={{ color: pc }} />
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="font-heading uppercase text-xs tracking-widest mb-5 flex items-center gap-2">
              <span className="w-2 h-2 inline-block" style={{ backgroundColor: pc }} />
              தொடர்பு
            </h3>
            <ul className="space-y-3.5">
              {settings.maps_url && (
                <li>
                  <a href={settings.maps_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-start gap-2.5 text-sm text-slate-400 hover:text-white transition-colors group">
                    <MapPin className="h-4 w-4 shrink-0 mt-0.5" style={{ color: pc }} />
                    <span>{settings.location}</span>
                  </a>
                </li>
              )}
              {settings.contact_email && (
                <li>
                  <a href={`mailto:${settings.contact_email}`}
                    className="flex items-center gap-2.5 text-sm text-slate-400 hover:text-white transition-colors">
                    <Mail className="h-4 w-4 shrink-0" style={{ color: pc }} />
                    {settings.contact_email}
                  </a>
                </li>
              )}
              {settings.contact_phone && (
                <li>
                  <a href={`tel:${settings.contact_phone}`}
                    className="flex items-center gap-2.5 text-sm text-slate-400 hover:text-white transition-colors">
                    <Phone className="h-4 w-4 shrink-0" style={{ color: pc }} />
                    {settings.contact_phone}
                  </a>
                </li>
              )}
            </ul>
          </div>

          {/* WhatsApp / Ad */}
          <div>
            <h3 className="font-heading uppercase text-xs tracking-widest mb-5 flex items-center gap-2">
              <span className="w-2 h-2 inline-block" style={{ backgroundColor: pc }} />
              விளம்பரம் செய்யுங்கள்
            </h3>
            <div className="border border-dashed border-white/20 p-4 text-center mb-4">
              <p className="text-sm text-slate-400 mb-3 leading-relaxed">
                ஆயிரக்கணக்கான உள்ளூர் பார்வையாளர்களை{" "}
                <span className="text-white font-medium">₹3,000</span> முதல் எட்டுங்கள்.
              </p>
              <a href="#advertise"
                className="inline-block text-white text-xs font-heading uppercase tracking-wider px-4 py-2 transition-colors"
                style={{ backgroundColor: pc }}>
                விலைகள் பார்க்க
              </a>
            </div>
            {settings.whatsapp_number && (
              <div className="p-3 bg-slate-800/60 border border-white/10 text-xs text-slate-400 leading-relaxed">
                <span className="font-heading uppercase tracking-wider text-[10px]" style={{ color: pc }}>
                  WhatsApp News
                </span>
                <br />
                உடனடி செய்திகளுக்கு WhatsApp-ல் இணைந்திடுங்கள்.{" "}
                <a href={`https://wa.me/${settings.whatsapp_number}`}
                  target="_blank" rel="noopener noreferrer"
                  className="text-white font-medium transition-colors hover:underline">
                  இப்போதே சேருங்கள் →
                </a>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/10">
        <div className="container py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <span>© {new Date().getFullYear()} {settings.site_name}. அனைத்து உரிமைகளும் பாதுகாக்கப்பட்டவை.</span>
          <div className="flex items-center gap-4">
            <span>{settings.location}</span>
            <Link to="/about" className="hover:text-white transition-colors">About</Link>
            <Link to="/privacy-policy" className="hover:text-white transition-colors">Privacy Policy</Link>
            <Link to="/admin" className="hover:text-white transition-colors">Admin</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
