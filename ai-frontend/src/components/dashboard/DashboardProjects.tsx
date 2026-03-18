"use client";

import { useState, useRef } from "react";
import { motion } from "framer-motion";
import {
  Car,
  ChevronRight,
  CheckCircle,
  Clock,
  Image as ImageIcon,
  Trash2,
  Pen,
  Plus,
  AlertTriangle,
  X,
} from "lucide-react";
import { TASKS } from "@/lib/createConstants";
import type { TaskType, Order } from "@/types/create";

interface DashboardProjectsProps {
  orders: Order[];
  loadingProjects?: boolean;
  onOrderSelect?: (order: Order) => void;
  onDeleteOrder?: (orderId: string) => void;
  onRenameOrder?: (orderId: string, newTitle: string) => Promise<void>;
  onTaskSelect: (task: TaskType) => void;
  t: Record<string, string>;
  theme: "light" | "dark";
}

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
};

export function DashboardProjects({
  orders,
  loadingProjects = false,
  onOrderSelect,
  onDeleteOrder,
  onRenameOrder,
  onTaskSelect,
  t,
  theme,
}: DashboardProjectsProps) {
  const [deleteModal, setDeleteModal] = useState<
    | { mode: "single"; orderId: string; title: string }
    | { mode: "all"; count: number }
    | null
  >(null);
  const [deleting, setDeleting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [showAll, setShowAll] = useState(false);

  const textPrimary = "text-[var(--foreground)]";
  const textSecondary = "text-gray-500";
  const cardBase = "rounded-2xl border border-[var(--border)] shadow-sm transition-all duration-300";
  const cardStyle = "bg-[var(--card)]";

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

  const confirmDelete = async () => {
    if (!onDeleteOrder || !deleteModal) return;
    setDeleting(true);
    try {
      if (deleteModal.mode === "single") {
        await Promise.resolve(onDeleteOrder(deleteModal.orderId));
      } else {
        // Bulk delete: delete everything currently loaded for this user.
        for (const o of orders) {
          await Promise.resolve(onDeleteOrder(o.id));
        }
      }
      setDeleteModal(null);
    } finally {
      setDeleting(false);
    }
  };

  const displayOrders = showAll ? orders : orders.slice(0, 8);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className={`text-2xl md:text-3xl font-black tracking-tight ${textPrimary}`}>
            {t.vehicleInventory}
          </h1>
          <p className={`mt-1 text-base ${textSecondary}`}>
            Your vehicle projects and processed images
          </p>
        </div>
        <div className="flex items-center gap-3">
          {orders.length > 8 && (
            <button
              onClick={() => setShowAll((prev) => !prev)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                theme === "light" ? "bg-gray-100 hover:bg-gray-200 text-gray-600" : "bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white"
              }`}
            >
              {showAll ? t.showLess : `${t.showAll} (${orders.length})`}
            </button>
          )}
          {onDeleteOrder && orders.length > 0 && (
            <button
              onClick={() => setDeleteModal({ mode: "all", count: orders.length })}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                theme === "light"
                  ? "bg-red-500/10 hover:bg-red-500/15 text-red-600 border border-red-500/20"
                  : "bg-red-500/15 hover:bg-red-500/25 text-red-300 border border-red-500/25"
              }`}
              title="Delete all projects"
            >
              Delete all
            </button>
          )}
        </div>
      </div>

      {loadingProjects ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className={`${cardBase} ${cardStyle} overflow-hidden animate-pulse`}>
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
          variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.04 } } }}
        >
          {displayOrders.map((order) => {
            const thumbnailSrc =
              order.thumbnailUrl ||
              order.jobs?.find((j) => j.processedImage)?.processedImage ||
              null;

            return (
              <motion.div
                key={order.id}
                variants={itemVariants}
                onClick={() => onOrderSelect?.(order)}
                className={`group relative ${cardBase} ${cardStyle} overflow-hidden cursor-pointer hover:border-blue-500/40 hover:shadow-lg transition-all`}
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
                    className={`absolute top-3 right-3 px-2.5 py-1 rounded-full text-[10px] font-bold backdrop-blur-md ${
                      theme === "light" ? "bg-white/80 text-gray-700" : "bg-black/60 text-white"
                    }`}
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
                        className={`text-sm font-bold tracking-wide px-2 py-1 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 w-full ${
                          theme === "light" ? "bg-white border-gray-300 text-gray-900" : "bg-white/10 border-white/20 text-white"
                        }`}
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
                            className={`opacity-0 group-hover:opacity-100 p-1 rounded-lg transition-all shrink-0 ${
                              theme === "light" ? "hover:bg-gray-100 text-gray-400 hover:text-gray-700" : "hover:bg-white/10 text-gray-600 hover:text-gray-300"
                            }`}
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
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteModal({
                              mode: "single",
                              orderId: order.id,
                              title: order.title || order.vin || "Untitled",
                            });
                          }}
                          className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                            "opacity-0 group-hover:opacity-100 " + (theme === "light"
                              ? "bg-gray-100 hover:bg-red-50 text-gray-400 hover:text-red-500"
                              : "bg-white/5 hover:bg-red-500/20 text-gray-500 hover:text-red-400")
                          }`}
                          title={t.deleteProject}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-50 text-gray-400" />
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      ) : (
        <div className={`${cardBase} ${cardStyle} overflow-hidden`}>
          <div className="py-24 px-6 flex flex-col items-center justify-center text-center">
            <div
              className={`w-20 h-20 rounded-2xl flex items-center justify-center mb-6 ${
                theme === "light" ? "bg-gray-50" : "bg-white/5"
              }`}
            >
              <Car className={`w-10 h-10 ${theme === "light" ? "text-gray-300" : "text-gray-600"}`} />
            </div>
            <h3 className={`text-xl font-bold mb-2 ${textPrimary}`}>{t.noVehicles}</h3>
            <p className={`text-sm ${textSecondary} max-w-sm mb-8`}>{t.createFirst}</p>
            <button
              onClick={() => onTaskSelect(TASKS[0])}
              className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg shadow-blue-500/20 transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              {t.createNewProject}
            </button>
          </div>
        </div>
      )}

      {deleteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => (!deleting ? setDeleteModal(null) : null)}
        >
          <div
            className={`w-full max-w-lg rounded-2xl border ${
              theme === "light" ? "bg-white border-gray-200" : "bg-[var(--card)] border-[var(--border)]"
            } shadow-xl`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <AlertTriangle className={theme === "light" ? "text-red-600" : "text-red-300"} />
                    <h2 className="text-lg font-black tracking-tight">
                      {deleteModal.mode === "single"
                        ? "Delete project"
                        : `Delete all projects (${deleteModal.count})`}
                    </h2>
                  </div>
                  <p className="mt-2 text-sm text-gray-500">
                    {deleteModal.mode === "single"
                      ? `Are you sure you want to delete “${deleteModal.title}”? This cannot be undone.`
                      : "This will permanently delete all your projects and their processed images. This cannot be undone."}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Close"
                  className="p-2 rounded-lg hover:bg-black/5 transition-colors"
                  onClick={() => setDeleteModal(null)}
                  disabled={deleting}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-6 flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setDeleteModal(null)}
                  disabled={deleting}
                  className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                    theme === "light"
                      ? "bg-gray-100 hover:bg-gray-200 text-gray-700"
                      : "bg-white/5 hover:bg-white/10 text-gray-300"
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => confirmDelete()}
                  disabled={deleting}
                  className={`px-4 py-2.5 rounded-xl text-sm font-black transition-colors ${
                    theme === "light"
                      ? "bg-red-500 hover:bg-red-600 text-white"
                      : "bg-red-500/90 hover:bg-red-500 text-white"
                  }`}
                >
                  {deleting ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
