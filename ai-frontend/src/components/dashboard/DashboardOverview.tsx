"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Sparkles,
  ChevronRight,
  CreditCard,
  Car,
  Image as ImageIcon,
  TrendingUp,
  Building2,
} from "lucide-react";
import { TASKS } from "@/lib/createConstants";
import type { TaskType, Order, StudioTemplate, BrandingConfig } from "@/types/create";

interface DashboardOverviewProps {
  onTaskSelect: (task: TaskType) => void;
  orders: Order[];
  totalCredits: number;
  selectedStudio: StudioTemplate;
  branding: BrandingConfig;
  onLogoUpload?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onToggleBranding?: () => void;
  t: Record<string, string>;
  theme: "light" | "dark";
  isLoggedIn: boolean;
  /** Show optional dealer setup banner when user has no dealer profile */
  hasNoDealer?: boolean;
  onSetupDealer?: () => void;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
};

export function DashboardOverview({
  onTaskSelect,
  orders,
  totalCredits,
  t,
  theme,
  isLoggedIn,
  hasNoDealer = false,
  onSetupDealer,
}: DashboardOverviewProps) {
  const textPrimary = "text-[var(--foreground)]";
  const textSecondary = "text-gray-500";
  const cardBase = "rounded-2xl border border-[var(--border)] shadow-sm transition-all duration-300";
  const cardStyle = "bg-[var(--card)]";

  const completedCount = orders.filter((o) => o.status === "completed").length;
  const totalImages = orders.reduce((sum, o) => sum + (o.jobs?.length ?? 0), 0);

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-8"
    >
      {/* Low credits banner - when logged in and 0 credits */}
      {isLoggedIn && totalCredits <= 0 && (
        <motion.div
          variants={itemVariants}
          className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        >
          <div className="flex items-start gap-4">
            <div className="p-2.5 rounded-xl bg-amber-500/20 shrink-0">
              <CreditCard className="w-6 h-6 text-amber-500" />
            </div>
            <div>
              <h3 className="font-bold text-[var(--foreground)]">Get credits to process images</h3>
              <p className="mt-1 text-sm text-gray-500">
                Purchase credits to process vehicle images. Superadmins can add credits from Account.
              </p>
            </div>
          </div>
          <Link
            href="/pricing"
            className="shrink-0 rounded-xl bg-amber-500 px-6 py-2.5 font-bold text-zinc-950 hover:bg-amber-400 transition-colors flex items-center gap-2"
          >
            Buy credits
            <ChevronRight className="w-4 h-4" />
          </Link>
        </motion.div>
      )}

      {/* Optional dealer setup banner - shown when logged in but no dealer profile */}
      {hasNoDealer && onSetupDealer && (
        <motion.div
          variants={itemVariants}
          className={`rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4`}
        >
          <div className="flex items-start gap-4">
            <div className="p-2.5 rounded-xl bg-amber-500/20 shrink-0">
              <Building2 className="w-6 h-6 text-amber-500" />
            </div>
            <div>
              <h3 className="font-bold text-[var(--foreground)] flex items-center gap-2">
                Set up your dealer profile (optional)
                <span className="text-xs font-normal text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full bg-amber-500/20">
                  Recommended
                </span>
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Add your logo, branding, and custom studio to get professional branded images. You can skip this and process images without branding.
              </p>
            </div>
          </div>
          <button
            onClick={onSetupDealer}
            className="shrink-0 rounded-xl bg-amber-500 px-6 py-2.5 font-bold text-zinc-950 hover:bg-amber-400 transition-colors flex items-center gap-2"
          >
            Set up profile
            <ChevronRight className="w-4 h-4" />
          </button>
        </motion.div>
      )}

      {/* Welcome + Stats row */}
      <motion.div variants={itemVariants} className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
        <div>
          <h1 className={`text-3xl md:text-4xl font-black tracking-tight ${textPrimary}`}>
            {t.welcome}
          </h1>
          <p className={`mt-1 text-base ${textSecondary}`}>{t.subtitle}</p>
        </div>

        {/* Stats cards - competitor style */}
        <div className="flex flex-wrap gap-4">
          {isLoggedIn && (
            <div
              className={`${cardBase} ${cardStyle} px-5 py-4 flex items-center gap-4 min-w-[180px]`}
            >
              <div className="p-2.5 rounded-xl bg-amber-500/10">
                <CreditCard className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className={`text-2xl font-black ${textPrimary}`}>{totalCredits}</p>
                <p className={`text-xs font-medium ${textSecondary}`}>Credits</p>
              </div>
            </div>
          )}
          <div
            className={`${cardBase} ${cardStyle} px-5 py-4 flex items-center gap-4 min-w-[180px]`}
          >
            <div className="p-2.5 rounded-xl bg-blue-500/10">
              <Car className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className={`text-2xl font-black ${textPrimary}`}>{orders.length}</p>
              <p className={`text-xs font-medium ${textSecondary}`}>Projects</p>
            </div>
          </div>
          <div
            className={`${cardBase} ${cardStyle} px-5 py-4 flex items-center gap-4 min-w-[180px]`}
          >
            <div className="p-2.5 rounded-xl bg-emerald-500/10">
              <ImageIcon className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <p className={`text-2xl font-black ${textPrimary}`}>{totalImages}</p>
              <p className={`text-xs font-medium ${textSecondary}`}>Images</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Quick actions - primary CTA */}
      <motion.section variants={itemVariants}>
        <h2 className={`text-lg font-bold mb-4 ${textPrimary}`}>{t.quickTasks}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {TASKS.map((task) => (
            <button
              key={task.id}
              onClick={() => onTaskSelect(task)}
              className={`group ${cardBase} ${cardStyle} p-6 text-left hover:border-blue-500/40 hover:shadow-lg transition-all duration-300`}
            >
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${
                  theme === "light" ? "bg-blue-50 text-blue-600" : "bg-blue-500/20 text-blue-400"
                } group-hover:scale-105 transition-transform`}
              >
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className={`font-bold mb-1 ${textPrimary}`}>{t[task.label] || task.label}</h3>
              <p className={`text-sm ${textSecondary}`}>{t[task.description] || task.description}</p>
              <div className="mt-4 flex items-center gap-2 text-blue-500 text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                <span>Start</span>
                <ChevronRight className="w-4 h-4" />
              </div>
            </button>
          ))}
        </div>
      </motion.section>

      {/* Recent activity hint */}
      {orders.length > 0 && (
        <motion.div
          variants={itemVariants}
          className={`${cardBase} ${cardStyle} p-6 flex items-center gap-4`}
        >
          <div className="p-3 rounded-xl bg-emerald-500/10">
            <TrendingUp className="w-6 h-6 text-emerald-500" />
          </div>
          <div>
            <p className={`font-semibold ${textPrimary}`}>
              {completedCount} of {orders.length} projects completed
            </p>
            <p className={`text-sm ${textSecondary}`}>
              Switch to Projects to view and manage your vehicle inventory
            </p>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
