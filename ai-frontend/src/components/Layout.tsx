"use client";

import React from "react";
import Link from "next/link";
import Navbar from "./Navbar";
import { useTheme } from "@/context/ThemeContext";
import { useLanguage } from "@/context/LanguageContext";

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const isDark = theme === "dark";

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] transition-colors duration-300 font-sans selection:bg-blue-500/30 flex flex-col">
      <Navbar />
      <main className="pt-16 flex-1 flex flex-col relative z-0">
        {children}
      </main>

      <footer
        className={`border-t ${isDark ? "bg-zinc-950 border-white/10" : "bg-gray-50 border-gray-200"}`}
      >
        <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p
            className={`text-sm ${isDark ? "text-gray-500" : "text-gray-400"}`}
          >
            © {new Date().getFullYear()} Carveo.{" "}
            {language === "de" ? "Alle Rechte vorbehalten." : "All rights reserved."}
          </p>
          <div className="flex items-center gap-6">
            <Link
              href="/privacy"
              className={`text-sm font-medium hover:underline transition-colors ${isDark ? "text-gray-400 hover:text-white" : "text-gray-500 hover:text-gray-900"}`}
            >
              {language === "de" ? "Datenschutz" : "Privacy Policy"}
            </Link>
            <Link
              href="/contact"
              className={`text-sm font-medium hover:underline transition-colors ${isDark ? "text-gray-400 hover:text-white" : "text-gray-500 hover:text-gray-900"}`}
            >
              {language === "de" ? "Kontakt" : "Contact"}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
