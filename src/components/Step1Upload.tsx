"use client";

import { ThumbnailCard } from "@/components/ThumbnailCard";

export interface Step1UploadProps {
  error: string | null;
  uploadFileTypeError: string | null;
  fileList: File[];
  onFilesSelected: (files: FileList | null) => void;
  onRemoveFile: (key: string) => void;
  onClearAll: () => void;
  onNext: () => void;
}

export function Step1Upload({
  error,
  uploadFileTypeError,
  fileList,
  onFilesSelected,
  onRemoveFile,
  onClearAll,
  onNext,
}: Step1UploadProps) {
  return (
    <main className="flex flex-col gap-10">
      {error ? (
        <div className="rounded-[20px] border border-[#FF3B30]/30 bg-red-50 px-4 py-3 text-[16px] text-[#FF3B30] depth-1">
          {error}
        </div>
      ) : null}

      {uploadFileTypeError ? (
        <div
          className="animate-error-shake flex items-center gap-3 rounded-[20px] border border-[#FF3B30]/20 bg-[#FFE5E5] px-4 py-3 depth-1"
          role="alert"
          aria-live="polite"
        >
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#FF3B30] text-sm font-bold text-white"
            aria-hidden
          >
            ×
          </span>
          <p className="text-[15px] font-semibold text-[#1C1C1E]">
            {uploadFileTypeError}
          </p>
        </div>
      ) : null}

      <section
        className="overflow-hidden rounded-[20px] bg-white p-8"
        style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}
      >
        <label
          className={`step1-upload-zone-in flex min-h-[400px] cursor-pointer flex-col items-center justify-center rounded-[20px] px-4 py-10 text-center transition-all duration-500 hover:scale-[1.02] ${
            fileList.length
              ? "border-2 border-[#30D158] border-solid bg-[#F0FDF4] hover:border-[#30D158]"
              : "border-[3px] border-dashed border-[#D1D5DB] bg-gradient-to-b from-white to-[#FAFBFC] hover:border-[#9CA3AF]"
          }`}
        >
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => onFilesSelected(e.target.files)}
          />
          {fileList.length ? (
            <span className="mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-[#30D158]/20 text-2xl text-[#30D158]">
              ✓
            </span>
          ) : (
            <span
              className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl text-5xl"
              style={{
                background: "linear-gradient(180deg, #007AFF 0%, #0051D5 100%)",
                color: "white",
              }}
            >
              📸
            </span>
          )}
          <span className="text-[22px] font-semibold text-[#1C1C1E]">
            {fileList.length
              ? `${fileList.length} label${fileList.length > 1 ? "s" : ""} selected`
              : "Select label images"}
          </span>
          <span
            className="mt-2 text-[14px] text-[#8E8E93]"
            style={{ opacity: 0.6 }}
          >
            {fileList.length
              ? "Tap the area again to add more"
              : "Tap to choose from your files"}
          </span>
        </label>

        {fileList.length ? (
          <div className="mt-6 space-y-4">
            <p className="text-[16px] font-semibold text-[#1C1C1E]">
              {fileList.length === 1
                ? "1 label selected"
                : `${fileList.length} labels selected`}
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {fileList.map((file, index) => (
                <ThumbnailCard
                  key={`${file.name}-${file.lastModified}`}
                  file={file}
                  onRemove={() =>
                    onRemoveFile(`${file.name}-${file.lastModified}`)
                  }
                  style={{ animationDelay: `${index * 60}ms` }}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={onClearAll}
              className="min-h-[44px] rounded-[16px] border border-[#FF3B30]/30 bg-white px-4 py-2.5 text-[16px] font-semibold text-[#FF3B30] transition-all duration-500 hover:scale-[0.98] hover:bg-red-50 active:scale-[0.97]"
              style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}
            >
              <span aria-hidden>🗑</span> Clear all
            </button>
          </div>
        ) : null}
      </section>

      <div className="w-full sm:flex sm:justify-end">
        <button
          type="button"
          disabled={!fileList.length}
          onClick={onNext}
          className="w-full min-h-[56px] rounded-[16px] px-6 py-4 text-[16px] font-semibold text-white transition-all duration-500 hover:scale-[1.02] active:scale-[0.97] disabled:opacity-50 disabled:grayscale disabled:hover:scale-100 sm:w-auto"
          style={{
            background: "linear-gradient(180deg, #007AFF 0%, #0051D5 100%)",
            boxShadow: "0 4px 16px rgba(0, 0, 0, 0.08)",
          }}
        >
          Next: Add application data
        </button>
      </div>
      <p className="pt-6 text-center text-[13px] text-[#8E8E93]">
        We encourage you to review TTB&apos;s guidelines at{" "}
        <a
          href="https://www.ttb.gov"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-[#1C1C1E]"
        >
          ttb.gov
        </a>{" "}
        for additional context on label requirements.
      </p>
    </main>
  );
}
