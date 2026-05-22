import { Link } from "react-router-dom";
import { Shield } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 container py-12 max-w-3xl">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2 rounded-lg bg-primary/10">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="font-heading text-2xl uppercase tracking-wide">Privacy Policy</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Last updated: April 3, 2026</p>
          </div>
        </div>

        <div className="prose prose-sm dark:prose-invert max-w-none space-y-6 text-sm leading-relaxed text-muted-foreground">

          <section>
            <h2 className="font-heading text-base uppercase tracking-wide text-foreground mb-2">1. Who We Are</h2>
            <p>
              Trichy Insight (<strong>trichyinsight.online</strong>) is a Tamil-language hyper-local digital news portal
              serving the Tiruchirappalli region of Tamil Nadu, India. We are committed to protecting your personal
              information and your right to privacy. If you have questions, contact us at{" "}
              <a href="mailto:contact@trichyinsight.com" className="text-primary hover:underline">
                contact@trichyinsight.com
              </a>.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-base uppercase tracking-wide text-foreground mb-2">2. Information We Collect</h2>
            <p>We collect information you provide directly to us and information collected automatically:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li><strong>Usage Data:</strong> Pages visited, time spent, browser type, IP address, and referring URLs — collected automatically via server logs.</li>
              <li><strong>Device Data:</strong> Browser type, operating system, and device identifiers.</li>
              <li><strong>Contact Information:</strong> Email address or phone number if you contact us directly.</li>
              <li><strong>Cookies:</strong> We use cookies and similar tracking technologies to improve your browsing experience. See Section 5.</li>
            </ul>
            <p className="mt-2">We do <strong>not</strong> sell your personal information to third parties.</p>
          </section>

          <section>
            <h2 className="font-heading text-base uppercase tracking-wide text-foreground mb-2">3. How We Use Your Information</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>To provide, operate, and improve our news platform.</li>
              <li>To understand how readers interact with our content.</li>
              <li>To send updates or newsletters if you have opted in.</li>
              <li>To comply with legal obligations.</li>
              <li>To detect and prevent fraudulent or abusive activity.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-heading text-base uppercase tracking-wide text-foreground mb-2">4. Sharing Your Information</h2>
            <p>We may share information with:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li><strong>Service Providers:</strong> Hosting, analytics, and infrastructure providers (e.g., Supabase, Cloudflare) who process data on our behalf.</li>
              <li><strong>Social Platforms:</strong> If you interact with our content on Instagram, YouTube, or Facebook, those platforms' privacy policies apply.</li>
              <li><strong>Legal Requirements:</strong> When required by law, court order, or governmental authority.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-heading text-base uppercase tracking-wide text-foreground mb-2">5. Cookies</h2>
            <p>
              We use essential cookies to operate the website and analytics cookies to understand traffic. You can
              control cookies through your browser settings. Disabling cookies may affect site functionality.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-base uppercase tracking-wide text-foreground mb-2">6. Third-Party Links</h2>
            <p>
              Our site contains links to external websites (YouTube, Instagram, Facebook, WhatsApp). We are not
              responsible for the privacy practices of those sites. We encourage you to read their privacy policies.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-base uppercase tracking-wide text-foreground mb-2">7. Data Retention</h2>
            <p>
              We retain personal data only as long as necessary to fulfil the purposes described in this policy or
              as required by applicable law.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-base uppercase tracking-wide text-foreground mb-2">8. Children's Privacy</h2>
            <p>
              Our services are not directed at children under the age of 13. We do not knowingly collect personal
              information from children. If you believe we have collected information from a child, please contact us.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-base uppercase tracking-wide text-foreground mb-2">9. Your Rights</h2>
            <p>Depending on your location, you may have the right to:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Access the personal data we hold about you.</li>
              <li>Request correction or deletion of your data.</li>
              <li>Object to or restrict how we process your data.</li>
              <li>Withdraw consent at any time (where processing is based on consent).</li>
            </ul>
            <p className="mt-2">
              To exercise these rights, email us at{" "}
              <a href="mailto:contact@trichyinsight.com" className="text-primary hover:underline">
                contact@trichyinsight.com
              </a>.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-base uppercase tracking-wide text-foreground mb-2">10. Security</h2>
            <p>
              We implement appropriate technical and organisational measures to protect your information. However,
              no method of transmission over the internet is 100% secure.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-base uppercase tracking-wide text-foreground mb-2">11. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. The updated version will be indicated by a revised
              "Last updated" date at the top of this page. Your continued use of the site after changes constitutes
              acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-base uppercase tracking-wide text-foreground mb-2">12. Contact Us</h2>
            <p>If you have questions or concerns about this Privacy Policy, please contact:</p>
            <div className="mt-2 p-4 border border-border rounded-lg space-y-1">
              <p className="font-medium text-foreground">Trichy Insight</p>
              <p>Tiruchirappalli, Tamil Nadu, India</p>
              <p>
                Email:{" "}
                <a href="mailto:contact@trichyinsight.com" className="text-primary hover:underline">
                  contact@trichyinsight.com
                </a>
              </p>
              <p>
                Phone:{" "}
                <a href="tel:+918903952591" className="text-primary hover:underline">
                  +91 89039 52591
                </a>
              </p>
            </div>
          </section>
        </div>

        <div className="mt-10 pt-6 border-t border-border">
          <Link to="/" className="text-sm text-primary hover:underline">← முகப்புக்கு திரும்பு (Back to Home)</Link>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default PrivacyPolicy;
