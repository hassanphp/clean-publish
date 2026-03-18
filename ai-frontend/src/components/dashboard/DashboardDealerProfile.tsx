"use client";

import { motion } from "framer-motion";
import { Building2, CheckCircle } from "lucide-react";

interface DealerInfo {
  id: number;
  name: string;
  email: string;
  assets?: { asset_type: string }[];
}

interface DashboardDealerProfileProps {
  dealers: DealerInfo[];
  selectedDealerId: number | null;
  theme: "light" | "dark";
  onNavigateToSettings: (dealerId?: number) => void;
}

export function DashboardDealerProfile({
  dealers,
  selectedDealerId,
  theme,
  onNavigateToSettings,
}: DashboardDealerProfileProps) {
  const textPrimary = "text-[var(--foreground)]";
  const textSecondary = "text-gray-500";
  const cardBase = "rounded-2xl border border-[var(--border)] bg-[var(--card)]";

  const selectedDealer = dealers.find((d) => d.id === selectedDealerId);
  const hasDealers = dealers.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <div>
        <h1 className={`text-2xl md:text-3xl font-black tracking-tight ${textPrimary}`}>
          Dealer Profile
        </h1>
        <p className={`mt-1 text-base ${textSecondary}`}>
          Manage your dealership information and branding
        </p>
      </div>

      {!hasDealers ? (
        <div className={`${cardBase} p-8 md:p-12 text-center`}>
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-8 h-8 text-amber-500" />
          </div>
          <h2 className={`text-xl font-bold mb-2 ${textPrimary}`}>No dealer profile yet</h2>
          <p className={`text-sm mb-6 max-w-md mx-auto ${textSecondary}`}>
            Create a dealer profile to save branding settings, upload your logo, and apply
            consistent styling across all processed images.
          </p>
          <button
            onClick={() => onNavigateToSettings()}
            className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold transition-colors"
          >
            Create dealer profile
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Dealer list */}
          <div className={`${cardBase} overflow-hidden`}>
            <div className="p-4 border-b border-[var(--border)]">
              <h2 className="font-semibold">Your dealerships</h2>
            </div>
            <div className="divide-y divide-[var(--border)]">
              {dealers.map((dealer) => {
                const isSelected = dealer.id === selectedDealerId;
                const hasLogo = dealer.assets?.some((a) => a.asset_type === "logo");
                const hasLicensePlate = dealer.assets?.some((a) => a.asset_type === "license_plate");
                const hasStudio = dealer.assets?.some((a) => a.asset_type === "studio");

                return (
                  <div
                    key={dealer.id}
                    className={`p-4 flex items-center justify-between gap-4 ${
                      isSelected ? "bg-blue-500/5" : ""
                    }`}
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-12 h-12 rounded-xl bg-[var(--background)] flex items-center justify-center shrink-0">
                        <Building2 className="w-6 h-6 text-gray-400" />
                      </div>
                      <div className="min-w-0">
                        <p className={`font-semibold truncate ${textPrimary}`}>{dealer.name}</p>
                        <p className={`text-sm truncate ${textSecondary}`}>{dealer.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {hasLogo && (
                        <span className="flex items-center gap-1 text-xs text-emerald-500">
                          <CheckCircle className="w-3.5 h-3.5" /> Logo
                        </span>
                      )}
                      {hasLicensePlate && (
                        <span className="flex items-center gap-1 text-xs text-emerald-500">
                          <CheckCircle className="w-3.5 h-3.5" /> Plate
                        </span>
                      )}
                      {hasStudio && (
                        <span className="flex items-center gap-1 text-xs text-emerald-500">
                          <CheckCircle className="w-3.5 h-3.5" /> Studio
                        </span>
                      )}
                      {!hasLogo && !hasLicensePlate && !hasStudio && (
                        <span className="text-xs text-gray-500">Not configured</span>
                      )}
                      <button
                        onClick={() => onNavigateToSettings(dealer.id)}
                        className="px-4 py-2 rounded-lg text-sm font-medium bg-amber-500/20 text-amber-600 dark:text-amber-400 hover:bg-amber-500/30 transition-colors"
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <button
            onClick={() => onNavigateToSettings()}
            className="w-full md:w-auto px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold transition-colors"
          >
            Open dealer settings
          </button>
        </div>
      )}
    </motion.div>
  );
}
