"use client";

import { useCallback, useRef } from "react";

const IMAGE_ACCEPT =
  "image/jpeg,image/png,image/gif,image/webp,image/avif,image/bmp,image/tiff,image/x-icon,image/heic,.jpg,.jpeg,.png,.gif,.webp,.avif,.bmp,.tiff,.tif,.ico,.heic";

const IMAGE_EXTENSIONS = new Set([
  "jpg", "jpeg", "png", "gif", "webp", "avif", "bmp", "tiff", "tif", "ico", "heic",
]);

function isImageFile(file: File): boolean {
  if (file.type.startsWith("image/")) return true;
  const ext = file.name.split(".").pop()?.toLowerCase();
  return ext ? IMAGE_EXTENSIONS.has(ext) : false;
}

export interface ImageMetadata {
  view_category: string;
}

interface DropZoneProps {
  images?: string[];
  onImagesChange: (base64Images: string[]) => void;
  imageMetadata?: Record<number, ImageMetadata>;
  analyzing?: boolean;
  disabled?: boolean;
}

export function DropZone({ images = [], onImagesChange, imageMetadata, analyzing, disabled }: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const safeImages = images ?? [];

  const processFiles = useCallback(
    async (files: FileList | File[], append: boolean) => {
      const fileArray = Array.from(files).filter(isImageFile);
      if (fileArray.length === 0) return;

      const base64List: string[] = append ? [...safeImages] : [];
      for (const file of fileArray) {
        const b64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
          reader.readAsDataURL(file);
        });
        base64List.push(b64);
      }
      onImagesChange(base64List);
    },
    [safeImages, onImagesChange]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (disabled) return;
      processFiles(e.dataTransfer.files, safeImages.length > 0);
    },
    [disabled, processFiles, safeImages.length]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files) processFiles(files, safeImages.length > 0);
      e.target.value = "";
    },
    [processFiles, safeImages.length]
  );

  const handleAddMore = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      inputRef.current?.click();
    },
    []
  );

  const handleRemove = useCallback(
    (index: number) => (e: React.MouseEvent) => {
      e.stopPropagation();
      const next = safeImages.filter((_, i) => i !== index);
      onImagesChange(next);
    },
    [safeImages, onImagesChange]
  );

  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onImagesChange([]);
    },
    [onImagesChange]
  );

  return (
    <div className="w-full">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        className={`
          relative rounded-2xl border-2 border-dashed transition-all duration-200
          ${disabled ? "opacity-50 cursor-not-allowed border-zinc-700/30" : "border-zinc-600/50 bg-zinc-900/30 hover:border-amber-500/30 hover:bg-zinc-800/50 cursor-pointer"}
        `}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={IMAGE_ACCEPT}
          onChange={handleFileInput}
          disabled={disabled}
          className="hidden"
        />
        {safeImages.length === 0 ? (
          <div
            onClick={() => !disabled && inputRef.current?.click()}
            className="flex flex-col items-center justify-center py-16 px-8 text-center"
          >
            <div className="w-20 h-20 rounded-2xl bg-zinc-800 flex items-center justify-center mb-4">
              <svg
                className="w-10 h-10 text-amber-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
            <p className="text-lg font-semibold text-zinc-100 mb-1">
              Drop automotive images here
            </p>
            <p className="text-sm text-zinc-500">
              or click to browse · JPEG, PNG, WebP, AVIF, GIF, BMP, TIFF, HEIC
            </p>
          </div>
        ) : (
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-amber-500">
                {safeImages.length} image{safeImages.length !== 1 ? "s" : ""} selected
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleAddMore}
                  disabled={disabled}
                  className="text-sm font-medium text-amber-500 hover:text-amber-400 transition-colors flex items-center gap-1.5"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add more
                </button>
                <button
                  type="button"
                  onClick={handleClear}
                  disabled={disabled}
                  className="text-sm font-medium text-zinc-500 hover:text-red-400 transition-colors"
                >
                  Clear all
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
              {safeImages.map((url, i) => (
                <div
                  key={i}
                  className="group relative aspect-[4/3] rounded-xl overflow-hidden bg-zinc-900 border border-zinc-700/50"
                >
                  <img
                    src={url}
                    alt={`Preview ${i + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={handleRemove(i)}
                    disabled={disabled}
                    className="absolute top-2 right-2 w-8 h-8 rounded-full bg-red-500/90 hover:bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                    title="Remove"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                  <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/60 text-xs font-medium text-white">
                    #{i + 1}
                  </span>
                  {(analyzing && !imageMetadata?.[i]) ? (
                    <span className="absolute top-2 left-2 px-2 py-1 rounded-lg text-[10px] font-medium bg-zinc-700/90 text-zinc-300">
                      Analyzing...
                    </span>
                  ) : imageMetadata?.[i] ? (
                    <span className="absolute top-2 left-2 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-amber-500/90 text-zinc-950">
                      {imageMetadata[i].view_category}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
