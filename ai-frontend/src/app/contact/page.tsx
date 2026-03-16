"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import Layout from "@/components/Layout";
import { useLanguage } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";

export default function ContactPage() {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const [stockLevel, setStockLevel] = useState("251+");

  const steps = [
    { num: "1", title: "contactStep1Title", desc: "contactStep1Desc" },
    { num: "2", title: "contactStep2Title", desc: "contactStep2Desc" },
    { num: "3", title: "contactStep3Title", desc: "contactStep3Desc" },
  ];

  const features = [
    "contactIncluded1",
    "contactIncluded2",
    "contactIncluded3",
    "contactIncluded4",
    "contactIncluded5",
  ];

  const inputClass = `w-full px-6 py-4 rounded-2xl border transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${theme === "light" ? "bg-gray-50 border-gray-200 text-gray-900 focus:bg-white" : "bg-zinc-800/50 border-white/10 text-white focus:bg-zinc-800"}`;

  return (
    <Layout>
      <div
        className={`min-h-screen flex flex-col transition-colors duration-300 ${theme === "light" ? "bg-white text-gray-900" : "bg-zinc-900 text-white"}`}
      >
        <div className="flex-grow flex flex-col justify-center pt-32 pb-20 px-4">
          <div className="w-full">
            <div className="text-center mb-20 max-w-5xl mx-auto">
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-5xl md:text-7xl font-black mb-8 tracking-tighter"
              >
                {t("contactTitle")}
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className={`text-xl md:text-2xl leading-relaxed ${theme === "light" ? "text-gray-600" : "text-gray-400"}`}
              >
                {t("contactSubtitle")}
              </motion.p>
            </div>

            <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-start max-w-6xl mx-auto">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
              >
                <h3 className="text-3xl font-bold mb-10">{t("contactNextStepsTitle")}</h3>
                <div className="space-y-10 mb-16">
                  {steps.map((step, i) => (
                    <div key={i} className="flex gap-6">
                      <div
                        className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold ${theme === "light" ? "bg-gray-100 text-gray-900" : "bg-white/10 text-white"}`}
                      >
                        {step.num}
                      </div>
                      <div>
                        <h4 className="text-xl font-bold mb-2">{t(step.title)}</h4>
                        <p className={theme === "light" ? "text-gray-600" : "text-gray-400"}>
                          {t(step.desc)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                <div
                  className={`p-8 rounded-3xl border ${theme === "light" ? "bg-gray-50 border-gray-200" : "bg-[#0a0a0a] border-white/10"}`}
                >
                  <h4 className="text-xl font-bold mb-6">{t("contactIncludedTitle")}</h4>
                  <ul className="grid md:grid-cols-2 gap-4">
                    {features.map((key, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <span className="text-blue-500 font-bold">✓</span>
                        <span>{t(key)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
                className={`p-8 md:p-10 rounded-[2.5rem] shadow-2xl ${theme === "light" ? "bg-white border border-gray-100" : "bg-zinc-900 border border-white/10"}`}
              >
                <h3 className={`text-3xl font-bold mb-8 text-center ${theme === "light" ? "text-gray-900" : "text-white"}`}>
                  {t("contactFormTitle")}
                </h3>
                <form className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <input
                      type="text"
                      placeholder={t("contactFormFirstName")}
                      className={inputClass}
                    />
                    <input
                      type="text"
                      placeholder={t("contactFormLastName")}
                      className={inputClass}
                    />
                  </div>
                  <input type="email" placeholder={t("contactFormEmail")} className={inputClass} />
                  <input type="text" placeholder={t("contactFormCompany")} className={inputClass} />
                  <div className="pt-2">
                    <label className="block text-sm font-bold text-gray-500 mb-3 uppercase tracking-wider">
                      {t("contactFormStock")}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {["251+", "101-250", "61-100", "31-60", "0-30"].map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setStockLevel(opt)}
                          className={`px-4 py-2 rounded-full text-xs font-bold transition-all border ${stockLevel === opt ? "bg-blue-600 text-white border-blue-600" : theme === "light" ? "bg-white text-gray-600 border-gray-200 hover:border-gray-400" : "bg-zinc-800 text-gray-300 border-white/10 hover:bg-zinc-700"}`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="w-full py-5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xl rounded-2xl shadow-xl shadow-blue-500/20 transition-all mt-4"
                  >
                    {t("contactFormButton")}
                  </button>
                </form>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
