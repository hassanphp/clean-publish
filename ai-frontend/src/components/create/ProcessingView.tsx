"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import { useProcessingStages } from "@/hooks/useProcessingStages";
import type { ProcessedResult } from "@/lib/api";
import type { ImageProgressStatus } from "@/components/ProcessingProgress";
import { parseImageStatuses } from "@/components/ProcessingProgress";

interface ProcessingViewProps {
  logs: string[];
  totalImages: number;
  completedCount: number;
  resultsCount: number;
  streamComplete: boolean;
  error?: string | null;
  images?: string[];
  results?: ProcessedResult[];
  onViewResults: () => void;
  onStartOver: () => void;
  t: Record<string, string>;
  theme: "light" | "dark";
  pipelineVersion?: string;
}

function toDataUrl(s: string): string {
  if (!s) return "";
  if (s.startsWith("data:") || s.startsWith("http")) return s;
  return `data:image/jpeg;base64,${s}`;
}

function ProcessingGridSlot({
  index,
  originalSrc,
  result,
  status,
  theme,
}: {
  index: number;
  originalSrc: string;
  result: ProcessedResult | undefined;
  status: ImageProgressStatus;
  theme: "light" | "dark";
}) {
  const procSrc = result?.processed_b64 ? toDataUrl(result.processed_b64) : null;
  const isComplete = status === "completed" && !!procSrc;
  const isFailed = status === "failed";

  const getProgress = (s: ImageProgressStatus) => {
    switch (s) {
      case "pending": return 0;
      case "analyzing": return 30;
      case "enhancing": return 70;
      case "completed": return 100;
      case "failed": return 0;
      default: return 0;
    }
  };

  const cardBg = theme === "light" ? "bg-white border-gray-200" : "bg-zinc-900/60 border-zinc-700/50";
  const progressBg = theme === "light" ? "bg-gray-200" : "bg-zinc-800";
  const progressFill = isFailed ? "bg-red-500" : isComplete ? "bg-emerald-500" : theme === "light" ? "bg-amber-500" : "bg-blue-500";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25 }}
      className={`rounded-xl border overflow-hidden shadow-lg ${cardBg}`}
    >
      <div className="flex gap-0">
        <div className="w-1/2 aspect-[4/3] relative overflow-hidden bg-zinc-950">
          {originalSrc ? (
            <img
              src={originalSrc}
              alt={`Original ${index + 1}`}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="w-12 h-12 rounded-lg bg-zinc-800 animate-pulse" />
            </div>
          )}
          <div className="absolute top-2 left-2 px-2 py-0.5 rounded text-[10px] font-bold bg-black/60 text-white uppercase">
            Original
          </div>
        </div>
        <div className="w-1/2 aspect-[4/3] relative overflow-hidden bg-zinc-950 flex items-center justify-center">
          {procSrc ? (
            <>
              <img
                src={procSrc}
                alt={`Enhanced ${index + 1}`}
                className="w-full h-full object-cover"
              />
              <div className="absolute top-2 left-2 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/90 text-emerald-950 uppercase">
                Enhanced
              </div>
            </>
          ) : isFailed ? (
            <div className="flex flex-col items-center justify-center gap-2 p-4 text-center">
              <span className="text-xs font-medium text-red-400">Failed</span>
            </div>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4">
              <div className="w-10 h-10 rounded-full border-2 border-dashed border-zinc-600 animate-pulse" />
              <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">
                {status === "pending" ? "Waiting" : status === "analyzing" ? "Analyzing" : "Enhancing"}
              </span>
            </div>
          )}
        </div>
      </div>
      <div className={`px-3 py-2 border-t ${theme === "light" ? "border-gray-100 bg-gray-50/50" : "border-zinc-800 bg-zinc-900/40"}`}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-bold text-zinc-500">#{index + 1}</span>
          <div className={`flex-1 h-1.5 rounded-full overflow-hidden ${progressBg}`}>
            <div
              className={`h-full ${progressFill} transition-all duration-500 rounded-full`}
              style={{ width: `${getProgress(status)}%` }}
            />
          </div>
          <span className="text-[10px] font-mono text-zinc-500 w-8 text-right">
            {getProgress(status)}%
          </span>
        </div>
      </div>
    </motion.div>
  );
}

