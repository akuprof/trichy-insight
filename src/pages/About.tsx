import { Building2, Calendar, Mail, MapPin, Phone, Award, Newspaper } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const About = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 container py-12 max-w-4xl">

        {/* Header */}
        <div className="flex items-center gap-3 mb-10">
          <div className="p-2 rounded-lg bg-primary/10">
            <Newspaper className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="font-heading text-2xl uppercase tracking-wide">எங்களை பற்றி</h1>
            <p className="text-xs text-muted-foreground mt-0.5">About Trichy Insight</p>
          </div>
        </div>

        {/* Mission */}
        <section className="mb-10 border border-muted-foreground/15 p-6">
          <h2 className="font-heading text-sm uppercase tracking-widest text-primary mb-4 border-b border-primary/30 pb-2">
            எங்கள் லட்சியம்
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed mb-3">
            <strong className="text-foreground">Trichy Insight</strong> — திருச்சிராப்பள்ளி மாவட்டத்தின் நம்பகமான தமிழ் டிஜிட்டல் செய்தி தளம்.
            உள்ளூர் மக்களின் பிரச்சனைகளை, அரசியல் நகர்வுகளை, குடிமை விஷயங்களை நேர்மையாக சொல்வதே எங்கள் குறிக்கோள்.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            "சொல்லப்படாததை சொல்லுவோம். கேட்கப்படாததை கேட்போம்." — இது எங்கள் உறுதிமொழி.
          </p>
        </section>

        {/* Business Details */}
        <section className="mb-10">
          <h2 className="font-heading text-sm uppercase tracking-widest text-primary mb-4 border-b border-primary/30 pb-2">
            நிறுவன விவரங்கள்
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { icon: Building2, label: "நிறுவனம்", value: "Trichy Insight – Local News Portal" },
              { icon: Award, label: "Udyam எண்", value: "UDYAM-TN-27-0126150" },
              { icon: Calendar, label: "பதிவு தேதி", value: "02 ஜனவரி 2018" },
              { icon: Building2, label: "வகை", value: "Micro Enterprise – Services (MSME)" },
              { icon: MapPin, label: "முகவரி", value: "9b, Muthaliyar Street, Arab Appartment, Woraiyur, திருச்சிராப்பள்ளி – 620003" },
              { icon: Phone, label: "தொலைபேசி", value: "+91 96002 10429" },
              { icon: Mail, label: "மின்னஞ்சல்", value: "akbarzoozoo666@gmail.com" },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-start gap-3 border border-muted-foreground/15 p-4">
                <Icon className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] font-heading uppercase tracking-wider text-muted-foreground mb-0.5">{label}</p>
                  <p className="text-sm text-foreground">{value}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Udyam Certificate */}
        <section className="mb-10">
          <h2 className="font-heading text-sm uppercase tracking-widest text-primary mb-4 border-b border-primary/30 pb-2">
            உத்யம் பதிவு சான்றிதழ்
          </h2>
          <p className="text-xs text-muted-foreground mb-4">
            இந்திய அரசு MSME அமைச்சகம் வழங்கிய அதிகாரப்பூர்வ Udyam பதிவு சான்றிதழ் (UDYAM-TN-27-0126150).
          </p>
          <div className="space-y-4">
            {["/udyam-cert-1.png", "/udyam-cert-2.png", "/udyam-cert-3.png"].map((src, i) => (
              <div key={i} className="border border-muted-foreground/15 overflow-hidden">
                <img
                  src={src}
                  alt={`Udyam Registration Certificate page ${i + 1}`}
                  className="w-full h-auto"
                  loading="lazy"
                />
              </div>
            ))}
          </div>
        </section>

        {/* Contact CTA */}
        <section className="border border-dashed border-primary/30 p-6 text-center">
          <h2 className="font-heading text-sm uppercase tracking-widest text-primary mb-2">தொடர்பு கொள்ளுங்கள்</h2>
          <p className="text-sm text-muted-foreground mb-4">செய்திக் குறிப்புகள், விளம்பரம், அல்லது கூட்டுறவுக்கு:</p>
          <div className="flex flex-wrap justify-center gap-3">
            <a
              href="tel:+918903952591"
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground text-xs font-heading uppercase tracking-wider px-5 py-2.5 hover:bg-primary/90 transition-colors"
            >
              <Phone className="h-3.5 w-3.5" />
              அழையுங்கள்
            </a>
            <a
              href="https://wa.me/918903952591"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 border border-primary text-primary text-xs font-heading uppercase tracking-wider px-5 py-2.5 hover:bg-primary/10 transition-colors"
            >
              WhatsApp
            </a>
            <a
              href="mailto:akbarzoozoo666@gmail.com"
              className="inline-flex items-center gap-2 border border-muted-foreground/30 text-muted-foreground text-xs font-heading uppercase tracking-wider px-5 py-2.5 hover:text-primary hover:border-primary transition-colors"
            >
              <Mail className="h-3.5 w-3.5" />
              மின்னஞ்சல்
            </a>
          </div>
        </section>

      </main>
      <Footer />
    </div>
  );
};

export default About;
