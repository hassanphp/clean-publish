"use client";

import { useState, useRef } from "react";
import { motion } from "framer-motion";
import {
  Sparkles,
  Plus,
  Pen,
  Car,
  ChevronRight,
  CheckCircle,
  Clock,
  Image as ImageIcon,
  Trash2,
  Settings,
} from "lucide-react";
import { TASKS } from "@/lib/createConstants";
import type { TaskType, Order, StudioTemplate, BrandingConfig } from "@/types/create";

interface CreateDashboardProps {
  onTaskSelect: (task: TaskType) => void;
  orders: Order[];
  loadingProjects?: boolean;
  onOrderSelect?: (order: Order) => void;
  onDeleteOrder?: (orderId: string) => void;
  onRenameOrder?: (orderId: string, newTitle: string) => Promise<void>;
  selectedStudio: StudioTemplate;
  branding: BrandingConfig;
  onLogoUpload?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onToggleBranding?: () => void;
  t: Record<string, string>;
  theme: "light" | "dark";
}

const iconMap: Record<string, React.ReactNode> = {
  Sparkles: <Sparkles className="w-8 h-8" />,
};

export function CreateDashboard({
  onTaskSelect,
  orders,
  loadingProjects = false,
  onOrderSelect,
  onDeleteOrder,
  onRenameOrder,
  selectedStudio,
  branding,
  onLogoUpload,
  onToggleBranding,
  t,
  theme,
}: CreateDashboardProps) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [showAll, setShowAll] = useState(false);

  const textPrimary = "text-[var(--foreground)]";
  const textSecondary = "text-gray-500";
  const cardBase = "backdrop-blur-md border shadow-xl transition-all duration-300";
  const cardStyle = "bg-[var(--card)] border-[var(--border)]";

  const startEdit = (e: React.MouseEvent, order: Order) => {
    e.stopPropagation();
    setEditingId(order.id);
    setEditValue(order.title || order.vin || "");
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const saveEdit = async (orderId: string) => {
    const trimmed = editValue.trim();
    if (!trimmed) {
      setEditingId(null);
      return;
    }
    setSavingId(orderId);
    setEditingId(null);
    await onRenameOrder?.(orderId, trimmed);
    setSavingId(null);
  };

  const cancelEdit = () => setEditingId(null);

  const handleDelete = (e: React.MouseEvent, orderId: string) => {
    e.stopPropagation();
    if (confirmDeleteId === orderId) {
      onDeleteOrder?.(orderId);
      setConfirmDeleteId(null);
    } else {
      setConfirmDeleteId(orderId);
      setTimeout(() => setConfirmDeleteId((prev) => (prev === orderId ? null : prev)), 3000);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="w-full px-4 sm:px-6 lg:px-8 py-8"
    >
      <motion.div variants={itemVariants} className="mb-16">
        <h1 className={`text-4xl md:text-6xl font-black tracking-tight mb-4 ${textPrimary}`}>
          {t.welcome}
        </h1>
        <p className={`text-xl ${textSecondary} font-medium max-w-2xl`}>{t.subtitle}</p>
      </motion.div>

      <motion.section variants={itemVariants} className="mb-20">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
            <Sparkles className="w-5 h-5" />
          </div>
          <h3 className={`text-2xl font-black tracking-tight ${textPrimary}`}>{t.quickTasks}</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {TASKS.map((task) => (
            <button
              key={task.id}
              onClick={() => onTaskSelect(task)}
              className={`group relative p-8 rounded-[32px] text-left transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl overflow-hidden ${cardBase} ${cardStyle} hover:border-blue-500/30`}
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/20 rounded-full blur-3xl -mr-16 -mt-16 transition-opacity opacity-0 group-hover:opacity-100" />
              <div
                className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 transition-all duration-300 group-hover:scale-110 group-hover:rotate-3 ${theme === "light" ? "bg-blue-50 text-blue-600" : "bg-blue-500/20 text-blue-400"}`}
              >
                {iconMap[task.icon] || <Sparkles className="w-8 h-8" />}
              </div>
              <h4 className={`text-xl font-bold mb-3 ${textPrimary}`}>{t[task.label] || task.label}</h4>
              <p className={`text-sm leading-relaxed ${textSecondary}`}>{t[task.description] || task.description}</p>
              <div
                className={`absolute bottom-6 right-6 p-2 rounded-full opacity-0 transform translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 ${theme === "light" ? "bg-blue-50 text-blue-600" : "bg-blue-600 text-white"}`}
              >
                <ChevronRight className="w-4 h-4" />
              </div>
            </button>
          ))}
        </div>
      </motion.section>

      <motion.section variants={itemVariants}>
        <div className="flex items-center justify-between mb-8 px-2">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-500">
              <Car className="w-5 h-5" />
            </div>
            <h3 className={`text-2xl font-black tracking-tight ${textPrimary}`}>{t.vehicleInventory}</h3>
            {orders.length > 0 && (
              <span
                className={`text-xs font-bold px-2.5 py-1 rounded-full ${theme === "light" ? "bg-gray-100 text-gray-500" : "bg-white/10 text-gray-400"}`}
              >
                {orders.length}
              </span>
            )}
          </div>
          {orders.length > 4 && (
            <button
              onClick={() => setShowAll((prev) => !prev)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${theme === "light" ? "bg-gray-100 hover:bg-gray-200 text-gray-600" : "bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white"}`}
            >
              {showAll ? t.showLess : `${t.showAll} (${orders.length})`}
            </button>
          )}
        </div>

        {loadingProjects ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className={`rounded-[28px] overflow-hidden ${cardBase} ${cardStyle} animate-pulse`}
              >
                <div className={`aspect-[4/3] ${theme === "light" ? "bg-gray-200" : "bg-white/5"}`} />
                <div className="p-5 space-y-3">
                  <div className={`h-4 w-2/3 rounded-full ${theme === "light" ? "bg-gray-200" : "bg-white/10"}`} />
                  <div className={`h-3 w-1/3 rounded-full ${theme === "light" ? "bg-gray-100" : "bg-white/5"}`} />
                </div>
              </div>
            ))}
          </div>
        ) : orders.length > 0 ? (
          <motion.div
            key={showAll ? "all" : "limited"}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
            initial="hidden"
            animate="visible"
            variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.05 } } }}
          >
            {(showAll ? orders : orders.slice(0, 4)).map((order) => {
              const thumbnailSrc =
                order.thumbnailUrl ||
                order.jobs?.find((j) => j.processedImage)?.processedImage ||
                null;

              return (
                <motion.div
                  key={order.id}
                  variants={itemVariants}
                  onClick={() => onOrderSelect?.(order)}
                  className={`group relative rounded-[28px] overflow-hidden cursor-pointer transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl ${cardBase} ${cardStyle} hover:border-blue-500/30`}
                >
                  <div
                    className={`relative aspect-[4/3] overflow-hidden ${theme === "light" ? "bg-gray-100" : "bg-white/5"}`}
                  >
                    {thumbnailSrc ? (
                      <img
                        src={thumbnailSrc}
                        alt={order.title || order.vin || "Vehicle"}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Car className={`w-16 h-16 ${theme === "light" ? "text-gray-200" : "text-white/10"}`} />
                      </div>
                    )}
                    <div
                      className={`absolute top-3 right-3 px-2.5 py-1 rounded-full text-[10px] font-black backdrop-blur-md ${theme === "light" ? "bg-white/80 text-gray-700" : "bg-black/60 text-white"}`}
                    >
                      <ImageIcon className="w-3 h-3 inline mr-1" />
                      {order.jobs?.length ?? 0}
                    </div>
                    <div className="absolute top-3 left-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold backdrop-blur-md border ${
                          order.status === "completed"
                            ? "bg-green-500/20 text-green-400 border-green-500/30"
                            : "bg-blue-500/20 text-blue-400 border-blue-500/30"
                        }`}
                      >
                        {order.status === "completed" ? (
                          <CheckCircle className="w-3 h-3" />
                        ) : (
                          <Clock className="w-3 h-3 animate-pulse" />
                        )}
                        {order.status}
                      </span>
                    </div>
                  </div>

                  <div className="p-5">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      {editingId === order.id ? (
                        <input
                          ref={inputRef}
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveEdit(order.id);
                            if (e.key === "Escape") cancelEdit();
                          }}
                          onBlur={() => saveEdit(order.id)}
                          onClick={(e) => e.stopPropagation()}
                          className={`text-sm font-bold tracking-wide px-2 py-1 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 w-full ${theme === "light" ? "bg-white border-gray-300 text-gray-900" : "bg-white/10 border-white/20 text-white"}`}
                        />
                      ) : savingId === order.id ? (
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-4 h-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent shrink-0" />
                          <span className={`text-sm font-bold truncate ${textPrimary}`}>
                            {order.title || order.vin}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className={`text-sm font-bold truncate ${textPrimary}`}>
                            {order.title || order.vin || "Untitled"}
                          </span>
                          {onRenameOrder && (
                            <button
                              onClick={(e) => startEdit(e, order)}
                              title="Rename"
                              className={`opacity-0 group-hover:opacity-100 p-1 rounded-lg transition-all shrink-0 ${theme === "light" ? "hover:bg-gray-100 text-gray-400 hover:text-gray-700" : "hover:bg-white/10 text-gray-600 hover:text-gray-300"}`}
                            >
                              <Pen className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      <span className={`text-[11px] font-medium ${textSecondary}`}>
                        {new Date(order.createdAt).toLocaleDateString()}
                      </span>
                      <div className="flex items-center gap-1">
                        {onDeleteOrder && (
                          <button
                            onClick={(e) => handleDelete(e, order.id)}
                            className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                              confirmDeleteId === order.id
                                ? "bg-red-500 text-white scale-110"
                                : `opacity-0 group-hover:opacity-100 ${theme === "light" ? "bg-gray-100 hover:bg-red-50 text-gray-400 hover:text-red-500" : "bg-white/5 hover:bg-red-500/20 text-gray-500 hover:text-red-400"}`
                            }`}
                            title={confirmDeleteId === order.id ? t.confirmDelete : t.deleteProject}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all ${theme === "light" ? "bg-gray-100 text-gray-400" : "bg-white/5 text-gray-500"}`}
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        ) : (
          <div className={`rounded-[32px] overflow-hidden ${cardBase} ${cardStyle}`}>
            <div className="py-32 px-6 flex flex-col items-center justify-center text-center">
              <div
                className={`w-24 h-24 rounded-full flex items-center justify-center mb-6 animate-pulse ${theme === "light" ? "bg-gray-50" : "bg-white/5"}`}
              >
                <Car className={`w-10 h-10 ${theme === "light" ? "text-gray-300" : "text-gray-600"}`} />
              </div>
              <h3 className={`text-xl font-bold mb-2 ${textPrimary}`}>{t.noVehicles}</h3>
              <p className={`text-sm ${textSecondary} max-w-sm mb-8`}>{t.createFirst}</p>
              <button
                onClick={() => onTaskSelect(TASKS[0])}
                className="px-6 py-3 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg shadow-blue-500/20 transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                {t.createNewProject}
              </button>
            </div>
          </div>
        )}
      </motion.section>

      {onLogoUpload && onToggleBranding && (
        <motion.section variants={itemVariants} className="mt-20">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
              <Settings className="w-5 h-5" />
            </div>
            <h3 className={`text-2xl font-black tracking-tight ${textPrimary}`}>
              {t.customSetup} / {t.consistentBranding}
            </h3>
          </div>
          <p className={`text-sm mb-8 ml-11 ${textSecondary}`}>{t.customSetupDesc}</p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            <div className={`rounded-[28px] overflow-hidden transition-all duration-300 ${cardBase} ${cardStyle}`}>
              <div className="p-6">
                <h4 className={`text-sm font-bold mb-2 ${textPrimary}`}>{t.csLogo}</h4>
                <p className={`text-xs mb-4 ${textSecondary}`}>{t.csLogoDesc}</p>
                <label className={`block w-full rounded-xl border-2 border-dashed p-6 cursor-pointer transition-colors ${theme === "light" ? "border-gray-200 hover:border-blue-500 hover:bg-blue-50/50" : "border-white/10 hover:border-blue-500/50 hover:bg-white/5"}`}>
                  <input type="file" accept="image/*" className="hidden" onChange={onLogoUpload} />
                  <div className="text-center">
                    {branding.logoUrl ? (
                      <img
                        src={branding.logoUrl}
                        alt="Logo"
                        className="h-16 mx-auto object-contain mb-2"
                      />
                    ) : (
                      <Plus className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    )}
                    <span className={`text-xs font-medium ${textSecondary}`}>
                      {branding.logoUrl ? "Change logo" : "Upload logo"}
                    </span>
                  </div>
                </label>
              </div>
            </div>

            <div className={`rounded-[28px] overflow-hidden transition-all duration-300 ${cardBase} ${cardStyle}`}>
              <div className="p-6">
                <h4 className={`text-sm font-bold mb-2 ${textPrimary}`}>{t.cs3dWallLogo}</h4>
                <p className={`text-xs mb-4 ${textSecondary}`}>{t.csLogoDesc}</p>
                <button
                  onClick={onToggleBranding}
                  className={`w-full py-3 rounded-xl font-bold text-sm transition-all ${branding.logo3dWallEnabled ? "bg-blue-600 text-white" : theme === "light" ? "bg-gray-100 text-gray-600" : "bg-white/10 text-gray-400"}`}
                >
                  {branding.logo3dWallEnabled ? "Enabled" : "Disabled"}
                </button>
              </div>
            </div>
          </div>
        </motion.section>
      )}
    </motion.div>
  );
}
