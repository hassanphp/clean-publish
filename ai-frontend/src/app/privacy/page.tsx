"use client";

import React from "react";
import Layout from "@/components/Layout";
import { useTheme } from "@/context/ThemeContext";
import { useLanguage } from "@/context/LanguageContext";
import { ShieldCheck } from "lucide-react";

const Section = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <div className="mb-10">
    <h2 className="text-xl font-bold mb-4">{title}</h2>
    <div className="space-y-3 leading-relaxed">{children}</div>
  </div>
);

export default function PrivacyPage() {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const isDark = theme === "dark";
  const isDE = language === "de";

  return (
    <Layout>
      <div
        className={`min-h-screen px-4 py-16 md:py-24 ${isDark ? "bg-black text-white" : "bg-white text-gray-900"}`}
      >
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-4 mb-12">
            <div
              className={`w-14 h-14 rounded-2xl flex items-center justify-center ${isDark ? "bg-blue-500/20 text-blue-400" : "bg-blue-50 text-blue-600"}`}
            >
              <ShieldCheck className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-black tracking-tight">
                {isDE ? "Datenschutzerklärung" : "Privacy Policy"}
              </h1>
              <p className={`text-sm mt-1 ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                {isDE ? "Zuletzt aktualisiert: 25. Februar 2026" : "Last updated: February 25, 2026"}
              </p>
            </div>
          </div>

          <div className={`prose prose-lg max-w-none ${isDark ? "prose-invert" : ""}`}>
            {isDE ? (
              <>
                <Section title="1. Verantwortlicher">
                  <p>Verantwortlich für die Datenverarbeitung ist:</p>
                  <p>
                    <strong>Carveo</strong>
                    <br />
                    E-Mail: datenschutz@carveo.app
                  </p>
                </Section>
                <Section title="2. Welche Daten wir erheben">
                  <p>Wir erheben und verarbeiten folgende personenbezogene Daten:</p>
                  <ul>
                    <li>
                      <strong>Kontodaten:</strong> E-Mail-Adresse, Benutzername bei der Registrierung
                    </li>
                    <li>
                      <strong>Nutzungsdaten:</strong> Geräteinformationen, IP-Adresse, Zeitstempel
                    </li>
                    <li>
                      <strong>Fahrzeugdaten:</strong> VIN/FIN, Fahrzeugfotos die Sie hochladen
                    </li>
                    <li>
                      <strong>Zahlungsdaten:</strong> Werden über Stripe verarbeitet — wir speichern
                      keine Kreditkartendaten
                    </li>
                  </ul>
                </Section>
                <Section title="3. Zweck der Datenverarbeitung">
                  <ul>
                    <li>Bereitstellung und Verbesserung unseres Dienstes</li>
                    <li>Verarbeitung von Fahrzeugfotos mittels KI</li>
                    <li>Verwaltung Ihres Kontos und Ihrer Credit-Guthaben</li>
                    <li>Abwicklung von Zahlungen über Stripe</li>
                  </ul>
                </Section>
                <Section title="4. Externe Dienste und Drittanbieter">
                  <ul>
                    <li>
                      <strong>NextAuth / PostgreSQL:</strong> Authentifizierung und Datenspeicherung
                    </li>
                    <li>
                      <strong>Stripe:</strong> Zahlungsabwicklung —{" "}
                      <a
                        href="https://stripe.com/privacy"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:underline"
                      >
                        Datenschutzerklärung von Stripe
                      </a>
                    </li>
                  </ul>
                </Section>
                <Section title="5. Ihre Rechte (DSGVO)">
                  <p>Sie haben Auskunft, Berichtigung, Löschung, Datenübertragbarkeit und Widerspruch.</p>
                  <p>
                    Kontaktieren Sie uns unter <strong>datenschutz@carveo.app</strong>
                  </p>
                </Section>
              </>
            ) : (
              <>
                <Section title="1. Data Controller">
                  <p>Responsible for data processing:</p>
                  <p>
                    <strong>Carveo</strong>
                    <br />
                    Email: privacy@carveo.app
                  </p>
                </Section>
                <Section title="2. Data We Collect">
                  <p>We collect and process the following personal data:</p>
                  <ul>
                    <li>
                      <strong>Account data:</strong> Email address, username upon registration
                    </li>
                    <li>
                      <strong>Usage data:</strong> Device information, IP address, access timestamps
                    </li>
                    <li>
                      <strong>Vehicle data:</strong> VIN, vehicle photos you upload
                    </li>
                    <li>
                      <strong>Payment data:</strong> Processed through Stripe — we do not store credit
                      card information
                    </li>
                  </ul>
                </Section>
                <Section title="3. Purpose of Data Processing">
                  <ul>
                    <li>Providing and improving our service</li>
                    <li>Processing vehicle photos using AI</li>
                    <li>Managing your account and credit balance</li>
                    <li>Payment processing via Stripe</li>
                  </ul>
                </Section>
                <Section title="4. Third-Party Services">
                  <ul>
                    <li>
                      <strong>NextAuth / PostgreSQL:</strong> Authentication and data storage
                    </li>
                    <li>
                      <strong>Stripe:</strong> Payment processing —{" "}
                      <a
                        href="https://stripe.com/privacy"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:underline"
                      >
                        Stripe&apos;s Privacy Policy
                      </a>
                    </li>
                  </ul>
                </Section>
                <Section title="5. Your Rights (GDPR)">
                  <p>You have access, rectification, erasure, data portability, and objection rights.</p>
                  <p>
                    Contact us at <strong>privacy@carveo.app</strong>
                  </p>
                </Section>
              </>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
