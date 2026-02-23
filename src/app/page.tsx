/* eslint-disable @next/next/no-img-element */
"use client";

import { useCallback, useMemo, useState } from "react";
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
      if (mode === "batch" && current.length) {
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
  };

  const renderProgress = () => {
    const steps = [1, 2, 3] as const;
    return (
      <div className="mb-6 flex items-center gap-3">
        <span className="text-sm font-medium text-slate-800">
          {step === 1 && "Step 1 of 3"}
          {step === 2 && "Step 2 of 3"}
          {step === 3 && "Step 3 of 3"}
        </span>
        <div className="flex items-center gap-2">
          {steps.map((s) => (
            <span
              key={s}
              className={`h-2.5 w-2.5 rounded-full ${
                step === s
                  ? "bg-blue-500"
                  : step > s
                    ? "bg-green-500"
                    : "bg-slate-300"
              }`}
            />
          ))}
        </div>
      </div>
    );
  };

  if (step === 1) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#F5F7FA] to-white text-slate-800">
        <div className="mx-auto flex max-w-xl flex-col gap-8 px-4 py-10">
          <header className="space-y-2">
            {renderProgress()}
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-2xl">
                📸
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">
                  Upload label image
                </h1>
                <p className="mt-1 text-sm text-slate-600">
                  Add the label you want to check.
                </p>
              </div>
            </div>
          </header>

          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 shadow-sm">
              {error}
            </div>
          ) : null}

          <main className="space-y-6">
            <section className="space-y-4">
              <fieldset className="space-y-3">
                <legend className="text-sm font-medium text-slate-800">
                  How many labels are you checking?
                </legend>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <label className="flex flex-1 cursor-pointer items-center justify-between rounded-xl border border-slate-300 bg-white px-4 py-4 text-base shadow-sm">
                    <span>Single label</span>
                    <input
                      type="radio"
                      name="batchMode"
                      className="h-5 w-5"
                      checked={mode === "single"}
                      onChange={() => setMode("single")}
                    />
                  </label>
                  <label className="flex flex-1 cursor-pointer items-center justify-between rounded-xl border border-slate-300 bg-white px-4 py-4 text-base shadow-sm">
                    <span>Multiple labels</span>
                    <input
                      type="radio"
                      name="batchMode"
                      className="h-5 w-5"
                      checked={mode === "batch"}
                      onChange={() => setMode("batch")}
                    />
                  </label>
                </div>
              </fieldset>

              <section className="rounded-2xl bg-white p-6 shadow-md ring-1 ring-slate-200">
                <label className="flex min-h-[240px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 text-center text-base text-slate-700">
                  <input
                    type="file"
                    accept="image/*"
                    multiple={mode === "batch"}
                    className="hidden"
                    onChange={(event) => handleFilesSelected(event.target.files)}
                  />
                  <span className="text-lg font-semibold text-slate-900">
                    {mode === "batch"
                      ? "Upload multiple label images"
                      : "Upload a label image"}
                  </span>
                  <span className="mt-2 text-sm text-slate-600">
                    Use clear, front-facing photos of each label.
                  </span>
                </label>

                {fileList.length ? (
                  <div className="mt-4 space-y-3">
                    <p className="text-sm font-medium text-slate-800">
                      {fileList.length === 1
                        ? "1 label selected"
                        : `${fileList.length} labels selected`}
                    </p>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {fileList.map((file) => (
                        <figure
                          key={file.name + file.lastModified}
                          className="relative flex flex-col gap-2 rounded-xl border border-gray-200 bg-gray-50 p-2 shadow-sm"
                        >
                          <button
                            type="button"
                            aria-label={`Remove ${file.name}`}
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              removeSelectedFile(
                                `${file.name}-${file.lastModified}`,
                              );
                            }}
                            className="absolute right-2 top-2 inline-flex h-11 w-11 items-center justify-center bg-transparent"
                          >
                            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-200/90 text-[16px] font-semibold leading-none text-slate-700 shadow-sm ring-1 ring-slate-300 transition-transform duration-150 hover:scale-[1.02]">
                              ×
                            </span>
                          </button>
                          <img
                            src={URL.createObjectURL(file)}
                            alt={file.name}
                            className="h-24 w-full rounded-lg object-contain"
                          />
                          <figcaption className="truncate text-xs text-slate-700">
                            {file.name}
                          </figcaption>
                        </figure>
                      ))}
                    </div>
                  </div>
                ) : null}
              </section>
            </section>

            <div className="flex justify-end">
              <button
                type="button"
                disabled={!fileList.length}
                onClick={() => setStep(2)}
                className="inline-flex min-h-[60px] items-center justify-center rounded-lg bg-[#007AFF] px-6 py-4 text-base font-semibold text-white shadow-md transition-transform duration-150 hover:scale-[1.02] hover:bg-[#0066D6] disabled:cursor-not-allowed disabled:bg-slate-400 disabled:hover:scale-100"
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

    return (
      <div className="min-h-screen bg-gradient-to-b from-[#F5F7FA] to-white text-slate-800">
        <div className="mx-auto flex max-w-xl flex-col gap-8 px-4 py-10">
          <header className="space-y-2">
            {renderProgress()}
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-2xl">
                📝
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">
                  Enter application data
                </h1>
                <p className="mt-1 text-sm text-slate-600">
                  Confirm what the approved record says.
                </p>
              </div>
            </div>
          </header>

          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 shadow-sm">
              {error}
            </div>
          ) : null}

          <main className="space-y-6">
            {firstFile ? (
              <section className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-md ring-1 ring-slate-200">
                <img
                  src={URL.createObjectURL(firstFile)}
                  alt={firstFile.name}
                  className="h-16 w-16 rounded-lg object-contain"
                />
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-slate-800">
                    {mode === "batch"
                      ? `${fileList.length} label images`
                      : "Label image"}
                  </span>
                  <span className="text-xs text-slate-600">
                    Data below will be used for all selected labels.
                  </span>
                </div>
              </section>
            ) : null}

            <section className="rounded-2xl bg-white p-6 shadow-md ring-1 ring-slate-200">
              <form
                className="space-y-4 text-sm"
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleRunWizard();
                }}
              >
                <div>
                  <label className="block text-sm font-medium text-slate-800">
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
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 text-base text-slate-900 shadow-sm focus:border-[#007AFF] focus:outline-none focus:ring-1 focus:ring-[#007AFF]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-800">
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
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 text-base text-slate-900 shadow-sm focus:border-[#007AFF] focus:outline-none focus:ring-1 focus:ring-[#007AFF]"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-slate-800">
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
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 text-base text-slate-900 shadow-sm focus:border-[#007AFF] focus:outline-none focus:ring-1 focus:ring-[#007AFF]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-800">
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
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 text-base text-slate-900 shadow-sm focus:border-[#007AFF] focus:outline-none focus:ring-1 focus:ring-[#007AFF]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-800">
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
                    rows={4}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 text-base text-slate-900 shadow-sm focus:border-[#007AFF] focus:outline-none focus:ring-1 focus:ring-[#007AFF]"
                  />
                </div>

                <div className="flex justify-between gap-4 pt-2">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="inline-flex min-h-[60px] flex-1 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-4 text-base font-semibold text-slate-800 shadow-sm transition-transform duration-150 hover:scale-[1.02] hover:bg-slate-50"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={isProcessing || !fileList.length}
                    className="inline-flex min-h-[60px] flex-1 items-center justify-center rounded-lg bg-[#007AFF] px-4 py-4 text-base font-semibold text-white shadow-md transition-transform duration-150 hover:scale-[1.02] hover:bg-[#0066D6] disabled:cursor-not-allowed disabled:bg-slate-400 disabled:hover:scale-100"
                  >
                    {isProcessing ? "Running verification..." : "Run verification"}
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
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#F5F7FA] to-white text-slate-800">
        <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-10">
          <header className="space-y-2">
            {renderProgress()}
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-green-100 text-2xl">
                ✓
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">
                  Comparison results
                </h1>
                <p className="mt-1 text-sm text-slate-600">
                  Review how the label matches the application data.
                </p>
              </div>
            </div>
          </header>

          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 shadow-sm">
              {error}
            </div>
          ) : null}

          <main className="space-y-6">
            {!results.length ? (
              <section className="rounded-2xl bg-white p-6 text-sm text-slate-600 shadow-md ring-1 ring-slate-200">
                No results yet. Run a verification to see comparisons.
              </section>
            ) : (
              results.map((result, index) => (
                <section
                  key={result.fileName + index.toString()}
                  className="rounded-2xl bg-white p-6 shadow-md ring-1 ring-slate-200"
                >
                  <div className="flex flex-col gap-6 lg:flex-row">
                    <div className="w-full lg:w-1/3">
                      <p className="text-sm font-medium text-slate-800">
                        Label image
                      </p>
                      <p className="mt-1 text-xs text-slate-600">
                        {result.fileName}
                      </p>
                      {fileList[index] ? (
                        <img
                          src={URL.createObjectURL(fileList[index]!)}
                          alt={result.fileName}
                          className="mt-3 w-full rounded-xl border border-slate-200 bg-slate-50 object-contain"
                        />
                      ) : null}
                    </div>
                    <div className="w-full lg:w-2/3">
                      <p className="text-sm font-medium text-slate-800">
                        Field comparison
                      </p>
                      <p className="mt-1 text-xs text-slate-600">
                        Processing time: {result.durationMs.toFixed(0)} ms
                      </p>
                      <div className="mt-3 overflow-x-auto">
                        <table className="min-w-full border-separate border-spacing-y-1 text-xs">
                          <thead>
                            <tr className="text-left text-slate-500">
                              <th className="px-2 py-1 font-medium">Field</th>
                              <th className="px-2 py-1 font-medium">Status</th>
                              <th className="px-2 py-1 font-medium">Expected</th>
                              <th className="px-2 py-1 font-medium">On label</th>
                              <th className="px-2 py-1 font-medium">Notes</th>
                            </tr>
                          </thead>
                          <tbody>
                            {result.checks.map((check, checkIndex) => {
                              const statusColors: Record<typeof check.status, string> =
                                {
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
                                  key={check.field + checkIndex.toString()}
                                  className="rounded-md bg-slate-50 align-top shadow-sm"
                                >
                                  <td className="px-2 py-1.5 text-slate-800">
                                    {labelMap[check.field] ?? check.field}
                                  </td>
                                  <td className="px-2 py-1.5">
                                    <span
                                      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${statusColors[check.status]}`}
                                    >
                                      {check.status === "match" && "Match"}
                                      {check.status === "mismatch" &&
                                        "Needs review"}
                                      {check.status === "missing" &&
                                        "Not found"}
                                    </span>
                                  </td>
                                  <td className="max-w-xs px-2 py-1.5 text-[11px] text-slate-600">
                                    {check.expected ?? "—"}
                                  </td>
                                  <td className="max-w-xs px-2 py-1.5 text-[11px] text-slate-600">
                                    {check.actual ?? "—"}
                                  </td>
                                  <td className="max-w-xs px-2 py-1.5 text-[11px] text-slate-500">
                                    {check.notes ?? "—"}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </section>
              ))
            )}

            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={resetWizard}
                className="inline-flex min-h-[60px] items-center justify-center rounded-lg bg-[#007AFF] px-6 py-4 text-base font-semibold text-white shadow-md transition-transform duration-150 hover:scale-[1.02] hover:bg-[#0066D6]"
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

