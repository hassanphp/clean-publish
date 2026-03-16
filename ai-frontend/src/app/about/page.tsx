"use client";

import React from "react";
import { motion } from "framer-motion";
import Layout from "@/components/Layout";
import { useLanguage } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";

export default function AboutPage() {
  const { t } = useLanguage();
  const { theme } = useTheme();

  const bg1 = theme === "light" ? "bg-white" : "bg-black";
  const bg2 = theme === "light" ? "bg-gray-50" : "bg-zinc-900";
  const text1 = theme === "light" ? "text-gray-900" : "text-white";
  const text2 = theme === "light" ? "text-gray-600" : "text-gray-400";

  return (
    <Layout>
      <div className={`min-h-screen transition-colors duration-300 ${bg1}`}>
        <div className={`min-h-screen flex flex-col justify-center pt-32 pb-20 px-4 ${bg1} text-center`}>
          <div className="w-full">
            <div className="mb-24 max-w-4xl mx-auto">
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`text-5xl md:text-7xl font-black mb-8 tracking-tighter ${text1}`}
              >
                {t("aboutTitle").replace("Carveo", "")} <span className="text-blue-600">Carveo</span>.
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className={`text-xl md:text-2xl leading-relaxed ${text2}`}
              >
                {t("aboutSubtitle")}
              </motion.p>
            </div>
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="grid md:grid-cols-3 gap-8 text-center"
            >
              {[
                { text: t("aboutMetric1"), delay: 0 },
                { text: t("aboutMetric2"), delay: 0.1 },
                { text: t("aboutMetric3"), delay: 0.2 },
              ].map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ scale: 0.9, opacity: 0 }}
                  whileInView={{ scale: 1, opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: item.delay }}
                  className="p-8"
                >
                  <h3
                    className={`text-4xl md:text-5xl font-black mb-2 tracking-tight whitespace-pre-line leading-tight ${text1}`}
                  >
                    {item.text}
                  </h3>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div>

        <div className={`py-32 px-4 ${bg2}`}>
          <div className="w-full grid lg:grid-cols-12 gap-12">
            <div className="lg:col-span-5">
              <motion.h2
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className={`text-4xl md:text-6xl font-black tracking-tighter sticky top-32 ${text1}`}
              >
                {t("aboutSpecialTitle")}
              </motion.h2>
            </div>
            <div className="lg:col-span-7 space-y-20">
              {[
                { title: "aboutSpecialTeam", text: "aboutSpecialTeamText" },
                { title: "aboutSpecialCulture", text: "aboutSpecialCultureText" },
              ].map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.2 }}
                >
                  <h3 className={`text-3xl font-bold mb-6 ${text1}`}>{t(item.title)}</h3>
                  <p className={`text-xl leading-relaxed ${text2}`}>{t(item.text)}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        <div className={`py-32 px-4 ${bg1}`}>
          <div className="max-w-7xl mx-auto">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <h2 className={`text-4xl md:text-6xl font-black mb-6 tracking-tighter ${text1}`}>
                {t("aboutValuesTitle")}
              </h2>
              <p className={`text-xl ${text2}`}>{t("aboutValuesSubtitle")}</p>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              {[
                { title: "aboutValInnovation", text: "aboutValInnovationText" },
                { title: "aboutValSustainability", text: "aboutValSustainabilityText" },
                { title: "aboutValTeamwork", text: "aboutValTeamworkText" },
                { title: "aboutValIntegrity", text: "aboutValIntegrityText" },
              ].map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.95 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="bg-blue-600 p-10 md:p-12 rounded-[2.5rem] text-white shadow-xl hover:scale-[1.02] transition-transform duration-300"
                >
                  <h3 className="text-3xl font-bold mb-6">{t(item.title)}</h3>
                  <p className="text-lg leading-relaxed text-blue-50">{t(item.text)}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
