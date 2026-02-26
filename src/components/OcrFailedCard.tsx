"use client";

import { useEffect, useState } from "react";

export interface OcrFailedCardProps {
  id?: string;
  previewFile: File | null;
  isReplacing: boolean;
  onTryAgain: () => void;
  onUploadClearer: () => void;
  onEnterManually: () => void;
  onSkip: () => void;
}

export function OcrFailedCard({
  id,
  previewFile,
  isReplacing,
  onTryAgain,
  onUploadClearer,
  onEnterManually,
  onSkip,
}: OcrFailedCardProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState(false);
  useEffect(() => {
    if (!previewFile) {
      setPreviewUrl(null);
      setPreviewError(false);
      return;
    }
    setPreviewError(false);
    const url = URL.createObjectURL(previewFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [previewFile]);

  return (
    <section
      id={id}
      className="animate-error-card-in rounded-[20px] p-6 depth-1"
      style={{
        background: "linear-gradient(180deg, #FFE5E5 0%, #FFF0F0 100%)",
      }}
      role="alert"
      aria-live="assertive"
    >
      <div className="flex flex-col gap-5">
        <div className="flex items-start gap-4">
          <span
            className="animate-error-warning-pulse flex h-12 w-12 shrink-0 items-center justify-center text-[48px] leading-none text-[#FF3B30]"
            aria-hidden
          >
            ⚠
          </span>
          <div>
            <h2 className="text-[20px] font-semibold text-[#1C1C1E]">
              Couldn&apos;t read this label
            </h2>
            <p className="mt-2 text-[16px] text-[#8E8E93]">
              The image quality may be too low, or the text might be unclear.
            </p>
          </div>
        </div>
        {previewUrl && !previewError ? (
          <div className="flex justify-center">
            <img
              src={previewUrl}
              alt=""
              className="h-[120px] rounded-[16px] border border-[#E5E5EA] bg-white object-contain"
              onError={() => setPreviewError(true)}
            />
          </div>
        ) : previewFile ? (
          <div className="flex items-center justify-center rounded-[16px] border border-[#E5E5EA] bg-[#F2F2F7] p-6">
            <img src="/placeholder-preview.png" alt="" className="max-h-[100px] max-w-full object-contain opacity-70" aria-hidden />
          </div>
        ) : null}
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={onTryAgain}
            disabled={isReplacing}
            className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-[16px] px-4 py-3 text-[16px] font-semibold text-white depth-2 transition-opacity hover:opacity-95 disabled:opacity-60"
            style={{
              background:
                "linear-gradient(180deg, #007AFF 0%, #0051D5 100%)",
              boxShadow: "0 4px 12px rgba(0, 122, 255, 0.25)",
            }}
          >
            {isReplacing ? (
              <>
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Retrying...
              </>
            ) : (
              "Try again"
            )}
          </button>
          <button
            type="button"
            onClick={onUploadClearer}
            disabled={isReplacing}
            className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-[16px] border-2 border-[#E5E5EA] bg-white px-4 py-3 text-[16px] font-semibold text-[#1C1C1E] transition-all duration-200 active:scale-[0.98] hover:scale-[1.02] disabled:opacity-60"
          >
            Upload a clearer photo
          </button>
          <button
            type="button"
            onClick={onEnterManually}
            className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-[16px] border-2 border-[#E5E5EA] bg-white px-4 py-3 text-[16px] font-semibold text-[#1C1C1E] transition-all duration-200 active:scale-[0.98] hover:scale-[1.02]"
          >
            Enter fields manually
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="min-h-[44px] text-[16px] font-normal text-[#8E8E93] hover:text-[#1C1C1E]"
          >
            Skip this label
          </button>
        </div>
      </div>
    </section>
  );
}
