"use client";

import { useRef } from "react";

export interface StudioOption {
  id: string;
  src: string;
  label: string;
}

const STUDIOS: StudioOption[] = [
  { id: "studio-1", src: "/studios/studio-1.png", label: "White cyclorama" },
  { id: "studio-2", src: "/studios/studio-2.png", label: "Dark floor studio" },
  { id: "studio-3", src: "/studios/studio-3.png", label: "Grey infinity wall" },
  { id: "studio-4", src: "/studios/studio-4.png", label: "High-key white" },
  { id: "studio-5", src: "/studios/studio-5.png", label: "Light grey seamless studio" },
  { id: "studio-6", src: "/studios/studio-6.png", label: "White cyclorama with markings" },
  { id: "studio-7", src: "/studios/studio-7.png", label: "Dark grey concrete studio" },
  { id: "studio-8", src: "/studios/studio-8.png", label: "Dark studio with glowing floor" },
  { id: "studio-9", src: "/studios/studio-9.png", label: "White marble studio" },
  { id: "studio-10", src: "/studios/studio-10.png", label: "All-white cyclorama" },
  { id: "studio-11", src: "/studios/studio-11.png", label: "White curved studio with glow" },
  { id: "studio-12", src: "/studios/studio-12.png", label: "Light grey floor white wall" },
  { id: "studio-13", src: "/studios/studio-13.png", label: "Dark circular floor studio" },
  { id: "studio-14", src: "/studios/studio-14.png", label: "Dark floor light wall" },
  { id: "studio-15", src: "/studios/studio-15.png", label: "Medium grey seamless studio" },
  { id: "studio-16", src: "/studios/studio-16.png", label: "Light grey detail floor" },
  { id: "studio-17", src: "/studios/studio-17.png", label: "Grey concrete cyclorama" },
];

interface StudioSelectorProps {
  selectedId: string | null;
  onSelect: (id: string | null, base64: string | null) => void;
  /** Optional dealer studio - when set, shows "My studio" option */
  dealerStudio?: { dataUri: string; label: string } | null;
}

export function StudioSelector({ selectedId, onSelect, dealerStudio }: StudioSelectorProps) {
  const fetchInProgressRef = useRef<string | null>(null);

  const handleClick = (studio: StudioOption) => {
    const newId = selectedId === studio.id ? null : studio.id;

    if (!newId) {
      fetchInProgressRef.current = null;
      onSelect(null, null);
      return;
    }

    fetchInProgressRef.current = studio.id;
    onSelect(newId, null);
    fetch(studio.src)
      .then((res) => res.blob())
      .then((blob) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (fetchInProgressRef.current === studio.id) {
            onSelect(studio.id, reader.result as string);
          }
        };
        reader.readAsDataURL(blob);
      });
  };

  const handleDealerStudioClick = () => {
    if (!dealerStudio) return;
    const newId = selectedId === "dealer-studio" ? null : "dealer-studio";
    if (!newId) {
      onSelect(null, null);
      return;
    }
    onSelect("dealer-studio", dealerStudio.dataUri);
  };

  const studiosToShow = [...STUDIOS];
  if (dealerStudio) {
    studiosToShow.unshift({
      id: "dealer-studio",
      src: dealerStudio.dataUri,
      label: dealerStudio.label,
    });
  }

  return (
    <div className="w-full">
      <p className="mb-3 text-sm font-medium text-zinc-400">
        Select one studio — AI will extract environment, lighting & angle
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {studiosToShow.map((studio) => {
          const isSelected = selectedId === studio.id;
          return (
            <button
              key={studio.id}
              type="button"
              onClick={() =>
                studio.id === "dealer-studio" ? handleDealerStudioClick() : handleClick(studio)
              }
              className={`
                group relative aspect-[4/3] rounded-xl overflow-hidden border-2 transition-all
                focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-zinc-950
                ${isSelected
                  ? "border-amber-500 ring-2 ring-amber-500/30 shadow-lg shadow-amber-500/20"
                  : "border-zinc-700/50 hover:border-zinc-600 bg-zinc-900/30"
                }
              `}
            >
              <img
                src={studio.src}
                alt={studio.label}
                className="w-full h-full object-cover"
              />
              <div
                className={`
                  absolute inset-0 flex items-center justify-center transition-opacity
                  ${isSelected ? "bg-amber-500/20" : "bg-black/0 group-hover:bg-black/30"}
                `}
              >
                {isSelected && (
                  <div className="w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center">
                    <svg
                      className="w-5 h-5 text-zinc-950"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                )}
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                <span className="text-xs font-medium text-white truncate block">
                  {studio.label}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export { STUDIOS };
