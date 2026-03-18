"use client";

import { motion } from "framer-motion";
import { DealerSettingsForm } from "@/components/dealer/DealerSettingsForm";

interface DashboardDealerSettingsProps {
  theme: "light" | "dark";
  hasDealers: boolean;
  initialDealerId?: number | null;
  userEmail?: string;
}

export function DashboardDealerSettings({
  theme,
  hasDealers,
  initialDealerId = null,
  userEmail,
}: DashboardDealerSettingsProps) {
  const textPrimary = "text-[var(--foreground)]";
  const textSecondary = "text-gray-500";

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
          Create a dealer profile, upload your logo, configure branding, and set up a custom studio.
          All settings are applied automatically when processing images.
        </p>
      </div>

      <DealerSettingsForm
        initialDealerId={initialDealerId}
        theme={theme}
        compact={false}
        userEmail={userEmail}
      />
    </motion.div>
  );
}
