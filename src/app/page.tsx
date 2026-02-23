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
  const [simpleMode, setSimpleMode] = useState(true);
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
    setFileList(newFiles);
    setResults([]);
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

          const image = await file.arrayBuffer();
          const uint8 = new Uint8Array(image);

          const { data } = await worker.recognize(uint8);
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-emerald-50 to-amber-50 text-slate-900">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 sm:px-8">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="mt-1 hidden h-10 w-10 items-center justify-center rounded-2xl bg-sky-500 text-xl text-white shadow-sm sm:flex">
              ✓
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                Grandma‑friendly label checker
              </h1>
              <p className="mt-1 text-sm text-slate-700">
                Take a picture of a label, then we check that it matches what the
                application says.
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Under the hood: TTB label verification prototype with on-device
                OCR and detailed comparisons for agents.
              </p>
            </div>
          </div>
          <div className="mt-2 flex flex-col items-start gap-2 text-xs text-slate-600 sm:mt-0 sm:items-end">
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700 ring-1 ring-emerald-100">
              AI‑assisted · OCR on-device
            </span>
            <button
              type="button"
              onClick={() => setSimpleMode((current) => !current)}
              className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
            >
              <span className="inline-block h-2 w-2 rounded-full bg-sky-500" />
              {simpleMode ? "Simple view (on)" : "Simple view (off)"}
            </button>
          </div>
        </header>

        {error ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        {progressMessage ? (
          <div className="flex items-center gap-3 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
            <span className="h-2 w-2 animate-pulse rounded-full bg-sky-500" />
            <span>{progressMessage}</span>
          </div>
        ) : null}

        {!simpleMode && (
          <div className="flex flex-wrap gap-2 text-xs font-medium">
            <span className="mr-1 text-[11px] uppercase tracking-wide text-slate-500">
              Mode:
            </span>
            <button
              type="button"
              onClick={() => setMode("single")}
              className={`rounded-full px-3 py-1 ${
                mode === "single"
                  ? "bg-slate-900 text-white"
                  : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100"
              }`}
            >
              Single label
            </button>
            <button
              type="button"
              onClick={() => setMode("batch")}
              className={`rounded-full px-3 py-1 ${
                mode === "batch"
                  ? "bg-slate-900 text-white"
                  : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100"
              }`}
            >
              Batch (multiple labels)
            </button>
          </div>
        )}

        <main className="grid gap-6 md:grid-cols-[minmax(0,2fr),minmax(0,3fr)]">
          <section className="flex flex-col gap-4">
            <div className="rounded-xl bg-white/80 p-4 shadow-sm ring-1 ring-slate-200 backdrop-blur">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-sky-500 text-xs font-bold text-white">
                  1
                </span>
                Add your label photo
              </h2>
              <p className="mt-1 text-xs text-slate-600">
                Tap the big button and pick a clear picture of the label.
              </p>
              <label className="mt-3 flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-sky-300 bg-sky-50 px-4 py-8 text-center text-sm text-slate-600 shadow-sm hover:border-sky-400 hover:bg-sky-100">
                <input
                  type="file"
                  accept="image/*"
                  multiple={!simpleMode && mode === "batch"}
                  className="hidden"
                  onChange={(event) => handleFilesSelected(event.target.files)}
                />
                <span className="text-lg font-semibold text-slate-900">
                  Tap here to pick a photo
                </span>
                <span className="mt-1 text-xs text-slate-600">
                  {simpleMode
                    ? "One label at a time."
                    : mode === "batch"
                      ? "You can select multiple images at once."
                      : "One label image at a time."}
                </span>
              </label>

              {fileList.length ? (
                <div className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800 ring-1 ring-emerald-100">
                  <p className="font-medium">
                    {fileList.length === 1
                      ? "Photo added."
                      : `${fileList.length} photos added.`}
                  </p>
                  <ul className="mt-1 max-h-24 space-y-1 overflow-y-auto text-[11px]">
                    {fileList.map((file) => (
                      <li
                        key={file.name + file.lastModified}
                        className="flex items-center justify-between gap-2"
                      >
                        <span className="truncate">{file.name}</span>
                        <span className="shrink-0 text-[10px] text-emerald-700/80">
                          {(file.size / 1024).toFixed(0)} KB
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>

            {mode === "single" ? (
              <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-white">
                    2
                  </span>
                  What the application says
                </h2>
                <p className="mt-1 text-xs text-slate-600">
                  These boxes should match the application record. You can use
                  the defaults or change them.
                </p>
                <form
                  className="mt-3 space-y-3 text-xs"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void handleRunSingle();
                  }}
                >
                  <button
                    type="button"
                    className="inline-flex items-center justify-center rounded-full bg-sky-50 px-3 py-1 text-[11px] font-medium text-sky-800 ring-1 ring-sky-200 hover:bg-sky-100"
                    onClick={() => setApplicationData(defaultApplicationData)}
                  >
                    Use standard example values
                  </button>

                  <div className="rounded-lg bg-slate-50 px-3 py-2">
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
                        className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                      />
                    </div>
                    <p className="mt-1 text-[10px] text-slate-500">
                      This should be the main brand name on the application.
                    </p>
                  </div>

                  <details className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700">
                    <summary className="cursor-pointer select-none text-[11px] font-medium text-slate-700">
                      Show other details (for experts)
                    </summary>
                    <div className="mt-2 space-y-3">
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
                          className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
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
                            className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
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
                            className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
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
                          className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                        />
                        <p className="mt-1 text-[10px] text-slate-500">
                          This should match the standard TTB warning text. The
                          tool compares it word-for-word, ignoring spacing and
                          punctuation.
                        </p>
                      </div>
                    </div>
                  </details>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isProcessing}
                      className="inline-flex w-full items-center justify-center rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                    >
                      {isProcessing ? "Checking label..." : "Check this label"}
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

