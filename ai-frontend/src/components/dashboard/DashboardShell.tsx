"use client";

import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Car,
  Building2,
  Settings,
  User,
  CreditCard,
  ChevronRight,
} from "lucide-react";

export type DashboardSection =
  | "overview"
  | "projects"
  | "dealer-profile"
  | "dealer-settings"
  | "account";

interface NavItem {
  id: DashboardSection;
  label: string;
  icon: React.ReactNode;
  description?: string;
}

interface DashboardShellProps {
  section: DashboardSection;
  onSectionChange: (section: DashboardSection) => void;
  children: React.ReactNode;
  theme: "light" | "dark";
  isLoggedIn: boolean;
  hasDealerAccess?: boolean;
}

const navItems: NavItem[] = [
  { id: "overview", label: "Overview", icon: <LayoutDashboard className="w-5 h-5" />, description: "Quick actions & stats" },
  { id: "projects", label: "Projects", icon: <Car className="w-5 h-5" />, description: "Vehicle inventory" },
  { id: "dealer-profile", label: "Dealer Profile", icon: <Building2 className="w-5 h-5" />, description: "Dealership info" },
  { id: "dealer-settings", label: "Dealer Settings", icon: <Settings className="w-5 h-5" />, description: "Branding & studio" },
  { id: "account", label: "Account", icon: <User className="w-5 h-5" />, description: "Profile & billing" },
];

export function DashboardShell({
  section,
  onSectionChange,
  children,
  theme,
  isLoggedIn,
  hasDealerAccess = true,
}: DashboardShellProps) {
  const textPrimary = "text-[var(--foreground)]";
  const textSecondary = "text-gray-500";
  const cardStyle = "bg-[var(--card)] border-[var(--border)]";

  const filteredNav = navItems.filter((item) => {
    if (item.id === "dealer-profile" || item.id === "dealer-settings") return hasDealerAccess;
    if (item.id === "account") return isLoggedIn;
    return true;
  });

  return (
    <div className="flex min-h-[calc(100vh-5rem)] w-full">
      {/* Sidebar - competitor-style compact nav */}
      <aside
        className={`hidden lg:flex flex-col w-64 shrink-0 border-r border-[var(--border)] ${cardStyle}`}
      >
        <nav className="p-4 space-y-1">
          {filteredNav.map((item) => {
            const isActive = section === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSectionChange(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all duration-200 group ${
                  isActive
                    ? "bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30"
                    : `hover:bg-[var(--background)]/50 ${textPrimary}`
                }`}
              >
                <div
                  className={`p-2 rounded-lg shrink-0 ${
                    isActive ? "bg-blue-500/20 text-blue-600 dark:text-blue-400" : "bg-[var(--background)]/50 group-hover:bg-blue-500/10"
                  }`}
                >
                  {item.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold truncate">{item.label}</span>
                  {item.description && (
                    <span className={`block text-xs truncate ${textSecondary}`}>{item.description}</span>
                  )}
                </div>
                <ChevronRight
                  className={`w-4 h-4 shrink-0 opacity-0 group-hover:opacity-50 transition-opacity ${
                    isActive ? "opacity-50" : ""
                  }`}
                />
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Mobile section tabs */}
      <div className="lg:hidden flex gap-2 p-4 overflow-x-auto border-b border-[var(--border)] bg-[var(--card)]">
        {filteredNav.map((item) => {
          const isActive = section === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSectionChange(item.id)}
              className={`shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? "bg-blue-500/20 text-blue-600 dark:text-blue-400"
                  : "bg-[var(--background)]/50 hover:bg-[var(--background)]"
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          );
        })}
      </div>

      {/* Main content */}
      <motion.main
        key={section}
        initial={{ opacity: 0, x: 8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.2 }}
        className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8"
      >
        {children}
      </motion.main>
    </div>
  );
}
