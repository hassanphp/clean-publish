"use client";

import { useState } from "react";
import type { CameraAngle } from "@/types/create";
import { Camera, Loader2 } from "lucide-react";
import { useLazyGetUploadUrlQuery, useGetMeQuery } from "@/lib/store/apiSlice";
import { ImageUploadZone } from "@/components/ui/ImageUploadZone";

interface CreateUploadChoiceProps {
  onUploadComplete: (images: { angle: CameraAngle; data: string }[]) => void;
  onBack: () => void;
  t: Record<string, string>;
  theme: "light" | "dark";
}

/** Use object_url from API when available; else strip query params for GCS. */
function getObjectUrl(data: { object_url?: string; upload_url?: string; filename?: string }): string {
  if (data?.object_url) return data.object_url;
  try {
    const u = new URL(data?.upload_url || "");
    if (u.hostname.includes("storage.googleapis.com")) {
      u.search = "";
      return u.toString();
    }
  } catch {
    /* ignore */
  }
  return data?.upload_url || "";
}

export function CreateUploadChoice({
  onUploadComplete,
  onBack,
  t,
  theme,
}: CreateUploadChoiceProps) {
  const { data: user } = useGetMeQuery(undefined, { skip: typeof window === "undefined" });
  const [getUploadUrl] = useLazyGetUploadUrlQuery();
  const [uploading, setUploading] = useState(false);

  const processFiles = async (fileList: File[]) => {
    if (!fileList.length) return;
    setUploading(true);
    const results: { angle: CameraAngle; data: string }[] = [];

    if (user) {
      try {
        for (let i = 0; i < fileList.length; i++) {
          const file = fileList[i];
          const ext = file.name.split(".").pop() || "jpg";
          const filename = `uploads/${crypto.randomUUID()}_${i}.${ext}`;
          const { data } = await getUploadUrl({
            filename,
            content_type: file.type || "image/jpeg",
          });
          if (data?.upload_url) {
            const putRes = await fetch(data.upload_url, {
              method: "PUT",
              body: file,
              headers: { "Content-Type": file.type || "image/jpeg" },
            });
            if (putRes.ok) {
              results.push({ angle: "AUTO", data: getObjectUrl(data) });
            } else {
              throw new Error("Upload failed");
            }
          } else {
            throw new Error("No upload URL");
          }
        }
        if (results.length === fileList.length) {
          setUploading(false);
          onUploadComplete(results);
          return;
        }
      } catch {
        /* fall through to base64 - clear any partial S3 results */
        results.length = 0;
      }
    }

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => resolve(event.target?.result as string);
        reader.readAsDataURL(file);
      });
      results.push({ angle: "AUTO", data: base64 });
    }
    setUploading(false);
    onUploadComplete(results);
  };

  return (
    <div className="w-full h-full flex flex-col justify-center py-6 px-4">
      <header className="mb-20 text-center">
        <h2 className="text-3xl md:text-5xl font-black mb-4 text-[var(--foreground)] tracking-tight">
          {t.howToProceed}
        </h2>
        <p className="text-gray-500 text-base md:text-lg font-medium">
          {t.uploadSubtitle}
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-24 mb-20">
        <div
          className={`rounded-[48px] border-2 bg-[var(--card)] border-[var(--border)] shadow-lg overflow-hidden transition-all ${
            uploading ? "opacity-60 pointer-events-none" : "hover:border-blue-500 hover:shadow-2xl"
          }`}
        >
          <ImageUploadZone
            onFilesSelected={processFiles}
            accept="image/*"
            maxFiles={20}
            maxSizeMB={10}
            disabled={uploading}
            theme={theme}
            className="p-8"
          />
          {uploading && (
            <div className="flex items-center justify-center gap-2 pb-6 text-sm text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              Uploading...
            </div>
          )}
        </div>

        <div
          className={`flex flex-col items-center p-12 rounded-[48px] border-2 bg-[var(--card)] border-[var(--border)] opacity-60 cursor-not-allowed`}
        >
          <div
            className={`w-28 h-28 rounded-[2rem] flex items-center justify-center mb-10 ${theme === "light" ? "bg-gray-100" : "bg-white/5"}`}
          >
            <Camera
              className={`w-14 h-14 ${theme === "light" ? "text-gray-400" : "text-gray-500"}`}
            />
          </div>
          <h3
            className={`text-3xl font-black mb-4 ${theme === "light" ? "text-slate-600" : "text-gray-400"}`}
          >
            {t.takePhotos}
          </h3>
          <p
            className={`text-center leading-relaxed font-medium max-w-[280px] ${theme === "light" ? "text-slate-400" : "text-gray-500"}`}
          >
            {t.takePhotosDesc}
          </p>
          <span className="mt-2 text-xs font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400">
            Coming Soon
          </span>
        </div>
      </div>

      <div className="flex justify-center">
        <button
          onClick={onBack}
          className="flex items-center gap-3 px-10 py-5 rounded-2xl font-black text-sm uppercase tracking-widest transition-all text-gray-500 hover:text-[var(--foreground)] hover:bg-[var(--card)]"
        >
          ← {t.backToStudio}
        </button>
      </div>
    </div>
  );
}
