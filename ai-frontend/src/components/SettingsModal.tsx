"use client";

import React from "react";
import { X, Smartphone } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "@/context/LanguageContext";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { t } = useLanguage();

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-md bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
              <h2 className="text-lg font-bold">{t("settings")}</h2>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-gray-500/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3 mb-1">
                <div className="p-2 bg-blue-500/10 rounded-xl">
                  <Smartphone className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <h3 className="font-semibold text-base">{t("mobileAppAccess")}</h3>
                  <p className="text-sm opacity-60">{t("mobileAppAccessDesc")}</p>
                </div>
              </div>

              <div className="p-4 bg-black/20 border border-[var(--border)] rounded-xl">
                <p className="text-sm opacity-70">
                  Mobile app access token will be available in a future update. You can use the web
                  app at create.carveo.app in the meantime.
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SettingsModal;
