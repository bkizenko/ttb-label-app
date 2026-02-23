/* eslint-disable @next/next/no-img-element */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createWorker } from "tesseract.js";
import {
  STANDARD_GOVERNMENT_WARNING,
  compareLabelData,
  type ApplicationLabelData,
  type ExtractedLabelData,
  type FieldCheck,
} from "@/lib/labelComparison";

type VerificationResult = {
  fileName: string;
  checks: FieldCheck[];
  rawOcrText: string;
  durationMs: number;
};

type Mode = "single" | "batch";

const defaultApplicationData: ApplicationLabelData = {
  brandName: "OLD TOM DISTILLERY",
  classType: "Kentucky Straight Bourbon Whiskey",
  alcoholContent: "45% Alc./Vol. (90 Proof)",
  netContents: "750 mL",
  governmentWarning: STANDARD_GOVERNMENT_WARNING,
};

const extractFromOcrText = (text: string): ExtractedLabelData => {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const fullText = lines.join(" ");

  const alcoholMatch = fullText.match(
    /(\d+(?:\.\d+)?)\s*%[^0-9]*Alc\.?\/Vol\.?.*?\(\s*\d+\s*Proof\s*\)/i,
  );

  const netMatch = fullText.match(/(\d+(?:\.\d+)?)\s*(ML|mL|Ml|ml)\b/);

  const warningIndex = fullText.toUpperCase().indexOf("GOVERNMENT WARNING");
  let warningText: string | undefined;
  if (warningIndex >= 0) {
    warningText = fullText.slice(warningIndex).trim();
  }

  const hasExactHeader = /GOVERNMENT WARNING:/.test(fullText);

  const candidateBrandLine = lines[0] ?? "";

  const classTypeRegex =
    /(Straight|Blended|Kentucky|Bourbon|Whiskey|Whisky|Vodka|Gin|Rum|Tequila)[^,]*/i;
  const classTypeMatch = fullText.match(classTypeRegex);

  return {
    brandName: candidateBrandLine,
    classType: classTypeMatch ? classTypeMatch[0].trim() : undefined,
    alcoholContent: alcoholMatch ? alcoholMatch[0].trim() : undefined,
    netContents: netMatch ? `${netMatch[1]} ${netMatch[2]}` : undefined,
    governmentWarningText: warningText,
    hasGovernmentWarningHeaderExact: hasExactHeader,
  };
};

