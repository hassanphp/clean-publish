"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { User, CreditCard, Mail, Calendar, ExternalLink } from "lucide-react";

interface UserInfo {
  id: number;
  email: string;
  name: string | null;
  credits: number;
  created_at: string;
}

interface DashboardAccountProps {
  user: UserInfo | null;
  theme: "light" | "dark";
}

export function DashboardAccount({ user, theme }: DashboardAccountProps) {
  const textPrimary = "text-[var(--foreground)]";
  const textSecondary = "text-gray-500";
  const cardBase = "rounded-2xl border border-[var(--border)] bg-[var(--card)]";

  if (!user) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className={`${cardBase} p-8 text-center`}
      >
        <p className={textSecondary}>Sign in to view your account.</p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <div>
        <h1 className={`text-2xl md:text-3xl font-black tracking-tight ${textPrimary}`}>
          Account
        </h1>
        <p className={`mt-1 text-base ${textSecondary}`}>
          Your profile and subscription
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Profile card */}
        <div className={`${cardBase} p-6`}>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center">
              <User className="w-7 h-7 text-blue-500" />
            </div>
            <div>
              <h2 className={`font-bold ${textPrimary}`}>
                {user.name || "Account"}
              </h2>
              <p className={`text-sm ${textSecondary}`}>{user.email}</p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <Mail className="w-4 h-4 text-gray-400" />
              <span>{user.email}</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Calendar className="w-4 h-4 text-gray-400" />
              <span>
                Member since{" "}
                {new Date(user.created_at).toLocaleDateString(undefined, {
                  month: "long",
                  year: "numeric",
                })}
              </span>
            </div>
          </div>
        </div>

        {/* Credits card */}
        <div className={`${cardBase} p-6`}>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center">
              <CreditCard className="w-7 h-7 text-amber-500" />
            </div>
            <div>
              <h2 className={`font-bold ${textPrimary}`}>Credits</h2>
              <p className={`text-2xl font-black text-amber-500`}>{user.credits}</p>
            </div>
          </div>
          <p className={`text-sm mb-4 ${textSecondary}`}>
            Use credits to process vehicle images. Purchase more when you run low.
          </p>
          <Link
            href="/pricing"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-sm transition-colors"
          >
            Buy credits
            <ExternalLink className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
