"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Camera,
  Sun,
  Moon,
  LogOut,
  User,
  Menu,
  X,
  Globe,
  CreditCard,
  LayoutDashboard,
  Settings,
  Building2,
} from "lucide-react";
import { useGetMeQuery } from "@/lib/store/apiSlice";
import { useCredits } from "@/context/CreditsContext";
import { useTheme } from "@/context/ThemeContext";
import { useLanguage } from "@/context/LanguageContext";
import AuthModal from "./AuthModal";
import SettingsModal from "./SettingsModal";
import { motion, AnimatePresence } from "framer-motion";
import { logoutAction } from "@/app/actions/auth";

const Navbar: React.FC = () => {
  const { data: user, isLoading } = useGetMeQuery(undefined, {
    skip: typeof window === "undefined",
  });
  const { totalCredits } = useCredits();
  const { theme, toggleTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [isLangOpen, setIsLangOpen] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [cameraMode, setCameraMode] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleSignOut = async () => {
    setIsUserMenuOpen(false);
    await logoutAction();
    router.refresh();
  };

  useEffect(() => {
    if (!isUserMenuOpen) return;
    const handler = () => setIsUserMenuOpen(false);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [isUserMenuOpen]);

  useEffect(() => {
    if (searchParams.get("auth") === "1") {
      setShowAuthModal(true);
    }
  }, [searchParams]);

  useEffect(() => {
    if (user && showAuthModal) {
      setShowAuthModal(false);
      const next = searchParams.get("next");
      router.push(next || "/create?view=dashboard");
    }
  }, [user, showAuthModal, searchParams, router]);

  useEffect(() => {
    const check = () => setCameraMode(document.body.hasAttribute("data-camera-mode"));
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.body, { attributes: true, attributeFilter: ["data-camera-mode"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const link: HTMLLinkElement =
      document.querySelector('link[rel="icon"]') || document.createElement("link");
    link.rel = "icon";
    link.type = "image/png";
    link.href = theme === "dark" ? "/logo/logo_dark.png" : "/logo/logo.png";
    document.head.appendChild(link);
  }, [theme]);

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash) {
      setTimeout(() => {
        const id = window.location.hash.replace("#", "");
        const element = document.getElementById(id);
        if (element) {
          element.scrollIntoView({ behavior: "auto", block: "start" });
        }
      }, 0);
    }
  }, [pathname]);

  const isActive = (path: string) => pathname === path;

  const handleHowItWorksClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (pathname === "/") {
      e.preventDefault();
      const element = document.getElementById("how-it-works");
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  };

  const navLinks = [
    { name: t("home"), path: "/" },
    { name: t("aboutUs"), path: "/about" },
    { name: t("howItWorks"), path: "/#how-it-works", onClick: handleHowItWorksClick },
    { name: "Preise", path: "/pricing" },
    { name: t("contact"), path: "/contact" },
  ];

  const languages = [
    { code: "en" as const, name: "English", flag: "🇺🇸" },
    { code: "de" as const, name: "Deutsch", flag: "🇩🇪" },
  ];

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-50 border-b border-[var(--border)] transition-all duration-300 ${theme === "dark" ? "bg-black" : "bg-white"} ${cameraMode ? "opacity-0 pointer-events-none -translate-y-full" : "opacity-100 translate-y-0"}`}
      >
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="relative flex items-center justify-between h-20">
            <Link href="/" className="flex items-center">
              <img
                src={theme === "dark" ? "/logo/logo_dark.png" : "/logo/logo.png"}
                alt="Carveo"
                className="h-16 w-auto"
              />
            </Link>

            <div className="hidden md:flex absolute left-1/2 -translate-x-1/2 items-center gap-11">
              {navLinks.map((link) => {
                const hasHash = link.path.includes("#");
                const isLinkActive = !hasHash && isActive(link.path);
                return (
                  <Link
                    key={link.name}
                    href={link.path}
                    onClick={(link as { onClick?: (e: React.MouseEvent) => void }).onClick}
                    className={`text-base font-semibold transition-colors hover:text-blue-500 ${isLinkActive ? "text-blue-500" : "opacity-70"}`}
                  >
                    {link.name}
                  </Link>
                );
              })}
            </div>

            <div className="hidden md:flex items-center justify-end gap-3">
              <button
                onClick={toggleTheme}
                className="p-2.5 rounded-lg hover:bg-gray-500/10 transition-colors"
                title={theme === "dark" ? t("lightMode") : t("darkMode")}
              >
                {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>

              <div className="relative">
                <button
                  onClick={() => setIsLangOpen(!isLangOpen)}
                  className="flex items-center gap-2 p-2.5 rounded-lg hover:bg-gray-500/10 transition-colors"
                >
                  <Globe className="w-5 h-5" />
                  <span className="text-base uppercase font-bold">{language}</span>
                </button>
                <AnimatePresence>
                  {isLangOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute right-0 mt-2 w-40 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-2xl py-2 z-50"
                    >
                      {languages.map((lang) => (
                        <button
                          key={lang.code}
                          onClick={() => {
                            setLanguage(lang.code);
                            setIsLangOpen(false);
                          }}
                          className={`flex items-center gap-3 w-full px-4 py-2.5 text-base text-left hover:bg-blue-500/10 transition-colors ${language === lang.code ? "text-blue-500 font-bold" : ""}`}
                        >
                          <span>{lang.flag}</span>
                          {lang.name}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="h-6 w-px bg-[var(--border)] mx-2" />

              {!isLoading && user ? (
                <>
                  <Link href="/create?view=dashboard">
                    <button className="flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors hover:text-blue-500">
                      <LayoutDashboard className="w-6 h-6" />
                      {t("dashboard")}
                    </button>
                  </Link>
                  <Link href="/pricing">
                    <button className="flex items-center gap-2 px-5 py-2.5 bg-blue-500/10 rounded-full border border-blue-500/20 hover:bg-blue-500/20 transition-colors cursor-pointer">
                      <CreditCard className="w-5 h-5 text-blue-500" />
                      <span className="text-base font-bold text-blue-500">{totalCredits}</span>
                    </button>
                  </Link>
                  <div className="h-6 w-px bg-[var(--border)] mx-2" />
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsUserMenuOpen((v) => !v);
                      }}
                      className="p-2.5 rounded-full hover:bg-gray-500/10 transition-colors"
                    >
                      <User className="w-5 h-5" />
                    </button>
                    <AnimatePresence>
                      {isUserMenuOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: 8, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 8, scale: 0.95 }}
                          transition={{ duration: 0.15 }}
                          onClick={(e) => e.stopPropagation()}
                          className="absolute right-0 mt-2 w-48 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-2xl py-2 z-50"
                        >
                          <button
                            onClick={() => {
                              setIsUserMenuOpen(false);
                              setShowSettings(true);
                            }}
                            className="flex items-center gap-2 w-full text-left px-4 py-2.5 text-base hover:bg-gray-500/10 transition-colors"
                          >
                            <Settings className="w-4 h-4" />
                            {t("settings")}
                          </button>
                          <Link
                            href="/dealer/settings"
                            onClick={() => setIsUserMenuOpen(false)}
                            className="flex items-center gap-2 w-full text-left px-4 py-2.5 text-base hover:bg-gray-500/10 transition-colors"
                          >
                            <Building2 className="w-4 h-4" />
                            Dealer Settings
                          </Link>
                          <div className="border-t border-[var(--border)] my-1" />
                          <button
                            onClick={handleSignOut}
                            className="flex items-center gap-2 w-full text-left px-4 py-2.5 text-base hover:text-red-500 hover:bg-red-500/10 transition-colors"
                          >
                            <LogOut className="w-4 h-4" />
                            {t("signOut")}
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </>
              ) : (
                <button
                  onClick={() => setShowAuthModal(true)}
                  className="flex items-center gap-2 px-6 py-3 text-base font-bold text-white bg-blue-600 rounded-full hover:bg-blue-700 transition-all hover:scale-105 active:scale-95 shadow-lg shadow-blue-500/20"
                >
                  <User className="w-4 h-4" />
                  {t("login")}
                </button>
              )}
            </div>

            <div className="md:hidden flex items-center gap-2">
              <button
                onClick={toggleTheme}
                className="p-2.5 rounded-lg hover:bg-gray-500/10 transition-colors"
              >
                {theme === "dark" ? <Sun className="w-6 h-6" /> : <Moon className="w-6 h-6" />}
              </button>
              <button
                onClick={() => setIsOpen(!isOpen)}
                className="p-2.5 transition-colors overflow-hidden"
              >
                {isOpen ? <X className="w-7 h-7" /> : <Menu className="w-7 h-7" />}
              </button>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden bg-[var(--card)] border-b border-[var(--border)] overflow-hidden"
            >
              <div className="px-4 pt-2 pb-6 space-y-2">
                {navLinks.map((link) => {
                  const hasHash = link.path.includes("#");
                  const isLinkActive = !hasHash && isActive(link.path);
                  return (
                    <Link
                      key={link.name}
                      href={link.path}
                      onClick={(e) => {
                        (link as { onClick?: (e: React.MouseEvent) => void }).onClick?.(e);
                        setIsOpen(false);
                      }}
                      className={`block px-3 py-2 text-base font-medium rounded-xl hover:bg-blue-500/10 transition-colors ${isLinkActive ? "text-blue-500 bg-blue-500/10" : ""}`}
                    >
                      {link.name}
                    </Link>
                  );
                })}

                <div className="border-t border-[var(--border)] my-4 pt-4 space-y-4">
                  <div className="flex items-center justify-between px-3">
                    <span className="text-sm font-medium opacity-70">Language</span>
                    <div className="flex gap-2">
                      {languages.map((l) => (
                        <button
                          key={l.code}
                          onClick={() => setLanguage(l.code)}
                          className={`p-1.5 rounded-lg border ${language === l.code ? "border-blue-500 bg-blue-500/10" : "border-[var(--border)]"}`}
                        >
                          {l.flag}
                        </button>
                      ))}
                    </div>
                  </div>

                  {!isLoading && user ? (
                    <>
                      <Link
                        href="/create"
                        onClick={() => setIsOpen(false)}
                        className="flex items-center gap-2 px-3 py-2 text-base font-medium opacity-70 hover:opacity-100 rounded-xl"
                      >
                        <LayoutDashboard className="w-5 h-5" />
                        {t("dashboard")}
                      </Link>
                      <div className="flex items-center justify-between px-3 py-2 bg-blue-500/10 rounded-xl">
                        <span className="text-sm font-medium">{t("credits")}</span>
                        <span className="text-blue-500 font-bold">{totalCredits}</span>
                      </div>
                      <button
                        onClick={() => {
                          setIsOpen(false);
                          setShowSettings(true);
                        }}
                        className="flex items-center gap-2 w-full text-left px-3 py-2 text-base font-medium opacity-70 hover:opacity-100 rounded-xl hover:bg-gray-500/10"
                      >
                        <Settings className="w-5 h-5" />
                        {t("settings")}
                      </button>
                      <button
                        onClick={() => {
                          handleSignOut();
                          setIsOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 text-base font-medium text-red-500 hover:bg-red-500/10 rounded-xl"
                      >
                        {t("signOut")}
                      </button>
                    </>
                  ) : (
                    <div className="flex flex-col gap-3 px-3">
                      <button
                        onClick={() => {
                          setShowAuthModal(true);
                          setIsOpen(false);
                        }}
                        className="w-full py-3 text-center text-sm font-bold border border-[var(--border)] rounded-full hover:bg-gray-500/5 transition-colors"
                      >
                        {t("login")}
                      </button>
                      <Link
                        href="/create"
                        onClick={() => setIsOpen(false)}
                        className="w-full py-3 text-center text-sm font-bold text-white bg-blue-600 rounded-full hover:bg-blue-700"
                      >
                        {t("getStartedFree")}
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => {
          setShowAuthModal(false);
          const next = searchParams.get("next");
          if (next) router.push(next);
        }}
        title={t("authTitle")}
        description={t("authDesc")}
      />
    </>
  );
};

export default Navbar;
