"use client";

import { useCallback, useRef } from "react";

const IMAGE_ACCEPT = "image/jpeg,image/png,.jpg,.jpeg,.png";

function isImageFile(file: File): boolean {
  if (file.type.startsWith("image/")) return true;
  const ext = file.name.split(".").pop()?.toLowerCase();
  return ["jpg", "jpeg", "png"].includes(ext ?? "");
}

interface StudioReferenceUploadProps {
  value: string | null;
  onChange: (dataUri: string | null) => void;
  disabled?: boolean;
}

export function StudioReferenceUpload({ value, onChange, disabled }: StudioReferenceUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(
    async (file: File) => {
      if (!isImageFile(file)) return;
      const dataUri = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsDataURL(file);
      });
      onChange(dataUri);
    },
    [onChange]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (disabled) return;
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [disabled, processFile]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
      e.target.value = "";
    },
    [processFile]
  );

  const handleClear = useCallback(() => {
    onChange(null);
    inputRef.current?.value && (inputRef.current.value = "");
  }, [onChange]);

  return (
    <div className="space-y-2">
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => !disabled && inputRef.current?.click()}
        className={`
          relative flex aspect-[4/3] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition-all
          ${value ? "border-amber-500/50 bg-amber-500/5" : "border-zinc-600 bg-zinc-900/50 hover:border-zinc-500"}
          ${disabled ? "cursor-not-allowed opacity-60" : ""}
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept={IMAGE_ACCEPT}
          onChange={handleFileInput}
          className="hidden"
        />
        {value ? (
          <>
            <img
              src={value}
              alt="Studio reference"
              className="h-full w-full object-cover rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleClear();
              }}
              className="absolute top-2 right-2 rounded-full bg-zinc-800/90 px-2 py-1 text-xs font-medium text-zinc-300 hover:bg-zinc-700 hover:text-white"
            >
              Remove
            </button>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 text-zinc-500">
            <svg className="h-10 w-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-sm">Drop studio image or click to upload</span>
            <span className="text-xs">JPG or PNG</span>
          </div>
        )}
      </div>
    </div>
  );
}
