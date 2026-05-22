import { useState, useEffect } from "react";
import { Bell, BellOff, CheckCircle, MessageCircle, Phone } from "lucide-react";

const NOTIF_STORAGE_KEY = "trichy_notif_granted";
const VISIT_STORAGE_KEY = "trichy_last_visit";

const NewsletterSignup = () => {
  const [notifState, setNotifState] = useState<"idle" | "granted" | "denied" | "unsupported">("idle");
  const [justGranted, setJustGranted] = useState(false);

  useEffect(() => {
    if (!("Notification" in window)) {
      setNotifState("unsupported");
      return;
    }
    if (Notification.permission === "granted") {
      setNotifState("granted");
    } else if (Notification.permission === "denied") {
      setNotifState("denied");
    }
    localStorage.setItem(VISIT_STORAGE_KEY, new Date().toISOString());
  }, []);

  const requestNotifications = async () => {
    if (!("Notification" in window)) return;

    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      setNotifState("granted");
      setJustGranted(true);
      localStorage.setItem(NOTIF_STORAGE_KEY, "true");
      setTimeout(() => setJustGranted(false), 3000);

      new Notification("Trichy Insight", {
        body: "திருச்சி செய்திகளுக்கு நீங்கள் இப்போது பதிவு செய்துள்ளீர்கள்!",
        icon: "/favicon.svg",
        badge: "/favicon.svg",
      });
    } else {
      setNotifState("denied");
    }
  };

  return (
    <section className="bg-[#DC2626] py-12 sm:py-16">
      <div className="container">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">

          {/* Title */}
          <div className="md:col-span-2">
            <h2 className="font-heading text-white text-2xl sm:text-3xl uppercase leading-tight mb-2">
              திருச்சி செய்திகளை உடனடியாக பெறுங்கள்
            </h2>
            <p className="text-red-100 text-sm leading-relaxed">
              Breaking news, சிறப்பு அறிக்கைகள் மற்றும் உள்ளூர் மாற்றங்களை நேரடியாக உங்கள் இடத்திற்கே எடுத்துச் செல்லுங்கள்.
            </p>

            {/* Channel buttons */}
            <div className="flex flex-wrap gap-3 mt-5">
              {/* WhatsApp */}
              <a
                href="https://wa.me/918903952591?text=Trichy%20Insight%20-ல்%20செய்திகள்%20பெற%20விரும்புகிறேன்"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-white text-[#DC2626] hover:bg-red-50 font-heading font-bold text-sm uppercase tracking-wider px-5 py-2.5 transition-colors"
              >
                <MessageCircle className="h-4 w-4" />
                WhatsApp-ல் இணைய
              </a>

              {/* Phone */}
              <a
                href="tel:+918903952591"
                className="inline-flex items-center gap-2 border border-white/40 text-white hover:bg-white/10 font-heading text-sm uppercase tracking-wider px-5 py-2.5 transition-colors"
              >
                <Phone className="h-4 w-4" />
                +91 89039 52591
              </a>

              {/* Push notifications */}
              {notifState === "unsupported" ? null : notifState === "granted" ? (
                <div className="inline-flex items-center gap-2 bg-white/20 text-white font-heading text-sm uppercase tracking-wider px-5 py-2.5">
                  <CheckCircle className="h-4 w-4" />
                  {justGranted ? "பதிவு செய்யப்பட்டது!" : "அறிவிப்புகள் இயக்கப்பட்டது"}
                </div>
              ) : notifState === "denied" ? (
                <div className="inline-flex items-center gap-2 border border-white/20 text-white/50 font-heading text-sm uppercase tracking-wider px-5 py-2.5 cursor-not-allowed">
                  <BellOff className="h-4 w-4" />
                  அறிவிப்பு மறுக்கப்பட்டது
                </div>
              ) : (
                <button
                  onClick={requestNotifications}
                  className="inline-flex items-center gap-2 border border-white/40 text-white hover:bg-white/10 font-heading text-sm uppercase tracking-wider px-5 py-2.5 transition-colors"
                >
                  <Bell className="h-4 w-4" />
                  அறிவிப்புகளை இயக்க
                </button>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4">
            {[
              { value: "5M+", label: "மாதாந்திர வாசகர்கள்" },
              { value: "500+", label: "வெளியிடப்பட்ட செய்திகள்" },
              { value: "24/7", label: "நேரடி உள்ளடக்கம்" },
              { value: "3+", label: "ஆண்டுகளாக" },
            ].map(({ value, label }) => (
              <div key={label} className="bg-white/10 border border-white/20 p-4 text-center">
                <div className="font-heading text-white text-2xl font-bold">{value}</div>
                <div className="text-red-100 text-xs mt-0.5 leading-tight">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default NewsletterSignup;
