"use client";

import { useEffect, useState, useRef } from "react";
import { Sparkles } from "lucide-react";

interface ProcessingViewProps {
  logs: string[];
  totalImages: number;
  completedCount: number;
  resultsCount: number;
  streamComplete: boolean;
  error?: string | null;
  onViewResults: () => void;
  onStartOver: () => void;
  t: Record<string, string>;
  theme: "light" | "dark";
}

export function ProcessingView({
  logs,
  totalImages,
  completedCount,
  resultsCount,
  streamComplete,
  error,
  onViewResults,
  onStartOver,
  t,
  theme,
}: ProcessingViewProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

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
    const m = Math.floor(secs / 60)
      .toString()
      .padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const effectiveCompletedCount = Math.max(completedCount, resultsCount);
  const progress =
    totalImages > 0 ? (effectiveCompletedCount / totalImages) * 100 : 0;
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
    <div className="w-full min-h-[60vh] flex flex-col items-center justify-center py-10 px-4">
      <div className="w-24 h-24 md:w-32 md:h-32 relative mb-10">
        <div
          className={`absolute inset-0 rounded-full border-4 ${
            theme === "light" ? "border-amber-600/20" : "border-blue-600/20"
          }`}
        />
        <div
          className={`absolute inset-0 rounded-full border-4 ${
            theme === "light" ? "border-amber-600" : "border-blue-600"
          } border-t-transparent animate-spin`}
          style={{ animationDuration: "1.2s" }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <Sparkles
            className={`${accentColor} w-10 h-10 md:w-12 md:h-12 animate-pulse`}
          />
        </div>
      </div>

      <h2
        className={`text-2xl md:text-4xl font-black mb-3 text-center ${textTitle}`}
      >
        {t.processing ?? "Processing..."}
      </h2>
      <p className="text-gray-500 mb-2 text-center max-w-md text-sm md:text-lg font-medium">
        {t.identityLock ?? "AI is analyzing and enhancing your images"}
      </p>
      <p
        className={`text-lg md:text-xl font-mono font-bold mb-10 ${accentColor} tabular-nums`}
      >
        ⏱ {formatTime(elapsedSeconds)}
      </p>

      <div
        className={`${
          theme === "light" ? "bg-gray-50" : "bg-white/5"
        } border ${
          theme === "light" ? "border-gray-200" : "border-white/10"
        } w-full rounded-[32px] overflow-hidden mb-10 shadow-2xl`}
      >
        <div className="p-8">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest">
              {t.overallProgress ?? "Overall progress"}
            </span>
            <span className={`text-lg font-black ${accentColor}`}>
              {Math.round(progress)}%
            </span>
          </div>
          <div
            className={`w-full h-4 ${
              theme === "light" ? "bg-gray-200" : "bg-white/10"
            } rounded-full overflow-hidden shadow-inner`}
          >
            <div
              className={`h-full ${accentBg} transition-all duration-700 ease-out shadow-lg`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="mt-2 text-sm text-gray-500">
            {effectiveCompletedCount} / {totalImages} images
          </div>
        </div>
      </div>

      <div
        className={`w-full ${
          theme === "light"
            ? "bg-gray-100 border-gray-200"
            : "bg-[#0d0d0d] border-white/10"
        } rounded-[32px] border p-8 font-mono text-[12px] md:text-base overflow-hidden h-56 relative`}
      >
        <div className="flex items-center gap-2 mb-4">
          <div className="flex gap-1.5">
            <span className="w-3 h-3 rounded-full bg-red-500/80" />
            <span className="w-3 h-3 rounded-full bg-amber-500/80" />
            <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
          </div>
          <span className="text-xs font-mono text-gray-500 ml-2">
            {isComplete
              ? "Process complete"
              : allImagesCompleted
                ? "Finalizing results..."
                : "Processing..."}
          </span>
        </div>
        <div
          ref={containerRef}
          className="space-y-3 overflow-y-auto h-[calc(100%-2rem)] pr-4 scrollbar-hide"
        >
          {logs.map((log, i) => (
            <div
              key={i}
              className="flex gap-4 opacity-90"
            >
              <span className="text-gray-500 shrink-0">
                [{String(i + 1).padStart(3, "0")}]
              </span>
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
            <div className="flex gap-4 text-amber-500/80">
              <span className="shrink-0">▌</span>
              <span className={allImagesCompleted ? "" : "animate-pulse"}>
                {allImagesCompleted ? "Retrieving results..." : "waiting..."}
              </span>
            </div>
          )}
          {error && (
            <div className="flex gap-4 text-red-500 font-bold">
              <span className="shrink-0">!</span>
              <span>{error}</span>
            </div>
          )}
        </div>
        <div
          className={`absolute bottom-0 left-0 right-0 h-16 ${
            theme === "light"
              ? "bg-gradient-to-t from-gray-100"
              : "bg-gradient-to-t from-[#0d0d0d]"
          } to-transparent pointer-events-none`}
        />
      </div>

      {(error ||
        (resultsCount > 0 &&
          (streamComplete ||
            effectiveCompletedCount >= totalImages ||
            resultsCount >= totalImages))) && (
        <div className="flex justify-center gap-3 mt-6">
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
