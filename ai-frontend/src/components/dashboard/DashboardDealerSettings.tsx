"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Settings, Image as ImageIcon, Palette, Upload } from "lucide-react";

interface DashboardDealerSettingsProps {
  theme: "light" | "dark";
  hasDealers: boolean;
}

export function DashboardDealerSettings({ theme, hasDealers }: DashboardDealerSettingsProps) {
  const textPrimary = "text-[var(--foreground)]";
  const textSecondary = "text-gray-500";
  const cardBase = "rounded-2xl border border-[var(--border)] bg-[var(--card)]";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <div>
        <h1 className={`text-2xl md:text-3xl font-black tracking-tight ${textPrimary}`}>
          Dealer Settings
        </h1>
        <p className={`mt-1 text-base ${textSecondary}`}>
          Configure branding, logo, and studio for your dealership
        </p>
      </div>

      <div className={`${cardBase} overflow-hidden`}>
        <div className="p-6 md:p-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center shrink-0">
                <Settings className="w-7 h-7 text-amber-500" />
              </div>
              <div>
                <h2 className={`text-lg font-bold mb-1 ${textPrimary}`}>
                  Full dealer settings
                </h2>
                <p className={`text-sm ${textSecondary} max-w-lg`}>
                  Upload your logo, configure license plate branding, enable 3D wall logo, and
                  set up custom studio backgrounds. All settings are applied automatically when
                  processing images.
                </p>
              </div>
            </div>
            <Link
              href="/dealer/settings"
              className="shrink-0 inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold transition-colors"
            >
              Open dealer settings
              <span className="text-lg">→</span>
            </Link>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4 p-6 pt-0 md:pt-6 border-t border-[var(--border)]">
          <div className="flex items-center gap-3 p-4 rounded-xl bg-[var(--background)]/50">
            <Palette className="w-5 h-5 text-amber-500" />
            <div>
              <p className="text-sm font-medium">Branding</p>
              <p className="text-xs text-gray-500">Logo, corner, license plate</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-4 rounded-xl bg-[var(--background)]/50">
            <ImageIcon className="w-5 h-5 text-amber-500" />
            <div>
              <p className="text-sm font-medium">Studio</p>
              <p className="text-xs text-gray-500">Custom background upload</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-4 rounded-xl bg-[var(--background)]/50">
            <Upload className="w-5 h-5 text-amber-500" />
            <div>
              <p className="text-sm font-medium">Assets</p>
              <p className="text-xs text-gray-500">Logo, license plate images</p>
            </div>
          </div>
        </div>
      </div>

      {!hasDealers && (
        <div className={`${cardBase} p-6 border-amber-500/20 bg-amber-500/5`}>
          <p className={`text-sm ${textSecondary}`}>
            You don&apos;t have a dealer profile yet. Open dealer settings to create one and
            configure your branding.
          </p>
        </div>
      )}
    </motion.div>
  );
}
