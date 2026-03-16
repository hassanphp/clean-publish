"use client";

import { useEffect, useRef } from "react";

interface ProcessingTerminalProps {
  logs: string[];
  isComplete: boolean;
  allImagesCompleted?: boolean; // true when progress is 100% but stream not yet complete
  error?: string;
}

export function ProcessingTerminal({ logs, isComplete, allImagesCompleted, error }: ProcessingTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="w-full rounded-2xl overflow-hidden border border-zinc-700/50 bg-zinc-950 shadow-2xl">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800 bg-zinc-900/80">
        <div className="flex gap-1.5">
          <span className="w-3 h-3 rounded-full bg-red-500/80" />
          <span className="w-3 h-3 rounded-full bg-amber-500/80" />
          <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
        </div>
        <span className="text-xs font-mono text-zinc-500 ml-2">
          {isComplete ? "Process complete" : allImagesCompleted ? "Finalizing results..." : "Processing..."}
        </span>
      </div>
      <div
        ref={containerRef}
        className="h-64 overflow-y-auto p-4 font-mono text-sm"
      >
        <div className="space-y-1.5">
          {logs.map((log, i) => (
            <div
              key={i}
              className="flex gap-3 text-zinc-300"
            >
              <span className="shrink-0 text-zinc-600">
                [{String(i + 1).padStart(3, "0")}]
              </span>
              <span
                className={
                  log.includes("FAIL") || log.includes("error")
                    ? "text-red-400 font-medium"
                    : log.includes("Completed") || log.includes("→")
                    ? "text-emerald-400"
                    : "text-zinc-300"
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
            <div className="flex gap-3 text-red-400 font-medium mt-2">
              <span className="shrink-0">!</span>
              <span>{error}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
