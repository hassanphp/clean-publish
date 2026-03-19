"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Download,
  SlidersHorizontal,
  Columns,
  CheckCircle2,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { ProjectResponse, JobImageResponse } from "@/lib/store/apiSlice";

function toDataUrl(url: string | null): string {
  if (!url) return "";
  if (url.startsWith("data:") || url.startsWith("http")) return url;
  return `data:image/jpeg;base64,${url}`;
}

function downloadImage(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

function ImageCompareCard({
  image,
  index,
  theme,
}: {
  image: JobImageResponse;
  index: number;
  theme: "light" | "dark";
}) {
  const [viewMode, setViewMode] = useState<"slider" | "side-by-side">("slider");
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const origSrc = toDataUrl(image.original_url);
  const procSrc = toDataUrl(image.processed_url);
  const hasProcessed = !!procSrc;

  const handleMove = (clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    setSliderPosition(x);
  };

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: MouseEvent) => handleMove(e.clientX);
    const onUp = () => setIsDragging(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [isDragging]);

  useEffect(() => {
    if (!isDragging) return;
    const onTouch = (e: TouchEvent) => {
      if (e.touches.length > 0) handleMove(e.touches[0].clientX);
    };
    const onEnd = () => setIsDragging(false);
    window.addEventListener("touchmove", onTouch, { passive: true });
    window.addEventListener("touchend", onEnd);
    return () => {
      window.removeEventListener("touchmove", onTouch);
      window.removeEventListener("touchend", onEnd);
    };
  }, [isDragging]);

  const cardBg = theme === "light" ? "bg-white border-gray-200" : "bg-zinc-900/80 border-zinc-700/50";
  const textPrimary = theme === "light" ? "text-gray-900" : "text-white";
  const textSecondary = theme === "light" ? "text-gray-500" : "text-zinc-400";
  const accent = theme === "light" ? "amber" : "blue";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`rounded-2xl border shadow-xl overflow-hidden ${cardBg}`}
    >
      <div className={`p-4 border-b ${theme === "light" ? "border-gray-100" : "border-zinc-800"} flex flex-wrap items-center justify-between gap-3`}>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-bold ${textSecondary}`}>Image #{index + 1}</span>
          {image.status === "completed" && (
            <span className={`flex items-center gap-1 text-xs font-medium text-emerald-600`}>
              <CheckCircle2 className="w-3.5 h-3.5" />
              Done
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className={`flex gap-0.5 rounded-lg p-0.5 ${theme === "light" ? "bg-gray-100" : "bg-zinc-800"}`}>
            <button
              type="button"
              onClick={() => setViewMode("slider")}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                viewMode === "slider"
                  ? theme === "light"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "bg-zinc-700 text-white"
                  : textSecondary
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Slider
            </button>
            <button
              type="button"
              onClick={() => setViewMode("side-by-side")}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                viewMode === "side-by-side"
                  ? theme === "light"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "bg-zinc-700 text-white"
                  : textSecondary
              }`}
            >
              <Columns className="w-3.5 h-3.5" />
              Side by side
            </button>
          </div>
          <button
            type="button"
            onClick={() => origSrc && downloadImage(origSrc, `original-${index + 1}.jpg`)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              theme === "light" ? "bg-gray-100 hover:bg-gray-200 text-gray-700" : "bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            Original
          </button>
          <button
            type="button"
            onClick={() => procSrc && downloadImage(procSrc, `enhanced-${index + 1}.jpg`)}
            disabled={!procSrc}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              accent === "amber"
                ? "bg-amber-500/20 text-amber-600 hover:bg-amber-500/30 border border-amber-500/30"
                : "bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-500/30"
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <Download className="w-3.5 h-3.5" />
            Enhanced
          </button>
        </div>
      </div>

      {viewMode === "side-by-side" ? (
        <div className={`grid grid-cols-2 gap-px ${theme === "light" ? "bg-gray-200" : "bg-zinc-800"}`}>
          <div className={`relative aspect-[4/3] ${theme === "light" ? "bg-gray-50" : "bg-zinc-950"} p-3`}>
            <img
              src={origSrc}
              alt={`Original ${index + 1}`}
              className="w-full h-full object-contain"
              draggable={false}
            />
            <div className={`absolute top-3 left-3 px-2 py-1 rounded-md text-[10px] font-bold uppercase ${
              theme === "light" ? "bg-black/60 text-white" : "bg-black/70 text-zinc-300"
            }`}>
              Original
            </div>
          </div>
          <div className={`relative aspect-[4/3] ${theme === "light" ? "bg-gray-50" : "bg-zinc-950"} p-3 ring-1 ${
            accent === "amber" ? "ring-amber-500/30" : "ring-blue-500/30"
          }`}>
            {procSrc ? (
              <img
                src={procSrc}
                alt={`Enhanced ${index + 1}`}
                className="w-full h-full object-contain"
                draggable={false}
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-center">
                <ImageIcon className={`w-12 h-12 ${textSecondary}`} />
                <span className={`text-sm font-medium ${textSecondary}`}>No enhanced image</span>
              </div>
            )}
            <div className={`absolute top-3 left-3 px-2 py-1 rounded-md text-[10px] font-bold uppercase ${
              accent === "amber" ? "bg-amber-500/90 text-amber-950" : "bg-blue-500/90 text-blue-950"
            }`}>
              Enhanced
            </div>
          </div>
        </div>
      ) : (
        <div
          ref={containerRef}
          className="relative aspect-[16/10] w-full max-h-[420px] overflow-hidden select-none cursor-col-resize"
          onMouseDown={(e) => {
            e.preventDefault();
            handleMove(e.clientX);
            setIsDragging(true);
          }}
          onTouchStart={() => setIsDragging(true)}
          onTouchEnd={() => setIsDragging(false)}
        >
          <div className="absolute inset-0">
            <img
              src={origSrc}
              alt={`Original ${index + 1}`}
              className="w-full h-full object-contain bg-zinc-950"
              draggable={false}
            />
            <div className={`absolute top-3 left-3 px-2 py-1 rounded-md text-[10px] font-bold uppercase ${
              theme === "light" ? "bg-black/60 text-white" : "bg-black/70 text-zinc-300"
            }`}>
              Original
            </div>
          </div>
          <div
            className="absolute inset-0 overflow-hidden"
            style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
          >
            {procSrc ? (
              <img
                src={procSrc}
                alt={`Enhanced ${index + 1}`}
                className="w-full h-full object-contain bg-zinc-950"
                draggable={false}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-zinc-900">
                <span className={`text-sm ${textSecondary}`}>No enhanced image</span>
              </div>
            )}
            <div className={`absolute top-3 left-3 px-2 py-1 rounded-md text-[10px] font-bold uppercase ${
              accent === "amber" ? "bg-amber-500/90 text-amber-950" : "bg-blue-500/90 text-blue-950"
            }`}>
              Enhanced
            </div>
          </div>
          <div
            className="absolute top-0 bottom-0 w-1 bg-white shadow-xl z-10"
            style={{ left: `${sliderPosition}%`, transform: "translateX(-50%)" }}
          >
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white shadow-2xl flex items-center justify-center border-2 border-zinc-200">
              <ChevronLeft className="w-3 h-3 text-zinc-500 absolute left-0.5" />
              <ChevronRight className="w-3 h-3 text-zinc-500 absolute right-0.5" />
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}

interface ProjectDetailViewProps {
  project: ProjectResponse | undefined;
  images: JobImageResponse[];
  isLoading: boolean;
  onBack: () => void;
}

export function ProjectDetailView({
  project,
  images,
  isLoading,
  onBack,
}: ProjectDetailViewProps) {
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [viewMode, setViewMode] = useState<"grid" | "carousel">("grid");
  const [carouselIndex, setCarouselIndex] = useState(0);

  useEffect(() => {
    const isDark = typeof window !== "undefined" && document.documentElement.classList.contains("dark");
    setTheme(isDark ? "dark" : "light");
  }, []);

  const textPrimary = theme === "light" ? "text-gray-900" : "text-white";
  const textSecondary = theme === "light" ? "text-gray-500" : "text-zinc-400";

  if (isLoading) {
    return (
      <div className="min-h-screen px-4 py-12">
        <div className="mx-auto max-w-6xl">
          <div className="h-10 w-48 rounded-lg bg-zinc-800 animate-pulse mb-8" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="rounded-2xl border border-zinc-700/50 overflow-hidden animate-pulse">
                <div className="aspect-[4/3] bg-zinc-800" />
                <div className="p-4 space-y-3">
                  <div className="h-4 w-24 rounded bg-zinc-800" />
                  <div className="h-3 w-full rounded bg-zinc-800" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 mb-10">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-colors ${
                theme === "light"
                  ? "bg-gray-100 hover:bg-gray-200 text-gray-700"
                  : "bg-white/5 hover:bg-white/10 text-zinc-300"
              }`}
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
            <div>
              <h1 className={`text-2xl md:text-3xl font-black tracking-tight ${textPrimary}`}>
                {project?.title || "Untitled Project"}
              </h1>
              <p className={`mt-1 text-sm ${textSecondary}`}>
                {images.length} image{images.length !== 1 ? "s" : ""} · Original ↔ Enhanced comparison
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setViewMode("grid")}
              className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                viewMode === "grid"
                  ? "bg-blue-600 text-white"
                  : theme === "light"
                    ? "bg-gray-100 text-gray-600"
                    : "bg-white/5 text-zinc-400"
              }`}
            >
              Grid
            </button>
            <button
              onClick={() => setViewMode("carousel")}
              className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                viewMode === "carousel"
                  ? "bg-blue-600 text-white"
                  : theme === "light"
                    ? "bg-gray-100 text-gray-600"
                    : "bg-white/5 text-zinc-400"
              }`}
            >
              Carousel
            </button>
          </div>
        </div>

        {images.length === 0 ? (
          <div className={`rounded-2xl border ${
            theme === "light" ? "border-gray-200 bg-gray-50" : "border-zinc-700/50 bg-zinc-900/30"
          } py-24 flex flex-col items-center justify-center text-center`}>
            <ImageIcon className={`w-16 h-16 mb-4 ${textSecondary}`} />
            <h3 className={`text-lg font-bold mb-2 ${textPrimary}`}>No images yet</h3>
            <p className={`text-sm ${textSecondary} max-w-sm`}>
              Process some images for this project to see them here.
            </p>
          </div>
        ) : viewMode === "carousel" ? (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setCarouselIndex((i) => Math.max(0, i - 1))}
                disabled={carouselIndex === 0}
                className={`p-2 rounded-xl ${
                  theme === "light" ? "bg-gray-100 hover:bg-gray-200" : "bg-white/5 hover:bg-white/10"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="text-sm font-medium">
                {carouselIndex + 1} / {images.length}
              </span>
              <button
                onClick={() => setCarouselIndex((i) => Math.min(images.length - 1, i + 1))}
                disabled={carouselIndex >= images.length - 1}
                className={`p-2 rounded-xl ${
                  theme === "light" ? "bg-gray-100 hover:bg-gray-200" : "bg-white/5 hover:bg-white/10"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
            <AnimatePresence mode="wait">
              <motion.div
                key={carouselIndex}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <ImageCompareCard
                  image={images[carouselIndex]!}
                  index={carouselIndex}
                  theme={theme}
                />
              </motion.div>
            </AnimatePresence>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {images.map((img, i) => (
              <ImageCompareCard key={img.id} image={img} index={i} theme={theme} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