function ThumbnailCard({
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

  useEffect(() => {
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
      className="step1-thumb-in group relative flex flex-col gap-2 rounded-[16px] border border-gray-200 bg-white p-2 transition-all duration-300 ease-out hover:scale-[1.04] hover:border-gray-300 hover:shadow-lg"
      style={{
        ...style,
        boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
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
        {url ? (
          <img
            src={url}
            alt={file.name}
            className="h-[140px] w-full rounded-[12px] bg-[#FAFBFC] object-contain transition-transform duration-300 ease-out group-hover:scale-110"
            onLoad={(e) => {
              const img = e.currentTarget;
              setDims({ w: img.naturalWidth, h: img.naturalHeight });
            }}
          />
        ) : (
          <div className="h-[140px] w-full rounded-[12px] bg-[#FAFBFC]" />
        )}
      </div>
      <figcaption className="truncate text-sm font-medium text-[#1C1C1E]">
        {file.name}
      </figcaption>
      <p className="text-xs text-[#8E8E93]">
        {sizeStr}
        {dimsStr ? ` • ${dimsStr}` : ""}
      </p>
    </figure>
  );
}

export default function Home() {
  const [mode, setMode] = useState<Mode>("single");
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [applicationData, setApplicationData] = useState<ApplicationLabelData>(
    defaultApplicationData,
  );
  const [batchJson, setBatchJson] = useState("");
  const [fileList, setFileList] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<VerificationResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [progressMessage, setProgressMessage] = useState<string | null>(null);
  const [currentResultIndex, setCurrentResultIndex] = useState(0);
  const [step2ShowAllFields, setStep2ShowAllFields] = useState(false);
  const [step2EditingWarning, setStep2EditingWarning] = useState(false);

  const handleFilesSelected = (files: FileList | null) => {
    if (!files) return;
    setError(null);
    const newFiles = Array.from(files).filter((file) =>
      file.type.startsWith("image/"),
    );
    if (!newFiles.length) {
      setError("Please select one or more image files.");
      return;
    }

    setFileList((current) => {
      if (current.length) {
        const existingKeys = new Set(
          current.map((file) => `${file.name}-${file.lastModified}`),
        );
        const deduped = newFiles.filter(
          (file) => !existingKeys.has(`${file.name}-${file.lastModified}`),
        );
        return deduped.length ? [...current, ...deduped] : current;
      }
      return newFiles;
    });
    setResults([]);
  };

  const clearAllFiles = () => {
    setFileList([]);
    setResults([]);
  };

  const removeSelectedFile = (key: string) => {
    setFileList((current) =>
      current.filter((file) => `${file.name}-${file.lastModified}` !== key),
    );
  };

  const parsedBatchData: ApplicationLabelData[] | null = useMemo(() => {
    if (!batchJson.trim()) return null;
    try {
      const parsed = JSON.parse(batchJson);
      if (!Array.isArray(parsed)) return null;
      return parsed;
    } catch {
      return null;
    }
  }, [batchJson]);

  const runVerification = useCallback(
    async (files: File[], applications: ApplicationLabelData[]) => {
      if (!files.length) {
        setError("Please add at least one label image.");
        return;
      }

      if (!applications.length) {
        setError("Please provide application data to compare against.");
        return;
      }

      setIsProcessing(true);
      setResults([]);
      setError(null);
      setProgressMessage("Initializing OCR engine...");

      const worker = await createWorker("eng");

      try {
        const newResults: VerificationResult[] = [];

        for (let index = 0; index < files.length; index += 1) {
          const file = files[index];
          const appData =
            applications[index] ?? applications[applications.length - 1];

          const start = performance.now();
          setProgressMessage(`Reading label ${index + 1} of ${files.length}...`);

          const { data } = await worker.recognize(file);
          const ocrText = data.text ?? "";

          const extracted = extractFromOcrText(ocrText);
          const checks = compareLabelData(appData, extracted);

          const durationMs = performance.now() - start;

          newResults.push({
            fileName: file.name,
            checks,
            rawOcrText: ocrText,
            durationMs,
          });
        }

        setResults(newResults);
        setProgressMessage(null);
      } catch (e) {
        setError(
          e instanceof Error
            ? e.message
            : "Unexpected error while processing labels.",
        );
      } finally {
        await worker.terminate();
        setIsProcessing(false);
        setProgressMessage(null);
      }
    },
    [],
  );

  const handleRunSingle = async () => {
    await runVerification(fileList, [applicationData]);
  };

  const handleRunBatch = async () => {
    if (!parsedBatchData) {
      setError("Batch JSON must be a valid array of applications.");
      return;
    }
    await runVerification(fileList, parsedBatchData);
  };

  const handleRunWizard = async () => {
    await runVerification(fileList, [applicationData]);
    setStep(3);
  };

  const resetWizard = () => {
    setMode("single");
    setStep(1);
    setApplicationData(defaultApplicationData);
    setBatchJson("");
    setFileList([]);
    setResults([]);
    setError(null);
    setProgressMessage(null);
    setCurrentResultIndex(0);
    setStep2ShowAllFields(false);
    setStep2EditingWarning(false);
  };

  const renderProgress = () => {
    const steps = [1, 2, 3] as const;
    const isStep1 = step === 1;
    return (
      <div
        className={`mb-6 flex items-center gap-3 ${isStep1 ? "step1-progress-in" : ""}`}
      >
        <span className="text-sm font-semibold text-[#1C1C1E]">
          {step === 1 && "Step 1 of 3"}
          {step === 2 && "Step 2 of 3"}
          {step === 3 && "Step 3 of 3"}
        </span>
        <div className="flex items-center gap-2">
          {steps.map((s) => (
            <span
              key={s}
              className={`rounded-full transition-all duration-300 ${
                step === s
                  ? "progress-dot-active h-3.5 w-3.5 scale-125 bg-[#007AFF] sm:scale-[1.4]"
                  : step > s
                    ? "h-3.5 w-3.5 bg-[#30D158]"
                    : "h-3.5 w-3.5 bg-[#C7C7CC]"
              }`}
              style={
                step === s
                  ? { boxShadow: "0 0 8px rgba(0, 122, 255, 0.5)" }
                  : undefined
              }
            />
          ))}
        </div>
      </div>
    );
  };

  if (step === 1) {
    return (
      <div className="min-h-screen bg-[#F2F2F7] text-[#1C1C1E]">
        <div className="mx-auto flex max-w-xl flex-col gap-8 px-4 py-10 sm:py-12">
          <header className="space-y-2">
            {renderProgress()}
            <div className="step1-header-in flex items-center gap-4">
              <div
                className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-2xl text-4xl"
                style={{
                  background: "linear-gradient(180deg, #007AFF 0%, #0051D5 100%)",
                  color: "white",
                }}
              >
                📸
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-[#1C1C1E]">
                  Upload label image
                </h1>
                <p className="mt-1 text-base text-[#8E8E93]">
                  Select one or more label images
                </p>
              </div>
            </div>
          </header>

          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 shadow-sm">
              {error}
            </div>
          ) : null}

          <main className="space-y-6">
            <section
              className={`overflow-hidden rounded-[16px] bg-white p-8 shadow-[0_4px_12px_rgba(0,0,0,0.08)] ${fileList.length ? "upload-zone-pulse" : ""}`}
            >
              <label
                className={`step1-upload-zone-in flex min-h-[400px] cursor-pointer flex-col items-center justify-center rounded-[16px] px-4 py-10 text-center transition-all duration-200 ease-out hover:scale-[1.02] ${
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
                  onChange={(event) => handleFilesSelected(event.target.files)}
                />
                {fileList.length ? (
                  <span className="mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-[#30D158]/20 text-2xl text-[#30D158]">
                    ✓
                  </span>
                ) : (
                  <span
                    className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl text-5xl"
                    style={{
                      background:
                        "linear-gradient(180deg, #007AFF 0%, #0051D5 100%)",
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
                  className="mt-2 text-base text-[#8E8E93]"
                  style={{ opacity: 0.6 }}
                >
                  {fileList.length
                    ? "Tap the area again to add more"
                    : "Tap to choose from your files"}
                </span>
              </label>

              {fileList.length ? (
                <div className="mt-6 space-y-4">
                  <p className="text-base font-semibold text-[#1C1C1E]">
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
                          removeSelectedFile(
                            `${file.name}-${file.lastModified}`,
                          )
                        }
                        style={{ animationDelay: `${index * 60}ms` }}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={clearAllFiles}
                    className="flex items-center gap-2 rounded-[12px] border border-[#FF3B30]/30 bg-white px-4 py-2.5 text-sm font-semibold text-[#FF3B30] shadow-sm transition-transform duration-150 hover:scale-[0.97] hover:bg-red-50"
                  >
                    <span aria-hidden>🗑</span>
                    Clear all
                  </button>
                </div>
              ) : null}
            </section>

            <div className="w-full sm:flex sm:justify-end">
              <button
                type="button"
                disabled={!fileList.length}
                onClick={() => setStep(2)}
                className="w-full min-h-[56px] rounded-[12px] px-6 py-4 text-[18px] font-semibold text-white shadow-lg transition-all duration-300 ease-out hover:scale-[1.03] hover:shadow-xl disabled:scale-100 sm:w-auto disabled:opacity-50 disabled:grayscale active:scale-[0.97] disabled:hover:shadow-lg"
                style={{
                  background:
                    "linear-gradient(180deg, #007AFF 0%, #0051D5 100%)",
                  boxShadow: "0 4px 16px rgba(0, 122, 255, 0.3)",
                }}
              >
                Next: Add application data
              </button>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (step === 2) {
    const firstFile = fileList[0];
    const warningCharCount = applicationData.governmentWarning.length;
    const isStandardWarning =
      applicationData.governmentWarning === STANDARD_GOVERNMENT_WARNING;

    return (
      <div className="min-h-screen bg-[#F2F2F7] text-[#1C1C1E]">
        <div className="mx-auto flex max-w-xl flex-col gap-8 px-4 py-10 sm:py-12">
          <header className="space-y-2">
            {renderProgress()}
            <div className="step2-header-in flex items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#007AFF]/10 text-3xl">
                📝
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-[#1C1C1E]">
                  Enter application data
                </h1>
                <p className="mt-1 text-[17px] text-[#8E8E93]">
                  Confirm what the approved record says.
                </p>
              </div>
            </div>
          </header>

          {error ? (
            <div className="rounded-2xl border border-[#FF3B30]/30 bg-red-50 px-4 py-3 text-[17px] text-[#FF3B30] shadow-sm">
              {error}
            </div>
          ) : null}

          <main className="space-y-6">
            {firstFile ? (
              <section
                className="step2-preview-in flex h-[88px] items-center gap-4 rounded-[16px] bg-white px-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
                style={{ minHeight: "88px" }}
              >
                <img
                  src={URL.createObjectURL(firstFile)}
                  alt=""
                  className="h-[72px] w-[72px] shrink-0 rounded-[12px] bg-[#F2F2F7] object-contain"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-normal text-[#8E8E93]">
                    Label image ready
                  </p>
                  <p className="mt-0.5 truncate text-[13px] text-[#8E8E93]">
                    {fileList.length > 1
                      ? `${fileList.length} labels · same data for all`
                      : firstFile.name}
                  </p>
                </div>
              </section>
            ) : null}

            <section
              className="overflow-hidden rounded-[16px] bg-white p-8 shadow-[0_2px_12px_rgba(0,0,0,0.06)]"
              style={{ padding: "32px" }}
            >
              <form
                className="space-y-7"
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleRunWizard();
                }}
              >
                <p
                  className="text-[13px] font-semibold uppercase tracking-wider text-[#8E8E93]"
                  style={{ letterSpacing: "0.5px" }}
                >
                  Application record
                </p>

                <div
                  className="step2-field-in"
                  style={{ animationDelay: "0ms" }}
                >
                  <label
                    htmlFor="brand-name"
                    className="mb-1.5 block text-[13px] font-medium text-[#8E8E93]"
                  >
                    Brand name
                  </label>
                  <div className="relative">
                    <input
                      id="brand-name"
                      type="text"
                      value={applicationData.brandName}
                      onChange={(event) =>
                        setApplicationData((current) => ({
                          ...current,
                          brandName: event.target.value,
                        }))
                      }
                      placeholder="e.g. OLD TOM DISTILLERY"
                      className="input-apple h-14 w-full rounded-[12px] border border-[#E5E5EA] bg-white px-4 text-[17px] text-[#1C1C1E] placeholder:opacity-60"
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
                  <p className="mt-1 text-[13px] text-[#8E8E93]" style={{ opacity: 0.6 }}>
                    Primary brand name on the approved application
                  </p>
                </div>

                {!step2ShowAllFields ? (
                  <button
                    type="button"
                    onClick={() => setStep2ShowAllFields(true)}
                    className="step2-field-in flex w-full items-center justify-center gap-2 rounded-[12px] border border-[#E5E5EA] bg-white py-3.5 text-[17px] font-normal text-[#007AFF] transition-colors hover:bg-[#F2F2F7]"
                    style={{ minHeight: "56px", animationDelay: "80ms" }}
                  >
                    Show all fields
                  </button>
                ) : (
                  <>
                    <div
                      className="step2-field-in space-y-1.5"
                      style={{ animationDelay: "0ms" }}
                    >
                      <label
                        htmlFor="class-type"
                        className="block text-[13px] font-medium text-[#8E8E93]"
                      >
                        Class / type
                      </label>
                      <input
                        id="class-type"
                        type="text"
                        value={applicationData.classType}
                        onChange={(event) =>
                          setApplicationData((current) => ({
                            ...current,
                            classType: event.target.value,
                          }))
                        }
                        placeholder="e.g. Kentucky Straight Bourbon Whiskey"
                        className="input-apple h-14 w-full rounded-[12px] border border-[#E5E5EA] bg-white px-4 text-[17px] text-[#1C1C1E] placeholder:opacity-60"
                        style={{ minHeight: "56px" }}
                      />
                    </div>

                    <div
                      className="step2-field-in grid gap-4 sm:grid-cols-2"
                      style={{ animationDelay: "60ms" }}
                    >
                      <div className="space-y-1.5">
                        <label
                          htmlFor="alcohol"
                          className="block text-[13px] font-medium text-[#8E8E93]"
                        >
                          Alcohol content
                        </label>
                        <input
                          id="alcohol"
                          type="text"
                          value={applicationData.alcoholContent}
                          onChange={(event) =>
                            setApplicationData((current) => ({
                              ...current,
                              alcoholContent: event.target.value,
                            }))
                          }
                          placeholder="e.g. 45% Alc./Vol. (90 Proof)"
                          className="input-apple h-14 w-full rounded-[12px] border border-[#E5E5EA] bg-white px-4 text-[17px] text-[#1C1C1E] placeholder:opacity-60"
                          style={{ minHeight: "56px" }}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label
                          htmlFor="net-contents"
                          className="block text-[13px] font-medium text-[#8E8E93]"
                        >
                          Net contents
                        </label>
                        <input
                          id="net-contents"
                          type="text"
                          value={applicationData.netContents}
                          onChange={(event) =>
                            setApplicationData((current) => ({
                              ...current,
                              netContents: event.target.value,
                            }))
                          }
                          placeholder="e.g. 750 mL"
                          className="input-apple h-14 w-full rounded-[12px] border border-[#E5E5EA] bg-white px-4 text-[17px] text-[#1C1C1E] placeholder:opacity-60"
                          style={{ minHeight: "56px" }}
                        />
                      </div>
                    </div>
                  </>
                )}

                {!step2EditingWarning ? (
                  <button
                    type="button"
                    onClick={() => setStep2EditingWarning(true)}
                    className="step2-field-in flex w-full items-center justify-between gap-3 rounded-[12px] border border-[#E5E5EA] bg-white px-4 py-3.5 text-left text-[17px] text-[#1C1C1E] transition-colors hover:bg-[#F2F2F7]"
                    style={{ minHeight: "56px", animationDelay: "160ms" }}
                  >
                    <span className="text-[#8E8E93]">
                      {isStandardWarning
                        ? "Using standard TTB warning"
                        : "Government warning (custom)"}
                    </span>
                    <span className="shrink-0 text-[#007AFF]" aria-hidden>
                      ✎
                    </span>
                  </button>
                ) : (
                  <div
                    className="step2-field-in space-y-1.5"
                    style={{ animationDelay: "0ms" }}
                  >
                    <div className="flex items-center justify-between">
                      <label
                        htmlFor="government-warning"
                        className="block text-[13px] font-medium text-[#8E8E93]"
                      >
                        Government health warning (exact text)
                      </label>
                      <button
                        type="button"
                        onClick={() => setStep2EditingWarning(false)}
                        className="text-[13px] text-[#007AFF]"
                      >
                        Collapse
                      </button>
                    </div>
                    <div className="relative pb-8">
                      <textarea
                        id="government-warning"
                        value={applicationData.governmentWarning}
                        onChange={(event) =>
                          setApplicationData((current) => ({
                            ...current,
                            governmentWarning: event.target.value,
                          }))
                        }
                        rows={6}
                        className="input-apple w-full resize-y rounded-[12px] border border-[#E5E5EA] bg-white px-4 py-3 font-mono text-[15px] leading-relaxed text-[#1C1C1E] placeholder:opacity-60"
                        style={{ lineHeight: 1.6 }}
                      />
                      <p
                        className="absolute bottom-2 right-3 text-[11px] text-[#8E8E93]"
                        style={{ opacity: 0.8 }}
                      >
                        {warningCharCount} characters
                      </p>
                    </div>
                  </div>
                )}

                <div className="step2-buttons-in flex flex-col gap-4 pt-2">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="self-start text-[17px] font-normal text-[#007AFF] transition-opacity hover:opacity-80"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={isProcessing || !fileList.length}
                    className="flex w-full min-h-[56px] items-center justify-center gap-2 rounded-[12px] px-6 py-4 text-[18px] font-semibold text-white shadow-lg transition-all duration-300 ease-out hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:grayscale disabled:hover:scale-100"
                    style={{
                      background:
                        "linear-gradient(180deg, #007AFF 0%, #0051D5 100%)",
                      boxShadow: "0 4px 16px rgba(0, 122, 255, 0.3)",
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
          </main>
        </div>
      </div>
    );
  }

  if (step === 3) {
    const hasResults = results.length > 0;
    const safeIndex =
      currentResultIndex < results.length ? currentResultIndex : 0;
    const activeResult = hasResults ? results[safeIndex] : null;

    const anyIssue =
      activeResult?.checks.some(
        (check) => check.status === "mismatch" || check.status === "missing",
      ) ?? false;

    return (
      <div className="min-h-screen bg-[#F2F2F7] text-[#1C1C1E]">
        <div className="mx-auto flex max-w-5xl flex-col gap-10 px-4 py-10">
          <header className="space-y-2">
            {renderProgress()}
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#30D158]/10 text-2xl text-[#30D158]">
                ✓
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-[#1C1C1E]">
                  Comparison results
                </h1>
                <p className="mt-1 text-[17px] text-[#8E8E93]">
                  Review how the label matches the application data.
                </p>
              </div>
            </div>
          </header>

          {error ? (
            <div className="rounded-2xl border border-[#FF3B30]/30 bg-red-50 px-4 py-3 text-[17px] text-[#FF3B30] shadow-sm">
              {error}
            </div>
          ) : null}

          <main className="flex flex-col gap-10">
            {!hasResults || !activeResult ? (
              <section className="rounded-[24px] bg-white p-8 text-[17px] text-[#8E8E93] shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
                No results yet. Run a verification to see comparisons.
              </section>
            ) : (
              <>
                {/* Hero status card – 120px min height, spring entrance */}
                <section
                  className={`animate-fade-scale-in flex min-h-[120px] items-center rounded-[24px] p-6 text-white shadow-[0_8px_24px_rgba(0,0,0,0.08)] ${
                    anyIssue
                      ? "bg-gradient-to-r from-[#FF9F0A] to-[#FF9500]"
                      : "bg-gradient-to-r from-[#30D158] to-[#28CD4F]"
                  }`}
                  style={{ animationDuration: "0.5s", animationTimingFunction: "cubic-bezier(0.34, 1.56, 0.64, 1)" }}
                >
                  <div className="step3-hero-icon flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-4xl shadow-sm">
                    {anyIssue ? "!" : "✓"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[28px] font-semibold tracking-tight drop-shadow-sm">
                      {anyIssue
                        ? "Some fields need review"
                        : "Label matches the application data"}
                    </p>
                    <p className="mt-1 text-[15px] opacity-90">
                      Processing time: {activeResult.durationMs.toFixed(0)} ms
                    </p>
                  </div>
                </section>

                {/* Image + checklist – 40px gap */}
                <section className="flex flex-col gap-10 lg:flex-row">
                  <div className="flex w-full flex-col items-center lg:w-1/3">
                    <div
                      className="w-full max-w-xs rounded-[24px] bg-white p-4 shadow-[0_2px_12px_rgba(0,0,0,0.06)]"
                      style={{ border: "1px solid rgba(0,0,0,0.06)" }}
                    >
                      <p className="text-[14px] font-medium text-[#1C1C1E]">
                        Label image
                      </p>
                      <p className="mt-1 text-[13px] text-[#8E8E93]">
                        {activeResult.fileName}
                      </p>
                      {fileList[safeIndex] ? (
                        <img
                          src={URL.createObjectURL(fileList[safeIndex]!)}
                          alt={activeResult.fileName}
                          className="mt-3 w-full rounded-2xl bg-[#F2F2F7] object-contain"
                          style={{ border: "1px solid rgba(0,0,0,0.06)" }}
                        />
                      ) : null}
                    </div>

                    {results.length > 1 ? (
                      <div className="mt-6 flex flex-col items-center gap-3">
                        <p className="text-[15px] font-semibold text-[#1C1C1E]">
                          Label {safeIndex + 1} of {results.length}
                        </p>
                        <div className="flex items-center gap-4">
                          <button
                            type="button"
                            aria-label="Previous label"
                            disabled={safeIndex === 0}
                            onClick={() =>
                              setCurrentResultIndex((i) => Math.max(0, i - 1))
                            }
                            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-[#E5E5EA] bg-white text-[#1C1C1E] shadow-sm transition-all duration-150 hover:scale-[1.02] hover:shadow-md active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <span className="text-xl">‹</span>
                          </button>
                          <div className="flex items-center gap-2">
                            {results.map((_, dotIndex) => (
                              <button
                                key={dotIndex}
                                type="button"
                                aria-label={`Go to label ${dotIndex + 1}`}
                                onClick={() => setCurrentResultIndex(dotIndex)}
                                className={`h-3 w-3 rounded-full transition-transform duration-300 ${
                                  dotIndex === safeIndex
                                    ? "scale-[1.3] bg-[#0A84FF] shadow-[0_0_8px_rgba(10,132,255,0.5)]"
                                    : "bg-[#C7C7CC]"
                                }`}
                              />
                            ))}
                          </div>
                          <button
                            type="button"
                            aria-label="Next label"
                            disabled={safeIndex >= results.length - 1}
                            onClick={() =>
                              setCurrentResultIndex((i) =>
                                Math.min(results.length - 1, i + 1),
                              )
                            }
                            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-[#E5E5EA] bg-white text-[#1C1C1E] shadow-sm transition-all duration-150 hover:scale-[1.02] hover:shadow-md active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <span className="text-xl">›</span>
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="w-full lg:w-2/3">
                    <div className="space-y-4">
                      {activeResult.checks.map((check, index) => {
                        const baseDelay = index * 80;
                        const labelMap: Record<string, string> = {
                          brandName: "Brand name",
                          classType: "Class / type",
                          alcoholContent: "Alcohol content",
                          netContents: "Net contents",
                          governmentWarning: "Government warning text",
                          governmentWarningHeader: "GOVERNMENT WARNING header",
                        };

                        if (check.status === "match") {
                          return (
                            <div
                              key={check.field + index.toString()}
                              className="animate-fade-scale-in rounded-[24px] bg-[#E5E5EA]/40 px-4 py-3.5 shadow-sm"
                              style={{
                                animationDelay: `${baseDelay}ms`,
                                animationDuration: "0.4s",
                                animationTimingFunction:
                                  "cubic-bezier(0.34, 1.56, 0.64, 1)",
                              }}
                            >
                              <div className="flex items-center gap-3">
                                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#30D158]/20 text-[#30D158]">
                                  ✓
                                </div>
                                <p className="text-base text-[#1C1C1E]">
                                  {labelMap[check.field] ?? check.field} matches
                                  the application record.
                                </p>
                              </div>
                            </div>
                          );
                        }

                        if (check.status === "mismatch") {
                          return (
                            <div
                              key={check.field + index.toString()}
                              className="step3-field-pulse-once animate-fade-scale-in rounded-[24px] bg-[#FFF4E5] px-4 py-4 shadow-sm"
                              style={{
                                animationDelay: `${baseDelay}ms`,
                                animationDuration: "0.4s",
                                animationTimingFunction:
                                  "cubic-bezier(0.34, 1.56, 0.64, 1)",
                              }}
                            >
                              <p className="text-base font-medium text-[#1C1C1E]">
                                {labelMap[check.field] ?? check.field} needs
                                review
                              </p>
                              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                <div className="space-y-1">
                                  <span className="inline-flex rounded-full bg-[#E5E5EA] px-3 py-1 text-xs font-medium text-[#1C1C1E]">
                                    Expected
                                  </span>
                                  <p className="mt-1 rounded-lg bg-white px-3 py-2 font-mono text-[18px] text-[#1C1C1E]">
                                    {check.expected ?? "—"}
                                  </p>
                                </div>
                                <div className="space-y-1">
                                  <span className="inline-flex rounded-full bg-[#FF9F0A]/25 px-3 py-1 text-xs font-medium text-[#B65E00]">
                                    Found
                                  </span>
                                  <p className="mt-1 rounded-lg bg-white px-3 py-2 font-mono text-[18px] text-[#1C1C1E]">
                                    {check.actual ?? "—"}
                                  </p>
                                </div>
                              </div>
                              {check.notes ? (
                                <p className="mt-2 text-[13px] text-[#8E8E93]">
                                  {check.notes}
                                </p>
                              ) : null}
                            </div>
                          );
                        }

                        return (
                          <div
                            key={check.field + index.toString()}
                            className="step3-field-pulse-once animate-fade-scale-in rounded-[24px] bg-red-50 px-4 py-4 shadow-sm"
                            style={{
                              animationDelay: `${baseDelay}ms`,
                              animationDuration: "0.4s",
                              animationTimingFunction:
                                "cubic-bezier(0.34, 1.56, 0.64, 1)",
                            }}
                          >
                            <p className="text-base font-medium text-[#FF3B30]">
                              {labelMap[check.field] ?? check.field} not found
                              on the label.
                            </p>
                            {check.expected ? (
                              <p className="mt-2 text-[13px] text-[#1C1C1E]">
                                Expected:{" "}
                                <span className="font-mono text-[18px]">
                                  {check.expected}
                                </span>
                              </p>
                            ) : null}
                            {check.notes ? (
                              <p className="mt-1 text-[13px] text-[#8E8E93]">
                                {check.notes}
                              </p>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </section>
              </>
            )}

            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={resetWizard}
                className="inline-flex min-h-[56px] items-center justify-center rounded-[12px] bg-[#0A84FF] px-6 py-4 text-[18px] font-semibold text-white shadow-[0_4px_16px_rgba(10,132,255,0.3)] transition-all duration-150 hover:scale-[1.02] hover:shadow-lg active:scale-[0.97]"
              >
                Check another label
              </button>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 text-slate-700">
      <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-8 sm:px-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-800 sm:text-3xl">
              TTB label comparison
            </h1>
            <p className="mt-1 text-sm text-slate-700">
              Compare an approved application record to the printed label image.
            </p>
          </div>
          <div className="flex flex-col items-start gap-1 text-xs text-slate-600 sm:items-end">
            <span className="rounded-md bg-gray-200 px-3 py-1 font-medium text-slate-700">
              OCR runs in the browser
            </span>
            <span className="text-[11px]">
              Results are for human review. Final decisions remain with agents.
            </span>
          </div>
        </header>

        {error ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        {progressMessage ? (
          <div className="flex items-center gap-3 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-slate-800">
            <span className="h-2 w-2 animate-pulse rounded-full bg-blue-500" />
            <span>{progressMessage}</span>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2 text-xs font-medium">
          <span className="mr-1 text-[11px] uppercase tracking-wide text-slate-500">
            Mode
          </span>
          <button
            type="button"
            onClick={() => setMode("single")}
            className={`rounded-md px-3 py-2 text-sm ${
              mode === "single"
                ? "bg-slate-800 text-white"
                : "bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-gray-50"
            }`}
          >
            Single label
          </button>
          <button
            type="button"
            onClick={() => setMode("batch")}
            className={`rounded-md px-3 py-2 text-sm ${
              mode === "batch"
                ? "bg-slate-800 text-white"
                : "bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-gray-50"
            }`}
          >
            Batch (multiple labels)
          </button>
        </div>

        <main className="grid gap-6 md:grid-cols-[minmax(0,2fr),minmax(0,3fr)]">
          <section className="flex flex-col gap-4">
            <div className="rounded-md bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <h2 className="text-sm font-semibold text-slate-900">
                Step 1 of 2 · Label image{mode === "batch" ? "s" : ""}
              </h2>
              <p className="mt-1 text-xs text-slate-600">
                Upload a clear image of the label. This area is required before
                running a comparison.
              </p>
              <label className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed border-slate-400 bg-gray-50 px-4 py-8 text-center text-sm text-slate-700">
                <input
                  type="file"
                  accept="image/*"
                  multiple={mode === "batch"}
                  className="hidden"
                  onChange={(event) => handleFilesSelected(event.target.files)}
                />
                <span className="text-base font-semibold text-slate-900">
                  Select label image{mode === "batch" ? "s" : ""}
                </span>
                <span className="mt-1 text-xs text-slate-600">
                  {mode === "batch"
                    ? "You can select multiple images in one action."
                    : "One label image at a time."}
                </span>
              </label>

              {fileList.length ? (
                <div className="mt-4 space-y-2">
                  <p className="text-xs font-medium text-slate-800">
                    Selected file{fileList.length > 1 ? "s" : ""} ({fileList.length})
                  </p>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {fileList.map((file) => (
                      <figure
                        key={file.name + file.lastModified}
                        className="flex flex-col gap-1 rounded-md border border-gray-200 bg-gray-50 p-2"
                      >
                        <img
                          src={URL.createObjectURL(file)}
                          alt={file.name}
                          className="h-24 w-full object-contain"
                        />
                        <figcaption className="truncate text-[11px] text-slate-700">
                          {file.name}
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  disabled={!fileList.length}
                  onClick={() => setStep(2)}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  Continue to application data
                </button>
              </div>
            </div>

            {mode === "single" ? (
              <div className="rounded-md bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <h2 className="text-sm font-semibold text-slate-900">
                  Step 2 of 2 · Application data (reference record)
                </h2>
                <p className="mt-1 text-xs text-slate-600">
                  Confirm the key fields from the approved application record.
                </p>
                <form
                  className="mt-3 space-y-3 text-xs"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void handleRunSingle();
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <button
                      type="button"
                      className="rounded-md bg-gray-100 px-3 py-2 text-xs font-medium text-slate-800 ring-1 ring-gray-300 hover:bg-gray-200"
                      onClick={() => setApplicationData(defaultApplicationData)}
                    >
                      Reset to standard example values
                    </button>
                    <button
                      type="button"
                      className="text-[11px] text-blue-700 underline-offset-2 hover:underline"
                      onClick={() => setStep(1)}
                    >
                      Back to label image
                    </button>
                  </div>

                  <div className="rounded-md bg-gray-50 px-3 py-3">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-700">
                        Brand name
                      </label>
                      <input
                        type="text"
                        value={applicationData.brandName}
                        onChange={(event) =>
                          setApplicationData((current) => ({
                            ...current,
                            brandName: event.target.value,
                          }))
                        }
                        className="mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-xs text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <p className="mt-1 text-[10px] text-slate-500">
                      Primary brand name as shown on the approved application.
                    </p>
                  </div>

                  {step === 2 && (
                    <details className="rounded-md bg-gray-50 px-3 py-3 text-xs text-slate-700">
                      <summary className="cursor-pointer select-none text-[11px] font-medium text-slate-700">
                        Additional fields
                      </summary>
                      <div className="mt-3 space-y-3">
                        <div>
                          <label className="block text-[11px] font-medium text-slate-700">
                            Class / type
                          </label>
                          <input
                            type="text"
                            value={applicationData.classType}
                            onChange={(event) =>
                              setApplicationData((current) => ({
                                ...current,
                                classType: event.target.value,
                              }))
                            }
                            className="mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-xs text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <label className="block text-[11px] font-medium text-slate-700">
                              Alcohol content
                            </label>
                            <input
                              type="text"
                              value={applicationData.alcoholContent}
                              onChange={(event) =>
                                setApplicationData((current) => ({
                                  ...current,
                                  alcoholContent: event.target.value,
                                }))
                              }
                              className="mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-xs text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-medium text-slate-700">
                              Net contents
                            </label>
                            <input
                              type="text"
                              value={applicationData.netContents}
                              onChange={(event) =>
                                setApplicationData((current) => ({
                                  ...current,
                                  netContents: event.target.value,
                                }))
                              }
                              className="mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-xs text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] font-medium text-slate-700">
                            Government health warning (exact text)
                          </label>
                          <textarea
                            value={applicationData.governmentWarning}
                            onChange={(event) =>
                              setApplicationData((current) => ({
                                ...current,
                                governmentWarning: event.target.value,
                              }))
                            }
                            rows={5}
                            className="mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-xs text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                          <p className="mt-1 text-[10px] text-slate-500">
                            This should match the standard TTB warning text. The
                            tool compares it word-for-word, ignoring spacing and
                            punctuation.
                          </p>
                        </div>
                      </div>
                    </details>
                  )}

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isProcessing || step !== 2}
                      className="inline-flex w-full items-center justify-center rounded-md bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                    >
                      {isProcessing ? "Checking label..." : "Run comparison"}
                    </button>
                    <p className="mt-1 text-[10px] text-slate-500">
                      Target: results within ~5 seconds per simple label.
                    </p>
                  </div>
                </form>
              </div>
            ) : (
              <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                <h2 className="text-sm font-semibold text-slate-900">
                  2. Batch application data (JSON)
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Paste an array of application objects. Each label image will
                  be matched by position in the list.
                </p>
                <textarea
                  value={batchJson}
                  onChange={(event) => setBatchJson(event.target.value)}
                  rows={12}
                  className="mt-2 w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                  placeholder={`[
  {
    "brandName": "OLD TOM DISTILLERY",
    "classType": "Kentucky Straight Bourbon Whiskey",
    "alcoholContent": "45% Alc./Vol. (90 Proof)",
    "netContents": "750 mL",
    "governmentWarning": "${STANDARD_GOVERNMENT_WARNING.replace(/"/g, '\\"')}"
  }
]`}
                />
                <p className="mt-1 text-[10px] text-slate-500">
                  If there are more labels than application records, the last
                  record will be reused.
                </p>
                <div className="pt-3">
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => void handleRunBatch()}
                    className="inline-flex w-full items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                  >
                    {isProcessing
                      ? "Checking batch..."
                      : "Run batch verification"}
                  </button>
                </div>
              </div>
            )}
          </section>

          <section className="flex flex-col gap-4">
            <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <h2 className="text-sm font-semibold text-slate-900">
                Results
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Each row represents a field an agent would normally eyeball:
                brand name, ABV, warning text, and so on.
              </p>
              {!results.length ? (
                <div className="mt-4 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-6 text-center text-xs text-slate-500">
                  Run a check to see automated comparisons here. Agents remain
                  the final decision-makers.
                </div>
              ) : (
                <div className="mt-3 space-y-4">
                  {results.map((result) => (
                    <div
                      key={result.fileName}
                      className="rounded-lg border border-slate-200 bg-slate-50 p-3"
                    >
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <div className="flex flex-col">
                          <span className="font-medium text-slate-900">
                            {result.fileName}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            OCR + checks in{" "}
                            {result.durationMs.toFixed(0)} ms (local browser)
                          </span>
                        </div>
                      </div>
                      <div className="mt-3 overflow-x-auto">
                        <table className="min-w-full border-separate border-spacing-y-1 text-[11px]">
                          <thead>
                            <tr className="text-left text-slate-500">
                              <th className="px-2 py-1 font-medium">Field</th>
                              <th className="px-2 py-1 font-medium">Status</th>
                              <th className="px-2 py-1 font-medium">
                                Expected
                              </th>
                              <th className="px-2 py-1 font-medium">On label</th>
                              <th className="px-2 py-1 font-medium">Notes</th>
                            </tr>
                          </thead>
                          <tbody>
                            {result.checks.map((check, index) => {
                              const statusColors: Record<
                                typeof check.status,
                                string
                              > = {
                                match:
                                  "bg-emerald-50 text-emerald-700 ring-emerald-100",
                                mismatch:
                                  "bg-amber-50 text-amber-700 ring-amber-100",
                                missing:
                                  "bg-red-50 text-red-700 ring-red-100",
                              };

                              const labelMap: Record<string, string> = {
                                brandName: "Brand name",
                                classType: "Class / type",
                                alcoholContent: "Alcohol content",
                                netContents: "Net contents",
                                governmentWarning: "Government warning text",
                                governmentWarningHeader:
                                  "GOVERNMENT WARNING header",
                              };

                              return (
                                <tr
                                  key={check.field + index.toString()}
                                  className="rounded-md bg-white align-top shadow-sm"
                                >
                                  <td className="px-2 py-1.5 text-slate-800">
                                    {labelMap[check.field] ?? check.field}
                                  </td>
                                  <td className="px-2 py-1.5">
                                    <span
                                      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${statusColors[check.status]}`}
                                    >
                                      {check.status === "match" && "Match"}
                                      {check.status === "mismatch" &&
                                        "Needs review"}
                                      {check.status === "missing" &&
                                        "Not found"}
                                    </span>
                                  </td>
                                  <td className="max-w-xs px-2 py-1.5 text-[10px] text-slate-600">
                                    {check.expected ?? "—"}
                                  </td>
                                  <td className="max-w-xs px-2 py-1.5 text-[10px] text-slate-600">
                                    {check.actual ?? "—"}
                                  </td>
                                  <td className="max-w-xs px-2 py-1.5 text-[10px] text-slate-500">
                                    {check.notes ?? "—"}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      <details className="mt-3 text-[10px] text-slate-500">
                        <summary className="cursor-pointer select-none text-[10px] font-medium text-slate-600">
                          Show raw OCR text (for troubleshooting)
                        </summary>
                        <pre className="mt-2 max-h-40 overflow-y-auto rounded bg-slate-900/95 p-2 text-[10px] text-slate-100">
                          {result.rawOcrText || "No text detected."}
                        </pre>
                      </details>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl bg-slate-900 p-4 text-xs text-slate-100">
              <h2 className="text-sm font-semibold text-white">
                How this prototype fits your workflow
              </h2>
              <ul className="mt-2 space-y-1 list-disc pl-5">
                <li>
                  Designed for{" "}
                  <span className="font-medium">5–10 minute reviews</span> by
                  surfacing obvious matches and mismatches in seconds.
                </li>
                <li>
                  Handles{" "}
                  <span className="font-medium">
                    brand, class/type, ABV, net contents, and warning text
                  </span>{" "}
                  with tolerant matching for small formatting differences.
                </li>
                <li>
                  Runs OCR in the browser, avoiding outbound network calls—more
                  compatible with constrained government networks.
                </li>
                <li>
                  Batch mode lets you pair multiple images with application
                  records for large importer drops.
                </li>
              </ul>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

