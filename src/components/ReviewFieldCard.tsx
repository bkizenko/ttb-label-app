"use client";

import { useEffect, useState } from "react";
import type { FieldCheck } from "@/lib/labelComparison";
import { FIELD_LABEL_MAP } from "@/lib/fieldLabels";

export interface ReviewFieldCardProps {
  check: FieldCheck;
  previewFile: File | null;
  isLastField: boolean;
  govWarningExpanded: boolean;
  onToggleGovWarning: () => void;
  manualOverrideValue: string;
  onManualOverrideChange: (value: string) => void;
  standardGovernmentWarning: string;
  onAcceptMatch: () => void;
  onFlag: () => void;
  onAcceptEntered: () => void;
}

export function ReviewFieldCard({
  check,
  previewFile,
  isLastField,
  govWarningExpanded,
  onToggleGovWarning,
  manualOverrideValue,
  onManualOverrideChange,
  standardGovernmentWarning,
  onAcceptMatch,
  onFlag,
  onAcceptEntered,
}: ReviewFieldCardProps) {
  const fieldLabel = FIELD_LABEL_MAP[check.field] ?? check.field;
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageZoomOpen, setImageZoomOpen] = useState(false);

  useEffect(() => {
    if (!previewFile) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(previewFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [previewFile]);

  return (
    <section className="mx-auto flex max-w-[600px] flex-col gap-8">
      <div
        className="rounded-[24px] bg-white p-8"
        style={{ boxShadow: "0 4px 16px rgba(0,0,0,0.06)" }}
      >
        {previewUrl ? (
          <button
            type="button"
            onClick={() => setImageZoomOpen(true)}
            className="mb-6 block w-full cursor-zoom-in rounded-[16px] bg-[#F5F5F7] text-left focus:outline-none focus:ring-2 focus:ring-[#007AFF] focus:ring-offset-2"
            aria-label="Enlarge image"
          >
            <img
              src={previewUrl}
              alt="Label"
              className="w-full rounded-[16px] object-contain"
              style={{ maxHeight: "400px" }}
            />
          </button>
        ) : (
          <div
            className="mb-6 w-full rounded-[16px] bg-[#F5F5F7]"
            style={{ height: "200px" }}
          />
        )}

        {check.field === "governmentWarning" && check.status === "missing" ? (
          <>
            <div
              role="alert"
              className="rounded-[16px] p-6"
              style={{
                background: "#FFEBEB",
                borderLeft: "6px solid #FF3B30",
              }}
            >
              <p className="text-[28px]" aria-hidden>⚠️</p>
              <h3
                className="mt-2 text-[22px] font-bold text-[#D70015]"
                style={{ letterSpacing: "-0.01em" }}
              >
                CRITICAL: Government Warning Required
              </h3>
              <p className="mt-3 text-[17px] leading-relaxed text-[#3C3C43]">
                No government health warning was detected on this label.
                Federal law (27 CFR § 16.21) requires all alcohol labels to
                display:
              </p>
              <pre
                className="mt-4 overflow-x-auto rounded-[12px] border-2 border-[#FF3B30] bg-white p-4 text-[14px] leading-relaxed text-black"
                style={{
                  fontFamily:
                    "'SF Mono', 'Monaco', 'Courier New', monospace",
                  whiteSpace: "pre-wrap",
                }}
              >
                {standardGovernmentWarning}
              </pre>
              <p className="mt-3 text-[15px] italic text-[#3C3C43]">
                The header must appear as &quot;GOVERNMENT WARNING:&quot; in all
                caps and bold.
              </p>
            </div>
            <p className="mt-4 text-[17px] font-normal text-[#1C1C1E]">
              Enter the warning text from the label, or flag as missing.
            </p>
            <input
              type="text"
              placeholder="Type what the label says"
              value={manualOverrideValue}
              onChange={(e) => onManualOverrideChange(e.target.value)}
              className="mt-4 w-full rounded-[16px] border-2 border-[#E5E5EA] bg-white px-4 py-3 text-[17px] text-[#1C1C1E] placeholder:text-[#C7C7CC] focus:border-[#8E8E93] focus:outline-none focus:ring-2 focus:ring-[#8E8E93]/20"
              style={{ minHeight: "52px" }}
            />
            <div className="mt-6 flex flex-col gap-4">
              <button
                type="button"
                disabled={!manualOverrideValue.trim()}
                onClick={onAcceptEntered}
                className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-[16px] border-2 border-[#34C759]/40 bg-[#F2F2F7] px-6 py-4 text-[17px] font-semibold text-[#248A3D] transition-all duration-500 active:scale-[0.97] hover:scale-[1.02] disabled:opacity-40 disabled:hover:scale-100"
              >
                <span aria-hidden>✓</span> Accept — I Entered the Value
              </button>
              <button
                type="button"
                onClick={onFlag}
                className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-[16px] border-2 border-[#FF453A]/40 bg-[#F2F2F7] px-6 py-4 text-[17px] font-semibold text-[#D70015] transition-all duration-500 active:scale-[0.97] hover:scale-[1.02]"
              >
                <span aria-hidden>✕</span> Flag — Warning Missing from Label
              </button>
            </div>
          </>
        ) : check.status === "mismatch" ? (
          <>
            <p
              className="text-[22px] font-semibold text-[#1C1C1E]"
              style={{ letterSpacing: "-0.01em" }}
            >
              ⚠️ {fieldLabel}
            </p>
            <p className="mt-2 text-[15px] font-medium uppercase tracking-wide text-[#8E8E93]">
              Expected
            </p>
            <p className="mt-1 text-[20px] font-normal text-[#1C1C1E]">
              {check.field === "governmentWarning" &&
              !govWarningExpanded &&
              (check.expected ?? "").length > 80
                ? (check.expected ?? "").slice(0, 80) + "…"
                : check.expected ?? "—"}
            </p>
            <p className="mt-5 text-[15px] font-medium uppercase tracking-wide text-[#8E8E93]">
              Found on label
            </p>
            <p className="mt-1 text-[20px] font-normal text-[#1C1C1E]">
              {check.field === "governmentWarning" &&
              !govWarningExpanded &&
              (check.actual ?? "").length > 80
                ? (check.actual ?? "").slice(0, 80) + "…"
                : check.actual ?? "—"}
            </p>
            {check.field === "governmentWarning" &&
              ((check.expected ?? "").length > 80 ||
                (check.actual ?? "").length > 80) && (
                <button
                  type="button"
                  onClick={onToggleGovWarning}
                  className="mt-2 text-[15px] font-semibold text-[#007AFF] hover:opacity-80"
                >
                  {govWarningExpanded ? "Show less" : "Show full text"}
                </button>
              )}
            {check.notes ? (
              <p className="mt-5 text-[15px] font-normal italic text-[#8E8E93]">
                {check.notes}
                {check.noteHref && (
                  <>
                    {" "}
                    <a
                      href={check.noteHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="not-italic font-semibold text-[#007AFF] underline hover:opacity-80"
                    >
                      TTB regulations ↗
                    </a>
                  </>
                )}
              </p>
            ) : null}
            <div className="mt-8 flex flex-col gap-4">
              <button
                type="button"
                onClick={onAcceptMatch}
                className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-[16px] border-2 border-[#34C759]/40 bg-[#F2F2F7] px-6 py-4 text-[17px] font-semibold text-[#248A3D] transition-all duration-500 active:scale-[0.97] hover:scale-[1.02]"
              >
                <span aria-hidden>✓</span> Override AI — Accept as Match
              </button>
              <button
                type="button"
                onClick={onFlag}
                className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-[16px] border-2 border-[#FF453A]/40 bg-[#F2F2F7] px-6 py-4 text-[17px] font-semibold text-[#D70015] transition-all duration-500 active:scale-[0.97] hover:scale-[1.02]"
              >
                <span aria-hidden>✕</span>{" "}
                {check.field === "governmentWarning"
                  ? "Flag — Doesn't Exactly Match"
                  : "Flag — Does Not Match"}
              </button>
            </div>
          </>
        ) : (
          <>
            <p
              className="text-[22px] font-semibold text-[#1C1C1E]"
              style={{ letterSpacing: "-0.01em" }}
            >
              ✗ {fieldLabel}
            </p>
            <p className="mt-4 text-[17px] font-normal text-[#1C1C1E]">
              Couldn&apos;t read {fieldLabel} clearly from the photo.
            </p>
            <p className="mt-2 text-[15px] font-normal text-[#8E8E93]">
              Enter the value manually, or flag as missing.
            </p>
            <input
              type="text"
              placeholder="Type what the label says"
              value={manualOverrideValue}
              onChange={(e) => onManualOverrideChange(e.target.value)}
              className="mt-4 w-full rounded-[16px] border-2 border-[#E5E5EA] bg-white px-4 py-3 text-[17px] text-[#1C1C1E] placeholder:text-[#C7C7CC] focus:border-[#8E8E93] focus:outline-none focus:ring-2 focus:ring-[#8E8E93]/20"
              style={{ minHeight: "52px" }}
            />
            {check.expected ? (
              <p className="mt-4 text-[15px] text-[#8E8E93]">
                Expected:{" "}
                <span className="text-[20px] text-[#1C1C1E]">
                  {check.expected}
                </span>
              </p>
            ) : null}
            <div className="mt-8 flex flex-col gap-4">
              <button
                type="button"
                disabled={!manualOverrideValue.trim()}
                onClick={onAcceptEntered}
                className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-[16px] border-2 border-[#34C759]/40 bg-[#F2F2F7] px-6 py-4 text-[17px] font-semibold text-[#248A3D] transition-all duration-500 active:scale-[0.97] hover:scale-[1.02] disabled:opacity-40 disabled:hover:scale-100"
              >
                <span aria-hidden>✓</span> Accept — I Entered the Value
              </button>
              <button
                type="button"
                onClick={onFlag}
                className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-[16px] border-2 border-[#FF453A]/40 bg-[#F2F2F7] px-6 py-4 text-[17px] font-semibold text-[#D70015] transition-all duration-500 active:scale-[0.97] hover:scale-[1.02]"
              >
                <span aria-hidden>✕</span> Flag — Field Missing from Label
              </button>
            </div>
          </>
        )}
      </div>

      {imageZoomOpen && previewUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Enlarged label image"
          onClick={() => setImageZoomOpen(false)}
        >
          <button
            type="button"
            onClick={() => setImageZoomOpen(false)}
            className="absolute right-4 top-4 rounded-full bg-white/90 p-2 text-[#3C3C43] hover:bg-white focus:outline-none focus:ring-2 focus:ring-white"
            aria-label="Close"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          <img
            src={previewUrl}
            alt="Label (enlarged)"
            className="max-h-[90vh] max-w-full rounded-lg object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </section>
  );
}
