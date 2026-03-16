"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Camera,
  Zap,
  Check,
  ArrowRight,
  Lightbulb,
  User,
  Star,
  ChevronDown,
  ShieldCheck,
  Rocket,
  Crosshair,
} from "lucide-react";
import Link from "next/link";
import { motion, useInView } from "framer-motion";
import { useLanguage } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";

const SectionWrapper = ({
  children,
  delay = 0,
}: {
  children: React.ReactNode;
  delay?: number;
}) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
      transition={{ duration: 0.8, ease: "easeOut", delay }}
    >
      {children}
    </motion.div>
  );
};

const HowItWorksSection = ({ t, theme }: { t: (k: string) => string; theme: string }) => {
  const steps = [
    { num: "01", title: t("step2Title"), desc: t("step2Desc"), img: "/demo/step1.png" },
    { num: "02", title: t("step1Title"), desc: t("step1Desc"), img: "/demo/step2.png" },
    { num: "03", title: t("step3Title"), desc: t("step3Desc"), img: "/demo/step3.png" },
  ];

  return (
    <div
      id="how-it-works"
      className={`py-32 px-4 ${theme === "light" ? "bg-gray-50" : "bg-zinc-900"}`}
    >
      <div className="w-full">
        <div className="text-center mb-24">
          <h2
            className={`text-5xl md:text-6xl font-black mb-8 tracking-tighter ${theme === "light" ? "text-gray-900" : "text-white"}`}
          >
            {t("howItWorksSubtitle")}
          </h2>
        </div>
        <div className="grid md:grid-cols-3 gap-8 mb-20">
          {steps.map((step, i) => (
            <div
              key={i}
              className={`group relative rounded-[2.5rem] overflow-hidden ${theme === "light" ? "bg-white shadow-xl shadow-gray-200/50" : "bg-zinc-900 border border-white/10"} hover:-translate-y-2 transition-all duration-500`}
            >
              <div className="h-64 overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent z-10" />
                <img
                  src={step.img}
                  alt={step.title}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                />
                <div className="absolute top-6 left-6 w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center z-20 border border-white/20">
                  <span className="text-white font-black text-lg">{step.num}</span>
                </div>
              </div>
              <div className="p-8 relative">
                <h3
                  className={`text-2xl font-bold mb-4 ${theme === "light" ? "text-gray-900" : "text-white"} group-hover:text-[#0678e8] transition-colors`}
                >
                  {step.title}
                </h3>
                <p className={`${theme === "light" ? "text-gray-600" : "text-gray-400"} leading-relaxed`}>
                  {step.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
        <div className="text-center">
          <Link
            href="/create?start=true"
            className="inline-flex px-12 py-5 bg-[#0678e8] hover:bg-[#0560c5] text-white rounded-full font-bold text-xl hover:scale-105 transition-all shadow-xl shadow-[#0678e8]/30 items-center gap-3 group"
          >
            {t("getStartedFree") || "Start Free Trial"}
            <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </div>
    </div>
  );
};

const TestimonialsSection = ({
  t,
  theme,
}: {
  t: (k: string) => string;
  theme: string;
}) => {
  const reviews = [
    { name: t("test1Name"), role: t("test1Role"), quote: t("test1Quote"), text: t("test1Text") },
    { name: t("test2Name"), role: t("test2Role"), quote: t("test2Quote"), text: t("test2Text") },
    { name: t("test3Name"), role: t("test3Role"), quote: t("test3Quote"), text: t("test3Text") },
    { name: t("test4Name"), role: t("test4Role"), quote: t("test4Quote"), text: t("test4Text") },
  ];

  return (
    <div
      className={`py-32 px-4 ${theme === "light" ? "bg-white" : "bg-black"} relative overflow-hidden`}
    >
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -right-64 w-96 h-96 bg-[#0678e8]/10 rounded-full blur-3xl opacity-50" />
        <div className="absolute bottom-1/4 -left-64 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl opacity-50" />
      </div>
      <div className="w-full relative z-10">
        <div className="text-center mb-20">
          <h2
            className={`text-4xl md:text-6xl font-black mb-6 tracking-tighter ${theme === "light" ? "text-gray-900" : "text-white"}`}
          >
            {t("testimonialsTitle")}
          </h2>
          <p
            className={`text-xl max-w-2xl mx-auto ${theme === "light" ? "text-gray-600" : "text-gray-400"}`}
          >
            {t("testimonialsSubtitle")}
          </p>
        </div>
        <div className="grid md:grid-cols-2 gap-8">
          {reviews.map((review, i) => (
            <div
              key={i}
              className={`p-8 md:p-12 rounded-[2.5rem] ${theme === "light" ? "bg-white shadow-xl shadow-gray-200/50" : "bg-zinc-900 border border-white/10"} hover:-translate-y-2 transition-all duration-300 group`}
            >
              <div className="flex items-center gap-6 mb-8">
                <div
                  className={`w-16 h-16 md:w-20 md:h-20 rounded-full overflow-hidden border-2 border-white/20 shadow-lg flex items-center justify-center ${theme === "light" ? "bg-gray-100" : "bg-zinc-800"}`}
                >
                  <User
                    className={`w-8 h-8 ${theme === "light" ? "text-gray-400" : "text-gray-500"}`}
                  />
                </div>
                <div>
                  <h4
                    className={`text-xl font-bold ${theme === "light" ? "text-gray-900" : "text-white"}`}
                  >
                    {review.name}
                  </h4>
                  <div className="flex gap-1 my-1.5">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star key={s} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                  <p className="text-sm font-medium uppercase tracking-wider text-[#0678e8]">
                    {review.role}
                  </p>
                </div>
              </div>
              <h3
                className={`text-2xl md:text-3xl font-black mb-6 leading-tight ${theme === "light" ? "text-gray-800" : "text-gray-100"}`}
              >
                &quot;{review.quote}&quot;
              </h3>
              <p
                className={`text-lg leading-relaxed ${theme === "light" ? "text-gray-600" : "text-gray-400"}`}
              >
                {review.text}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const FAQSection = ({ t, theme }: { t: (k: string) => string; theme: string }) => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const toggle = (i: number) => setOpenIndex(openIndex === i ? null : i);
  const leftCol = [1, 3, 5, 7, 9];
  const rightCol = [2, 4, 6, 8];

  const renderItem = (num: number) => {
    const isOpen = openIndex === num;
    return (
      <div
        key={num}
        className={`mb-4 w-full rounded-2xl transition-all duration-300 ${theme === "light" ? "bg-gray-50 hover:bg-gray-100" : "bg-white/5 hover:bg-white/10"} border border-transparent ${isOpen ? (theme === "light" ? "border-gray-200 bg-white shadow-lg" : "border-white/10 bg-white/5 shadow-black/50") : ""}`}
      >
        <button
          onClick={() => toggle(num)}
          className="w-full text-left p-6 flex justify-between items-start gap-4"
        >
          <span className={`font-bold text-lg ${theme === "light" ? "text-gray-900" : "text-white"}`}>
            {t(`faqQ${num}`)}
          </span>
          <div
            className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-transform duration-300 ${isOpen ? "rotate-180 bg-[#0678e8]" : theme === "light" ? "bg-gray-200" : "bg-white/10"}`}
          >
            <ChevronDown
              className={`w-5 h-5 ${isOpen ? "text-white" : theme === "light" ? "text-gray-600" : "text-gray-300"}`}
            />
          </div>
        </button>
        <div
          className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? "max-h-[500px] opacity-100 pb-6" : "max-h-0 opacity-0"}`}
        >
          <div
            className={`px-6 text-base leading-relaxed ${theme === "light" ? "text-gray-600" : "text-gray-400"}`}
          >
            {t(`faqA${num}`)}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`py-32 px-4 ${theme === "light" ? "bg-gray-50" : "bg-zinc-900"}`}>
      <div className="w-full">
        <div className="text-center mb-16">
          <h2
            className={`text-4xl md:text-5xl font-black mb-6 tracking-tighter ${theme === "light" ? "text-gray-900" : "text-white"}`}
          >
            {t("faqTitle")}
          </h2>
          <p
            className={`text-lg md:text-xl max-w-2xl mx-auto ${theme === "light" ? "text-gray-600" : "text-gray-400"}`}
          >
            {t("faqSubtitle")}
          </p>
        </div>
        <div className="flex flex-col md:flex-row gap-4 md:gap-8 items-start">
          <div className="w-full md:w-1/2">{leftCol.map(renderItem)}</div>
          <div className="w-full md:w-1/2">{rightCol.map(renderItem)}</div>
        </div>
      </div>
    </div>
  );
};

const LandingPage: React.FC = () => {
  const { t } = useLanguage();
  const { theme } = useTheme();

  return (
    <div
      className={`min-h-screen transition-colors duration-300 ${theme === "light" ? "bg-white" : "bg-[#0a0a0a]"}`}
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
        className={`relative min-h-screen h-screen flex flex-col overflow-hidden ${theme === "light" ? "bg-[#f0efeb]" : "bg-[#0a0a12]"}`}
      >
        <div className="absolute inset-0">
          <img
            src="/demo/hero-car.png"
            onError={(e) => {
              (e.target as HTMLImageElement).src = "/demo/exterior-after.png";
            }}
            alt="Carveo AI Studio"
            className="w-full h-full object-cover hero-car-img"
          />
          <div
            className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none"
            style={{
              background: `linear-gradient(to top, ${theme === "light" ? "#f9fafb" : "#0a0a12"} 0%, transparent 100%)`,
            }}
          />
        </div>

        <div
          className="absolute top-0 left-0 right-0 h-[75%] pointer-events-none"
          style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, transparent 100%)" }}
        />

        <div className="relative z-10 flex flex-col items-center text-center pt-20 sm:pt-32 px-4 gap-4 sm:gap-6">
          <h1 className="text-3xl sm:text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter leading-none text-white drop-shadow-2xl">
            {(() => {
              const title = t("heroTitle").split(".")[0];
              const parts = title.split("#1");
              return parts.length === 2 ? (
                <>
                  {parts[0]}
                  <span
                    style={{
                      color: "#0678e8",
                      textShadow: "0 0 40px rgba(91,110,245,0.8)",
                    }}
                  >
                    #1
                  </span>
                  {parts[1]}
                  <span style={{ color: "#0678e8" }}>.</span>
                </>
              ) : (
                <>
                  {title}
                  <span style={{ color: "#0678e8" }}>.</span>
                </>
              );
            })()}
          </h1>
        </div>

        <div className="absolute bottom-8 sm:bottom-20 left-0 right-0 z-10 flex flex-col items-center gap-3 sm:gap-4 px-4">
          <Link
            href="/create?start=true"
            className="px-6 sm:px-10 py-3 sm:py-4 text-white font-bold text-base sm:text-lg rounded-full flex items-center gap-2 group transition-all hover:scale-105 active:scale-95 shadow-2xl"
            style={{
              background: "linear-gradient(135deg, #0678e8 0%, #0560c5 100%)",
              boxShadow: "0 0 30px rgba(91,110,245,0.5)",
            }}
          >
            {t("getStartedFree")}
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4">
            <div className="flex items-center gap-1.5" style={{ color: "rgba(255,255,255,0.85)" }}>
              <span className="text-yellow-400 text-xs sm:text-sm">★★★★★</span>
              <span className="text-xs sm:text-sm font-semibold">4.9/5</span>
              <span className="text-[10px] sm:text-xs opacity-70">von 200+ Händlern</span>
            </div>
            <div className="hidden sm:block w-px h-4 bg-white/20" />
            <div className="flex items-center gap-1.5" style={{ color: "rgba(255,255,255,0.85)" }}>
              <span className="text-[#0678e8] text-xs sm:text-sm">✓</span>
              <span className="text-[10px] sm:text-xs opacity-70">
                Kostenlos starten — keine Kreditkarte
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      <SectionWrapper>
        <HowItWorksSection t={t} theme={theme} />
      </SectionWrapper>
      <SectionWrapper>
        <TestimonialsSection t={t} theme={theme} />
      </SectionWrapper>
      <SectionWrapper>
        <FAQSection t={t} theme={theme} />
      </SectionWrapper>

      <SectionWrapper>
        <div
          className={`py-24 px-4 border-t ${theme === "light" ? "bg-white border-gray-200" : "bg-black border-white/10"}`}
        >
          <div className="w-full">
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-12">
              {[
                {
                  icon: ShieldCheck,
                  title: "contactBadge1Title",
                  sub: "contactBadge1Sub",
                  desc: "contactBadge1Desc",
                },
                {
                  icon: Rocket,
                  title: "contactBadge2Title",
                  sub: "contactBadge2Sub",
                  desc: "contactBadge2Desc",
                },
                {
                  icon: Zap,
                  title: "contactBadge3Title",
                  sub: "contactBadge3Sub",
                  desc: "contactBadge3Desc",
                },
                {
                  icon: Crosshair,
                  title: "contactBadge4Title",
                  sub: "contactBadge4Sub",
                  desc: "contactBadge4Desc",
                },
              ].map((badge, i) => (
                <div key={i} className="flex flex-col items-center text-center gap-4">
                  <div
                    className={`w-16 h-16 rounded-2xl flex items-center justify-center ${theme === "light" ? "bg-blue-100 text-[#0678e8]" : "bg-[#0678e8]/10 text-[#0678e8]"}`}
                  >
                    <badge.icon className="w-8 h-8" />
                  </div>
                  <div>
                    <h4
                      className={`font-bold text-xl mb-1 leading-tight ${theme === "light" ? "text-gray-900" : "text-white"}`}
                    >
                      {t(badge.title)}
                    </h4>
                    <p
                      className={`text-xs font-bold uppercase tracking-wider mb-2 ${theme === "light" ? "text-[#0678e8]" : "text-[#0678e8]"}`}
                    >
                      {t(badge.sub)}
                    </p>
                    <p
                      className={`text-sm leading-relaxed ${theme === "light" ? "text-gray-600" : "text-gray-400"} max-w-[250px] mx-auto`}
                    >
                      {t(badge.desc)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </SectionWrapper>
    </div>
  );
};

export default LandingPage;
