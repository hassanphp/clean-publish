"use client";

import { useState, useRef, useEffect } from "react";
import type { ProcessedResult, ModelInfo } from "@/lib/api";
import { regenerateImage } from "@/lib/api";

interface ResultsGridProps {
  results: ProcessedResult[];
  pipelineVersion?: string;
  targetStudioDescription?: string;
  studioReferenceDataUri?: string | null;
  onResultUpdate?: (updated: ProcessedResult) => void;
}

const AVAILABLE_MODELS: { value: "fal" | "replicate" | "vertex"; label: string }[] = [
  { value: "fal", label: "Alternative 1" },
  { value: "replicate", label: "Alternative 2" },
  { value: "vertex", label: "Alternative 3" },
];

function downloadImage(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

export function ResultsGrid({
  results,
  pipelineVersion = "11",
  targetStudioDescription = "",
  studioReferenceDataUri = null,
  onResultUpdate,
}: ResultsGridProps) {
  if (results.length === 0) return null;

  return (
    <div className="w-full space-y-10">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-zinc-100">
            Compare Results
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            {results.length} image{results.length !== 1 ? "s" : ""} processed · Original (left) ↔ Enhanced (right) — drag to compare
          </p>
        </div>
      </div>
      <div className="space-y-12">
        {results.map((r) => (
          <ResultCard
            key={r.index}
            result={r}
            pipelineVersion={pipelineVersion}
            targetStudioDescription={targetStudioDescription}
            studioReferenceDataUri={studioReferenceDataUri}
            onResultUpdate={onResultUpdate}
          />
        ))}
      </div>
    </div>
  );
}

function ResultCard({
  result,
  pipelineVersion,
  targetStudioDescription,
  studioReferenceDataUri,
  onResultUpdate,
}: {
  result: ProcessedResult;
  pipelineVersion: string;
  targetStudioDescription: string;
  studioReferenceDataUri: string | null;
  onResultUpdate?: (updated: ProcessedResult) => void;
}) {
  const [viewMode, setViewMode] = useState<"slider" | "side-by-side">("slider");
  const [displayResult, setDisplayResult] = useState<ProcessedResult>(result);
  const [regenerating, setRegenerating] = useState(false);
  const [regenerateError, setRegenerateError] = useState<string | null>(null);

  useEffect(() => {
    setDisplayResult(result);
  }, [result]);

  const meta = displayResult.metadata ?? {};
  const viewCategory = meta.view_category ?? "exterior";
  const viewLabel =
    viewCategory.charAt(0).toUpperCase() + viewCategory.slice(1);
  const origSrc = (() => {
    const o = displayResult.original_b64 || "";
    if (o.startsWith("data:")) return o;
    if (o.startsWith("http://") || o.startsWith("https://")) return o;
    return `data:image/jpeg;base64,${o}`;
  })();
  const hasProcessed = !!displayResult.processed_b64 && displayResult.processed_b64.length > 0;
  const procSrc = hasProcessed
    ? (() => {
        const p = displayResult.processed_b64!;
        if (p.startsWith("data:")) return p;
        if (p.startsWith("http://") || p.startsWith("https://")) return p;
        return `data:image/jpeg;base64,${p}`;
      })()
    : null;

  const canRegenerate =
    hasProcessed &&
    targetStudioDescription &&
    ["1", "2", "3", "4", "10", "11"].includes(pipelineVersion);

  const handleRegenerate = async (model: "fal" | "replicate" | "vertex") => {
    if (!canRegenerate || !targetStudioDescription) return;
    setRegenerating(true);
    setRegenerateError(null);
    try {
      const origB64 =
        displayResult.original_b64?.startsWith("data:")
          ? displayResult.original_b64
          : `data:image/jpeg;base64,${displayResult.original_b64 || ""}`;
      const res = await regenerateImage({
        original_b64: origB64,
        metadata: meta,
        pipeline_version: pipelineVersion,
        target_studio_description: targetStudioDescription,
        model,
        studio_reference_data_uri: studioReferenceDataUri || undefined,
      });
      const updated: ProcessedResult = {
        ...displayResult,
        processed_b64: res.processed_b64,
        model_info: res.model_info ?? undefined,
      };
      setDisplayResult(updated);
      onResultUpdate?.(updated);
    } catch (e) {
      setRegenerateError(e instanceof Error ? e.message : "Regeneration failed");
    } finally {
      setRegenerating(false);
    }
  };

  const [sliderPosition, setSliderPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMove = (clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    setSliderPosition(x);
  };

  const handleMouseDown = () => setIsDragging(true);
  const handleMouseUp = () => setIsDragging(false);
  const handleTouchStart = () => setIsDragging(true);
  const handleTouchEnd = () => setIsDragging(false);

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

  return (
    <div className="rounded-2xl overflow-hidden border border-zinc-700/50 bg-zinc-900/50 shadow-xl">
      <div className="p-4 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-zinc-500">Image #{displayResult.index + 1}</span>
          <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
            {viewLabel}
          </span>
          {(meta.dominant_color && meta.dominant_color !== "unknown") && (
            <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-zinc-800 text-zinc-400">
              {meta.dominant_color}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 rounded-lg bg-zinc-800 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("slider")}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                viewMode === "slider" ? "bg-zinc-700 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Slider
            </button>
            <button
              type="button"
              onClick={() => setViewMode("side-by-side")}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                viewMode === "side-by-side" ? "bg-zinc-700 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Side by side
            </button>
          </div>
          <button
            type="button"
            onClick={() => downloadImage(origSrc, `original-${displayResult.index + 1}.png`)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 transition-colors"
          >
            Download Original
          </button>
          <button
            type="button"
            onClick={() => procSrc && downloadImage(procSrc, `enhanced-${displayResult.index + 1}.png`)}
            disabled={!procSrc}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 border border-amber-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Download Enhanced
          </button>
          {canRegenerate && (
            <div className="relative group">
              <select
                onChange={(e) => {
                  const v = e.target.value as "fal" | "replicate" | "vertex";
                  if (v) handleRegenerate(v);
                  e.target.value = "";
                }}
                disabled={regenerating}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed pr-8"
              >
                <option value="">Regenerate with…</option>
                {AVAILABLE_MODELS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
              {regenerating && (
                <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-zinc-900/80 text-xs text-zinc-400">
                  …
                </span>
              )}
            </div>
          )}
        </div>
      </div>
      {regenerateError && (
        <div className="px-4 py-2 text-xs text-red-400 bg-red-500/10 border-b border-zinc-800">
          {regenerateError}
        </div>
      )}

      {/* Compare view: Slider or Side-by-side */}
      {viewMode === "side-by-side" ? (
        <div className="grid grid-cols-2 gap-px bg-zinc-800">
          <div className="relative aspect-[4/3] bg-zinc-950 p-2">
            <img
              src={origSrc}
              alt={`Original ${displayResult.index + 1}`}
              className="w-full h-full object-contain"
              draggable={false}
            />
            <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/60 text-[10px] font-bold uppercase text-zinc-400">
              Original
            </div>
          </div>
          <div className="relative aspect-[4/3] bg-zinc-950 p-2 ring-1 ring-amber-500/30">
            {procSrc ? (
              <img
                src={procSrc}
                alt={`Enhanced ${displayResult.index + 1}`}
                className="w-full h-full object-contain"
                draggable={false}
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-zinc-900 p-4 text-center">
                <span className="text-sm font-medium text-red-400">Processing failed</span>
                {displayResult.error_message && (
                  <span className="text-xs text-zinc-500 line-clamp-3">{displayResult.error_message}</span>
                )}
              </div>
            )}
            <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-amber-500/90 text-[10px] font-bold uppercase text-zinc-950">
              Enhanced
            </div>
          </div>
        </div>
      ) : (
        <div
          ref={containerRef}
          className="relative aspect-[16/10] w-full max-h-[480px] overflow-hidden select-none cursor-col-resize"
          onMouseDown={(e) => {
            e.preventDefault();
            handleMove(e.clientX);
            handleMouseDown();
          }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div className="absolute inset-0">
            <img
              src={origSrc}
              alt={`Original ${displayResult.index + 1}`}
              className="w-full h-full object-contain bg-zinc-950"
              draggable={false}
            />
            <div className="absolute top-3 left-3 px-2 py-1 rounded bg-black/60 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
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
                alt={`Enhanced ${displayResult.index + 1}`}
                className="w-full h-full object-contain bg-zinc-950"
                draggable={false}
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-zinc-900 p-4 text-center">
                <span className="text-sm font-medium text-red-400">Processing failed</span>
                {displayResult.error_message && (
                  <span className="text-xs text-zinc-500 line-clamp-3">{displayResult.error_message}</span>
                )}
              </div>
            )}
            <div className="absolute top-3 left-3 px-2 py-1 rounded bg-amber-500/90 text-[10px] font-bold uppercase tracking-wider text-zinc-950">
              Enhanced
            </div>
          </div>
          <div
            className="absolute top-0 bottom-0 w-1 bg-white shadow-lg z-10"
            style={{ left: `${sliderPosition}%`, transform: "translateX(-50%)" }}
          >
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white shadow-xl flex items-center justify-center border-2 border-zinc-200">
              <svg className="w-4 h-4 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
              </svg>
            </div>
          </div>
        </div>
      )}

      {/* Metadata */}
      <div className="p-4 border-t border-zinc-800">
        {Array.isArray(meta.components) && meta.components.length > 0 && (
          <p className="text-xs text-zinc-500">
            <span className="font-medium text-zinc-400">Detected: </span>
            {meta.components.slice(0, 5).join(", ")}
            {meta.components.length > 5 && ` +${meta.components.length - 5}`}
          </p>
        )}
      </div>
    </div>
  );
}
