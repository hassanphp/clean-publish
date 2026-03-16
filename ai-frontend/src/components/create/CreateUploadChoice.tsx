"use client";

import type { CameraAngle } from "@/types/create";
import { Upload, Camera } from "lucide-react";
import { useLazyGetUploadUrlQuery, useGetMeQuery } from "@/lib/store/apiSlice";

interface CreateUploadChoiceProps {
  onUploadComplete: (images: { angle: CameraAngle; data: string }[]) => void;
  onBack: () => void;
  t: Record<string, string>;
  theme: "light" | "dark";
}

/** Strip query params to get clean GCS object URL. */
function cleanGcsUrl(signedUrl: string): string {
  try {
    const u = new URL(signedUrl);
    if (u.hostname.includes("storage.googleapis.com")) {
      u.search = "";
      return u.toString();
    }
  } catch {
    /* ignore */
  }
  return signedUrl;
}

export function CreateUploadChoice({
  onUploadComplete,
  onBack,
  t,
  theme,
}: CreateUploadChoiceProps) {
  const { data: user } = useGetMeQuery(undefined, { skip: typeof window === "undefined" });
  const [getUploadUrl] = useLazyGetUploadUrlQuery();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileList = Array.from(files) as File[];
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
              results.push({ angle: "AUTO", data: cleanGcsUrl(data.upload_url) });
            } else {
              throw new Error("Upload failed");
            }
          } else {
            throw new Error("No upload URL");
          }
        }
        if (results.length === fileList.length) {
          onUploadComplete(results);
          return;
        }
      } catch {
        /* fall through to base64 */
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
        <label
          className={`group flex flex-col items-center p-12 rounded-[48px] border-2 transition-all hover:translate-y-[-10px] cursor-pointer bg-[var(--card)] border-[var(--border)] shadow-lg hover:border-blue-500 hover:shadow-2xl shadow-blue-900/10`}
        >
          <input
            type="file"
            multiple
            className="hidden"
            accept="image/*"
            onChange={handleFileChange}
          />
          <div
            className={`w-28 h-28 rounded-[2rem] flex items-center justify-center mb-10 transition-all group-hover:scale-110 group-hover:-rotate-3 ${theme === "light" ? "bg-blue-50" : "bg-blue-600/10"}`}
          >
            <Upload
              className={`w-14 h-14 ${theme === "light" ? "text-blue-600" : "text-blue-500"}`}
            />
          </div>
          <h3
            className={`text-3xl font-black mb-4 ${theme === "light" ? "text-slate-900" : "text-white"}`}
          >
            {t.uploadPhotos}
          </h3>
          <p
            className={`text-center leading-relaxed font-medium max-w-[280px] ${theme === "light" ? "text-slate-500" : "text-gray-400"}`}
          >
            {t.uploadPhotosDesc}
          </p>
        </label>

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
