"use client";

import { useCallback, useState } from "react";
import { Upload, X } from "lucide-react";

export interface ImageUploadZoneProps {
  onFilesSelected: (files: File[]) => void | Promise<void>;
  accept?: string;
  maxFiles?: number;
  maxSizeMB?: number;
  disabled?: boolean;
  className?: string;
  theme?: "light" | "dark";
}

export function ImageUploadZone({
  onFilesSelected,
  accept = "image/*",
  maxFiles = 20,
  maxSizeMB = 10,
  disabled = false,
  className = "",
  theme = "dark",
}: ImageUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateFiles = useCallback(
    (files: File[]): File[] => {
      setError(null);
      const valid: File[] = [];
      const maxBytes = maxSizeMB * 1024 * 1024;
      for (let i = 0; i < Math.min(files.length, maxFiles); i++) {
        const f = files[i];
        if (!f.type.startsWith("image/")) continue;
        if (f.size > maxBytes) {
          setError(`File ${f.name} exceeds ${maxSizeMB}MB`);
          continue;
        }
        valid.push(f);
      }
      if (valid.length === 0 && files.length > 0 && !error) {
        setError("No valid images. Use JPEG, PNG, HEIC, AVIF, WebP, GIF, BMP, or TIFF under " + maxSizeMB + "MB.");
      }
      return valid;
    },
    [maxFiles, maxSizeMB]
  );

  const handleFiles = useCallback(
    async (fileList: FileList | null) => {
      if (!fileList?.length) return;
      const arr = Array.from(fileList);
      const valid = validateFiles(arr);
      if (valid.length > 0) {
        await onFilesSelected(valid);
      }
    },
    [onFilesSelected, validateFiles]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (disabled) return;
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles, disabled]
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const borderColor = isDragging
    ? "border-amber-500"
    : theme === "light"
      ? "border-slate-300 hover:border-slate-400"
      : "border-zinc-700 hover:border-zinc-600";
  const bgColor = theme === "light" ? "bg-slate-50" : "bg-zinc-900/50";

  return (
    <div className={className}>
      <label
        className={`block rounded-xl border-2 border-dashed ${borderColor} ${bgColor} p-8 transition-all cursor-pointer ${
          disabled ? "opacity-50 cursor-not-allowed" : ""
        }`}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
      >
        <input
          type="file"
          multiple
          accept={accept}
          className="hidden"
          disabled={disabled}
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <div className="flex flex-col items-center justify-center gap-3 text-center">
          <div
            className={`w-16 h-16 rounded-2xl flex items-center justify-center ${
              theme === "light" ? "bg-slate-200" : "bg-zinc-800"
            }`}
          >
            <Upload
              className={`w-8 h-8 ${theme === "light" ? "text-slate-600" : "text-zinc-400"}`}
            />
          </div>
          <div>
            <p
              className={`font-semibold ${
                theme === "light" ? "text-slate-800" : "text-zinc-200"
              }`}
            >
              Drag & drop images or click to browse
            </p>
            <p
              className={`text-sm mt-1 ${
                theme === "light" ? "text-slate-500" : "text-zinc-500"
              }`}
            >
              JPEG, PNG, HEIC, AVIF, WebP, GIF, BMP, TIFF up to {maxSizeMB}MB • Max {maxFiles} files
            </p>
          </div>
        </div>
      </label>
      {error && (
        <p className="mt-2 text-sm text-red-400 flex items-center gap-2">
          <X className="w-4 h-4" />
          {error}
        </p>
      )}
    </div>
  );
}