export function ProcessingView({
  logs,
  totalImages,
  completedCount,
  resultsCount,
  streamComplete,
  error,
  images = [],
  results = [],
  onViewResults,
  onStartOver,
  t,
  theme,
  pipelineVersion = "11",
}: ProcessingViewProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [logsExpanded, setLogsExpanded] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const isProcessing = !streamComplete && !error;
  const processingText = useProcessingStages(isProcessing, pipelineVersion);

  const parsedStatuses = parseImageStatuses(logs);
  const resultByIndex = new Map(results.map((r) => [r.index, r]));
  const effectiveCompletedCount = Math.max(completedCount, results.length);
  const hasStarted = logs.length > 0 || results.length > 0;

  const statuses: ImageProgressStatus[] = Array.from({ length: totalImages }, (_, i) => {
    const result = resultByIndex.get(i);
    if (result) {
      return !!result.processed_b64 && result.processed_b64.length > 0 ? "completed" : "failed";
    }
    if (parsedStatuses[i]) return parsedStatuses[i];
    if (i < effectiveCompletedCount) return "completed";
    return hasStarted ? "enhancing" : "pending";
  });

  useEffect(() => {
    const interval = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const progress = totalImages > 0 ? (effectiveCompletedCount / totalImages) * 100 : 0;
  const isComplete = streamComplete || !!error;
  const allImagesCompleted =
    !streamComplete &&
    !error &&
    (effectiveCompletedCount >= totalImages || resultsCount >= totalImages) &&
    totalImages > 0;

  const accentColor = theme === "light" ? "text-amber-600" : "text-blue-500";
  const accentBg = theme === "light" ? "bg-amber-600" : "bg-blue-600";
  const textTitle = theme === "light" ? "text-gray-900" : "text-white";

  return (
    <div className="w-full flex flex-col py-8 px-2 sm:px-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div
              className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                theme === "light" ? "bg-amber-500/10" : "bg-blue-500/10"
              }`}
            >
              <Sparkles className={`${accentColor} w-7 h-7 ${isProcessing ? "animate-pulse" : ""}`} />
            </div>
            {isProcessing && (
              <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-500 animate-ping opacity-75" />
            )}
          </div>
          <div>
            <h2 className={`text-xl sm:text-2xl font-black ${textTitle}`}>
              {t.processing ?? "Processing..."}
            </h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-sm text-gray-500">
                {isProcessing && processingText ? processingText : t.identityLock ?? "AI is enhancing your images"}
              </span>
              {isProcessing && pipelineVersion === "11" && (
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                  theme === "light" ? "bg-amber-500/20 text-amber-700" : "bg-blue-500/20 text-blue-400"
                }`}>
                  Virtual Detailing
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className={`text-2xl font-black font-mono tabular-nums ${accentColor}`}>
            ⏱ {formatTime(elapsedSeconds)}
          </span>
          <div className={`px-4 py-2 rounded-xl ${theme === "light" ? "bg-gray-100" : "bg-white/5"}`}>
            <span className="text-sm font-bold">
              {effectiveCompletedCount} / {totalImages}
            </span>
          </div>
        </div>
      </div>

      <div
        className={`rounded-2xl border overflow-hidden mb-6 ${
          theme === "light" ? "bg-gray-50 border-gray-200" : "bg-white/5 border-white/10"
        }`}
      >
        <div className="p-4 sm:p-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest">
              {t.overallProgress ?? "Overall progress"}
            </span>
            <span className={`text-lg font-black ${accentColor}`}>{Math.round(progress)}%</span>
          </div>
          <div
            className={`w-full h-3 rounded-full overflow-hidden ${
              theme === "light" ? "bg-gray-200" : "bg-white/10"
            }`}
          >
            <motion.div
              className={`h-full ${accentBg} rounded-full`}
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
        <AnimatePresence mode="popLayout">
          {Array.from({ length: totalImages }, (_, i) => {
            const orig = images[i];
            const origSrc = orig ? toDataUrl(orig) : "";
            const result = resultByIndex.get(i);
            const status = statuses[i] ?? "pending";
            return (
              <ProcessingGridSlot
                key={i}
                index={i}
                originalSrc={origSrc}
                result={result}
                status={status}
                theme={theme}
              />
            );
          })}
        </AnimatePresence>
      </div>

      <div
        className={`rounded-2xl border overflow-hidden ${
          theme === "light" ? "bg-gray-50 border-gray-200" : "bg-[#0d0d0d] border-white/10"
        }`}
      >
        <button
          type="button"
          onClick={() => setLogsExpanded((e) => !e)}
          className="w-full flex items-center justify-between gap-2 p-4 text-left"
        >
          <div className="flex gap-1.5">
            <span className="w-3 h-3 rounded-full bg-red-500/80" />
            <span className="w-3 h-3 rounded-full bg-amber-500/80" />
            <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
          </div>
          <span className="text-xs font-mono text-gray-500">
            {isComplete ? "Complete" : allImagesCompleted ? "Finalizing..." : "Processing..."}
          </span>
          {logsExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </button>
        <AnimatePresence>
          {logsExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div
                ref={containerRef}
                className="space-y-2 p-4 pt-0 font-mono text-[11px] overflow-y-auto max-h-40 scrollbar-hide"
              >
                {logs.map((log, i) => (
                  <div key={i} className="flex gap-3">
                    <span className="text-gray-500 shrink-0">[{String(i + 1).padStart(3, "0")}]</span>
                    <span
                      className={
                        log.includes("FAIL") || log.includes("error")
                          ? "text-red-500 font-bold"
                          : log.includes("Completed") || log.includes("→")
                            ? "text-emerald-500"
                            : theme === "light"
                              ? "text-gray-800"
                              : "text-blue-400"
                      }
                    >
                      {log}
                    </span>
                  </div>
                ))}
                {!isComplete && logs.length > 0 && (
                  <div className="flex gap-3 text-amber-500/80">
                    <span className="shrink-0">▌</span>
                    <span className={allImagesCompleted ? "" : "animate-pulse"}>
                      {allImagesCompleted ? "Retrieving results..." : "waiting..."}
                    </span>
                  </div>
                )}
                {error && (
                  <div className="flex gap-3 text-red-500 font-bold">
                    <span className="shrink-0">!</span>
                    <span>{error}</span>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {(error ||
        (resultsCount > 0 &&
          (streamComplete ||
            effectiveCompletedCount >= totalImages ||
            resultsCount >= totalImages))) && (
        <div className="flex justify-center gap-3 mt-8">
          {resultsCount > 0 &&
            (streamComplete ||
              effectiveCompletedCount >= totalImages ||
              resultsCount >= totalImages) && (
              <button
                onClick={onViewResults}
                className={`rounded-full px-8 py-3 font-bold transition-all ${
                  theme === "light"
                    ? "bg-amber-600 text-white hover:bg-amber-500"
                    : "bg-blue-600 text-white hover:bg-blue-500"
                }`}
              >
                {t.viewResults ?? "View results"} ({resultsCount})
              </button>
            )}
          {error && (
            <button
              onClick={onStartOver}
              className={`rounded-full border px-8 py-3 font-medium ${
                theme === "light"
                  ? "border-gray-300 bg-white text-gray-900 hover:bg-gray-50"
                  : "border-white/20 bg-white/5 text-white hover:bg-white/10"
              }`}
            >
              {t.startOver ?? "Start over"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
