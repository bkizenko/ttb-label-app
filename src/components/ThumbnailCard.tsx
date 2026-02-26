"use client";

import { useEffect, useState } from "react";

export function ThumbnailCard({
  file,
  onRemove,
  style,
}: {
  file: File;
  onRemove: () => void;
  style?: React.CSSProperties;
}) {
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    setLoadError(false);
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  const sizeMB = file.size / (1024 * 1024);
  const sizeStr =
    sizeMB >= 1
      ? `${sizeMB.toFixed(1)} MB`
      : `${(file.size / 1024).toFixed(1)} KB`;
  const dimsStr = dims ? `${dims.w}×${dims.h}` : "";

  return (
    <figure
      className="step1-thumb-in group relative flex flex-col gap-2 rounded-[20px] border border-[#E5E5EA] bg-white p-2 transition-all duration-500 hover:scale-[1.04] hover:border-[#D1D5DB] hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)]"
      style={{
        ...style,
        boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
      }}
    >
      <button
        type="button"
        aria-label={`Remove ${file.name}`}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onRemove();
        }}
        className="absolute right-2 top-2 z-10 inline-flex h-9 w-9 items-center justify-center bg-transparent"
      >
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/95 text-[14px] font-semibold leading-none text-[#1C1C1E] shadow-sm ring-1 ring-black/10 transition-transform duration-150 hover:scale-[1.02]">
          ×
        </span>
      </button>

      <div className="overflow-hidden rounded-[12px]">
        {url && !loadError ? (
          <img
            src={url}
            alt={file.name}
            className="h-[140px] w-full rounded-[12px] bg-[#FAFBFC] object-contain transition-transform duration-300 ease-out group-hover:scale-110"
            onLoad={(e) => {
              const img = e.currentTarget;
              setDims({ w: img.naturalWidth, h: img.naturalHeight });
            }}
            onError={() => setLoadError(true)}
          />
        ) : (
          <div className="flex h-[140px] w-full items-center justify-center rounded-[12px] bg-[#F2F2F7] p-2">
            <img src="/placeholder-preview.png" alt="" className="h-full w-full max-h-[120px] max-w-full object-contain opacity-70" aria-hidden />
          </div>
        )}
      </div>
      <figcaption className="truncate text-[16px] font-medium text-[#1C1C1E]">
        {file.name}
      </figcaption>
      <p className="text-[14px] text-[#8E8E93]">
        {sizeStr}
        {dimsStr ? ` • ${dimsStr}` : ""}
      </p>
    </figure>
  );
}
