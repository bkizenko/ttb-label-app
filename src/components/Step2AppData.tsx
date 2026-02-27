"use client";

import { useEffect, useState } from "react";
import type { ApplicationLabelData } from "@/lib/labelComparison";

export interface Step2AppDataProps {
  applicationData: ApplicationLabelData;
  setApplicationData: React.Dispatch<React.SetStateAction<ApplicationLabelData>>;
  fileList: File[];
  error: string | null;
  isProcessing: boolean;
  onBack: () => void;
  onSubmit: () => void;
  /** When true, show a dismissible demo-mode banner between the label preview and the form. */
  demoBannerVisible?: boolean;
  onDismissDemoBanner?: () => void;
}

export function Step2AppData({
  applicationData,
  setApplicationData,
  fileList,
  error,
  isProcessing,
  onBack,
  onSubmit,
  demoBannerVisible = false,
  onDismissDemoBanner,
}: Step2AppDataProps) {
  const firstFile = fileList[0];
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState(false);

  useEffect(() => {
    if (!firstFile) {
      setPreviewUrl(null);
      setPreviewError(false);
      return;
    }
    const isHeic = firstFile.name.toLowerCase().endsWith(".heic");
    if (isHeic) {
      setPreviewUrl(null);
      setPreviewError(false);
      return;
    }
    setPreviewError(false);
    const url = URL.createObjectURL(firstFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [firstFile]);

  return (
    <main className="flex flex-col gap-10">
      {error ? (
        <div className="rounded-[20px] border border-[#FF3B30]/30 bg-red-50 px-4 py-3 text-[16px] text-[#FF3B30] depth-1">
          {error}
        </div>
      ) : null}

      {firstFile ? (
        <section
          className="step2-preview-in flex h-[88px] items-center gap-4 rounded-[20px] bg-white px-4 depth-1"
          style={{ minHeight: "88px" }}
        >
          {previewUrl && !previewError ? (
            <img
              src={previewUrl}
              alt=""
              className="h-[72px] w-[72px] shrink-0 rounded-[16px] bg-[#F2F2F7] object-contain"
              onError={() => setPreviewError(true)}
            />
          ) : (
            <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-[16px] bg-[#F2F2F7] p-1.5">
              <img src="/placeholder-preview.png" alt="" className="h-full w-full object-contain opacity-70" aria-hidden />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-normal text-[#8E8E93]">
              Label image ready
            </p>
            <p className="mt-0.5 truncate text-[14px] text-[#8E8E93]">
              {fileList.length > 1
                ? `${fileList.length} labels — each compared against the application record below`
                : firstFile.name}
            </p>
          </div>
        </section>
      ) : null}

      {demoBannerVisible && onDismissDemoBanner ? (
        <div
          className="flex items-center gap-3 rounded-[10px] border-0 border-l-[3px] border-l-[#007AFF] px-4 py-3"
          style={{ backgroundColor: "#F2F2F7" }}
          role="status"
          aria-live="polite"
        >
          <p className="flex-1 text-[15px] font-medium text-[#1C1C1E]">
            Demo mode — sample data pre-filled. This is not a real submission.
          </p>
          <button
            type="button"
            onClick={onDismissDemoBanner}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[17px] text-[#1C1C1E] hover:bg-black/8 active:bg-black/12"
            aria-label="Dismiss demo banner"
          >
            ✕
          </button>
        </div>
      ) : null}

      <section
        className="overflow-hidden rounded-[20px] bg-white p-8 depth-1"
        style={{ padding: "32px" }}
      >
        <form
          className="space-y-7"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
        >
          <p
            className="text-[14px] font-semibold uppercase tracking-wider text-[#8E8E93]"
            style={{ letterSpacing: "0.5px" }}
          >
            Application record
          </p>

          <div className="step2-field-in" style={{ animationDelay: "0ms" }}>
            <label
              htmlFor="brand-name"
              className="mb-1.5 block text-[17px] font-medium text-[#8E8E93]"
            >
              Brand name
            </label>
            <div className="relative">
              <input
                id="brand-name"
                type="text"
                value={applicationData.brandName}
                onChange={(e) =>
                  setApplicationData((c) => ({
                    ...c,
                    brandName: e.target.value,
                  }))
                }
                placeholder="Enter brand name from application"
                className="input-apple h-14 w-full rounded-[16px] border border-[#E5E5EA] bg-white px-4 text-[16px] text-[#1C1C1E] placeholder:opacity-60"
                style={{ minHeight: "56px" }}
              />
              {applicationData.brandName.trim() ? (
                <span
                  className="field-checkmark-in absolute right-3 top-1/2 -translate-y-1/2 text-[#30D158]"
                  aria-hidden
                >
                  ✓
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-[15px] text-[#8E8E93]" style={{ opacity: 0.6 }}>
              Primary brand name on the approved application
            </p>
          </div>

          <div className="step2-field-in space-y-1.5">
            <label
              htmlFor="class-type"
              className="block text-[17px] font-medium text-[#8E8E93]"
            >
              Class / type
            </label>
            <input
              id="class-type"
              type="text"
              value={applicationData.classType}
              onChange={(e) =>
                setApplicationData((c) => ({ ...c, classType: e.target.value }))
              }
              placeholder="e.g., Bourbon Whiskey, IPA, Cabernet Sauvignon"
              className="input-apple h-14 w-full rounded-[16px] border border-[#E5E5EA] bg-white px-4 text-[16px] text-[#1C1C1E] placeholder:opacity-60"
              style={{ minHeight: "56px" }}
            />
          </div>

          <div className="step2-field-in grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label
                htmlFor="alcohol"
                className="block text-[17px] font-medium text-[#8E8E93]"
              >
                Alcohol content
              </label>
              <input
                id="alcohol"
                type="text"
                value={applicationData.alcoholContent}
                onChange={(e) =>
                  setApplicationData((c) => ({
                    ...c,
                    alcoholContent: e.target.value,
                  }))
                }
                placeholder="e.g., 45% Alc./Vol. or 90 Proof"
                className="input-apple h-14 w-full rounded-[16px] border border-[#E5E5EA] bg-white px-4 text-[16px] text-[#1C1C1E] placeholder:opacity-60"
                style={{ minHeight: "56px" }}
              />
              <p className="mt-1 text-[14px] text-[#8E8E93]">
                Optional for some wine/beer types
              </p>
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="net-contents"
                className="block text-[17px] font-medium text-[#8E8E93]"
              >
                Net contents
              </label>
              <input
                id="net-contents"
                type="text"
                value={applicationData.netContents}
                onChange={(e) =>
                  setApplicationData((c) => ({
                    ...c,
                    netContents: e.target.value,
                  }))
                }
                placeholder="e.g., 750 mL or 12 fl oz"
                className="input-apple h-14 w-full rounded-[16px] border border-[#E5E5EA] bg-white px-4 text-[16px] text-[#1C1C1E] placeholder:opacity-60"
                style={{ minHeight: "56px" }}
              />
            </div>
          </div>

          <div className="step2-field-in space-y-1.5">
            <label
              htmlFor="bottler-name-address"
              className="block text-[17px] font-medium text-[#8E8E93]"
            >
              Bottler/Producer name & address
            </label>
            <input
              id="bottler-name-address"
              type="text"
              value={applicationData.bottlerNameAddress}
              onChange={(e) =>
                setApplicationData((c) => ({
                  ...c,
                  bottlerNameAddress: e.target.value,
                }))
              }
              placeholder="e.g., Bottled by Old Tom Distillery, 123 Main St, Louisville, KY"
              className="input-apple h-14 w-full rounded-[16px] border border-[#E5E5EA] bg-white px-4 text-[16px] text-[#1C1C1E] placeholder:opacity-60"
              style={{ minHeight: "56px" }}
            />
          </div>

          <div className="step2-field-in space-y-1.5">
            <label
              htmlFor="country-of-origin"
              className="block text-[17px] font-medium text-[#8E8E93]"
            >
              Country of origin
            </label>
            <input
              id="country-of-origin"
              type="text"
              value={applicationData.countryOfOrigin}
              onChange={(e) =>
                setApplicationData((c) => ({
                  ...c,
                  countryOfOrigin: e.target.value,
                }))
              }
              placeholder="e.g., Mexico (leave blank if domestic)"
              className="input-apple h-14 w-full rounded-[16px] border border-[#E5E5EA] bg-white px-4 text-[16px] text-[#1C1C1E] placeholder:opacity-60"
              style={{ minHeight: "56px" }}
            />
          </div>

          <div className="step2-field-in space-y-1.5">
            <label
              htmlFor="government-warning"
              className="block text-[17px] font-medium text-[#8E8E93]"
            >
              Government health warning
            </label>
            <textarea
              id="government-warning"
              value={applicationData.governmentWarning}
              onChange={(e) =>
                setApplicationData((c) => ({
                  ...c,
                  governmentWarning: e.target.value,
                }))
              }
              rows={4}
              className="input-apple w-full resize-y rounded-[16px] border border-[#E5E5EA] bg-white px-4 py-3 text-[16px] leading-relaxed text-[#1C1C1E] placeholder:opacity-60"
              style={{ lineHeight: 1.6 }}
            />
            <p className="mt-1 text-[14px] text-[#8E8E93]">
              Standard TTB warning (pre-filled)
            </p>
          </div>

          <div className="step2-buttons-in flex flex-col gap-4 pt-2">
            <button
              type="button"
              onClick={onBack}
              className="self-start min-h-[44px] min-w-[44px] text-[16px] font-normal text-[#007AFF] transition-opacity hover:opacity-80"
              title="Go back (Escape)"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={
                isProcessing ||
                !fileList.length ||
                !applicationData.brandName.trim()
              }
              title="Run verification (Enter)"
              className="flex w-full min-h-[56px] items-center justify-center gap-2 rounded-[16px] px-6 py-4 text-[16px] font-semibold text-white transition-all duration-500 hover:scale-[1.02] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 disabled:grayscale disabled:hover:scale-100 depth-2"
              style={{
                background:
                  "linear-gradient(180deg, #007AFF 0%, #0051D5 100%)",
              }}
            >
              {isProcessing ? (
                <>
                  <span
                    className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"
                    aria-hidden
                  />
                  Running verification…
                </>
              ) : (
                "Run verification"
              )}
            </button>
          </div>
        </form>
      </section>
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
