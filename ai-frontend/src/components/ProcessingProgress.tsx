"use client";

import type { ProcessedResult } from "@/lib/api";

export type ImageProgressStatus = "pending" | "analyzing" | "enhancing" | "completed" | "failed";

interface ProcessingProgressProps {
  totalImages: number;
  logs: string[];
  completedCount: number;
  results?: ProcessedResult[];
  error?: string;
}

function parseImageStatuses(logs: string[]): ImageProgressStatus[] {
  const statuses: ImageProgressStatus[] = [];

  for (const log of logs) {
    const analyzingMatch = log.match(/Analyzing image (\d+)/i);
    const enhancingMatch = log.match(/Enhancing (interior|exterior|detail)/i);
    const completedMatch = log.match(/Completed image (\d+)/i);
    const failedMatch = log.match(/FAILED|Edit error/i);

    if (analyzingMatch) {
      const idx = parseInt(analyzingMatch[1], 10) - 1;
      while (statuses.length <= idx) statuses.push("pending");
      statuses[idx] = "analyzing";
    }
    if (enhancingMatch) {
      const idx = statuses.findIndex((s) => s === "analyzing");
      if (idx >= 0) statuses[idx] = "enhancing";
    }
    if (completedMatch) {
      const idx = parseInt(completedMatch[1], 10) - 1;
      while (statuses.length <= idx) statuses.push("pending");
      statuses[idx] = "completed";
    }
    if (failedMatch) {
      const idx = statuses.findIndex((s) => s === "analyzing" || s === "enhancing");
      if (idx >= 0) statuses[idx] = "failed";
    }
  }

  return statuses;
}

export function ProcessingProgress({
  totalImages,
  logs,
  completedCount,
  results = [],
  error,
}: ProcessingProgressProps) {
  const parsed = parseImageStatuses(logs);
  const resultByIndex = new Map(results.map((r) => [r.index, r]));
  const effectiveCompletedCount = Math.max(completedCount, results.length);
  const hasStarted = logs.length > 0 || results.length > 0;

  const statuses = Array.from({ length: totalImages }, (_, i) => {
    const result = resultByIndex.get(i);
    if (result) {
      return !!result.processed_b64 && result.processed_b64.length > 0 ? "completed" : "failed";
    }
    if (parsed[i]) return parsed[i];
    if (i < effectiveCompletedCount) return "completed";
    return hasStarted ? "enhancing" : "pending";
  });

  const getProgress = (status: ImageProgressStatus) => {
    switch (status) {
      case "pending":
        return 0;
      case "analyzing":
        return 30;
      case "enhancing":
        return 70;
      case "completed":
        return 100;
      case "failed":
        return 0;
      default:
        return 0;
    }
  };

  const getLabel = (status: ImageProgressStatus) => {
    switch (status) {
      case "pending":
        return "Waiting";
      case "analyzing":
        return "Analyzing";
      case "enhancing":
        return "Enhancing";
      case "completed":
        return "Done";
      case "failed":
        return "Failed";
      default:
        return "—";
    }
  };

  const overallProgress =
    totalImages > 0 ? (effectiveCompletedCount / totalImages) * 100 : 0;

  return (
    <div className="w-full rounded-2xl overflow-hidden border border-zinc-700/50 bg-zinc-900/50">
      <div className="px-6 py-4 border-b border-zinc-800">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-zinc-400">Overall progress</span>
          <span className="text-sm font-bold text-amber-500">
            {effectiveCompletedCount} / {totalImages} images
          </span>
        </div>
        <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-amber-500 transition-all duration-500 ease-out"
            style={{ width: `${overallProgress}%` }}
          />
        </div>
      </div>
      <div className="p-6 space-y-4">
        {statuses.map((status, i) => {
          const result = resultByIndex.get(i);
          const procSrc =
            result?.processed_b64 && result.processed_b64.length > 0
              ? result.processed_b64.startsWith("data:")
                ? result.processed_b64
                : `data:image/jpeg;base64,${result.processed_b64}`
              : null;
          return (
            <div key={i} className="flex items-center gap-4">
              <div className="w-16 h-12 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0 overflow-hidden">
                <span className="text-xs font-bold text-zinc-500">#{i + 1}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`text-xs font-medium ${
                      status === "completed"
                        ? "text-emerald-400"
                        : status === "failed"
                        ? "text-red-400"
                        : "text-zinc-400"
                    }`}
                  >
                    {getLabel(status)}
                  </span>
                  <span className="text-xs text-zinc-600">
                    {getProgress(status)}%
                  </span>
                </div>
                <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${
                      status === "completed"
                        ? "bg-emerald-500"
                        : status === "failed"
                        ? "bg-red-500"
                        : "bg-amber-500"
                    }`}
                    style={{ width: `${getProgress(status)}%` }}
                  />
                </div>
              </div>
              {procSrc ? (
                <div className="w-16 h-12 rounded-lg overflow-hidden shrink-0 border border-zinc-700 bg-zinc-800">
                  <img
                    src={procSrc}
                    alt={`Result ${i + 1}`}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : status === "failed" ? (
                <div className="w-16 h-12 rounded-lg shrink-0 border border-red-500/30 bg-red-500/10 flex items-center justify-center">
                  <span className="text-[10px] font-medium text-red-400">Failed</span>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      {error && (
        <div className="px-6 pb-4">
          <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-2 text-sm text-red-400">
            {error}
          </div>
        </div>
      )}
    </div>
  );
}
