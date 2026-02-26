/* eslint-disable @next/next/no-img-element */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  STANDARD_GOVERNMENT_WARNING,
  compareLabelData,
  type ApplicationLabelData,
  type ExtractedLabelData,
  type FieldCheck,
} from "@/lib/labelComparison";

type VerificationResult =
  | {
      status: "success";
      fileName: string;
      checks: FieldCheck[];
      rawOcrText: string;
      durationMs: number;
    }
  | {
      status: "ocr_failed";
      fileName: string;
      fileIndex: number; // index in results array; file is fileList[fileIndex] when in sync
    };

type Mode = "single" | "batch";

const defaultApplicationData: ApplicationLabelData = {
  brandName: "STONE'S THROW",
  classType: "India Pale Ale",
  alcoholContent: "6.5% Alc./Vol.",
  netContents: "12 FL OZ",
  bottlerNameAddress: "Stone's Throw Brewing Co, Portland, OR",
  countryOfOrigin: "USA",
  governmentWarning: STANDARD_GOVERNMENT_WARNING,
};

const extractFromOcrText = (text: string): ExtractedLabelData => {
  const cleanText = text
    .replace(/\|/g, " ")
    .replace(/[—–_]{2,}/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const singleLine = text
    .replace(/[\r\n|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const allCaps = text.toUpperCase();

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\|/g, " ").trim())
    .filter(
      (l) =>
        l.length > 2 &&
        !/^[:\-—_\s|]+$/.test(l) &&
        !/(government|warning|surgeon|pregnancy|according)/i.test(l),
    );

  const brandLines = lines
    .slice(0, 3)
    .filter(
      (l) =>
        !/(whiskey|bourbon|vodka|gin|rum|tequila|ipa|lager|wine|proof|alc|vol|ml|oz)/i.test(
          l,
        ),
    );

  const brandName =
    brandLines
      .slice(0, 2)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim() || undefined;

  const typeKeywords = [
    "Kentucky Straight Bourbon Whiskey",
    "Straight Bourbon Whiskey",
    "Bourbon Whiskey",
    "Kentucky Bourbon",
    "Rye Whiskey",
    "Tennessee Whiskey",
    "Single Malt",
    "Blended Whiskey",
    "Scotch Whisky",
    "Irish Whiskey",
    "Whiskey",
    "Whisky",
    "Vodka",
    "Gin",
    "Rum",
    "Tequila",
    "Mezcal",
    "India Pale Ale",
    "IPA",
    "Pale Ale",
    "Amber Ale",
    "Lager",
    "Pilsner",
    "Stout",
    "Porter",
    "Red Wine",
    "White Wine",
    "Rosé Wine",
    "Cabernet Sauvignon",
    "Merlot",
    "Pinot Noir",
    "Chardonnay",
    "Sauvignon Blanc",
    "Wine",
    "Beer",
    "Ale",
  ];

  let classType: string | undefined;

  for (const keyword of typeKeywords) {
    const regex = new RegExp(keyword.replace(/\s+/g, "\\s*"), "i");
    if (regex.test(singleLine)) {
      classType = keyword;
      break;
    }
  }

  if (!classType) {
    const typeWords = [
      "kentucky",
      "straight",
      "bourbon",
      "whiskey",
      "vodka",
      "gin",
      "rum",
      "ipa",
      "lager",
      "stout",
      "wine",
    ];
    const foundWords = typeWords.filter((word) =>
      new RegExp(word, "i").test(singleLine),
    );
    if (foundWords.length > 0) {
      classType = foundWords
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
    }
  }

  let alcoholContent: string | undefined;

  const proofMatch = singleLine.match(/(\d{2,3})\s*Proof/i);
  if (proofMatch) {
    const proof = parseInt(proofMatch[1], 10);
    const abv = (proof / 2).toFixed(1).replace(".0", "");
    alcoholContent = `${abv}% Alc./Vol. (${proof} Proof)`;
  } else {
    let percentText = singleLine;
    percentText = percentText.replace(/BE\s*(\d)/gi, "4$1");
    percentText = percentText.replace(/B5/gi, "85");
    percentText = percentText.replace(/4S/gi, "45");
    percentText = percentText.replace(/O(?=\d)/gi, "0");

    const percentMatch = percentText.match(/(\d{1,2}(?:\.\d)?)\s*%/);
    if (percentMatch) {
      alcoholContent = `${percentMatch[1]}% Alc./Vol.`;
    }
  }

  const netMatch = singleLine.match(
    /(\d+(?:\.\d+)?)\s*(mL|ML|ml|L|l|FL\s*OZ|fl\.?\s*oz|OZ|oz)/i,
  );
  const netContents = netMatch
    ? `${netMatch[1]} ${netMatch[2]}`
    : undefined;

  const warningIndex = allCaps.indexOf("GOVERNMENT WARNING");
  const warningText =
    warningIndex >= 0
      ? text
          .slice(warningIndex, warningIndex + 400)
          .replace(/\s+/g, " ")
          .trim()
      : undefined;



  return {
    brandName,
    classType,
    alcoholContent,
    netContents,
    governmentWarningText: warningText,
  };
};

async function ocrImage(
  file: File,
): Promise<{ text: string; extracted?: ExtractedLabelData }> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  const res = await fetch("/api/ocr", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageBase64: base64, mimeType: file.type }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || res.statusText);
  }
  const data = await res.json();
  const text = data.text ?? "";
  const extractedFromApi = data.extracted as ExtractedLabelData | undefined;

  if (extractedFromApi) {
    return { text, extracted: extractedFromApi };
  }

  // Fallback: try parsing structured JSON from `text`.
  // If Gemini returns non-JSON, we'll fall through and let the caller use `extractFromOcrText(text)`.
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    const strip = (s: string) => s.replace(/\s+/g, " ").trim();

    const extracted: ExtractedLabelData = {
      brandName: typeof parsed.brandName === "string" ? strip(parsed.brandName) : undefined,
      classType: typeof parsed.classType === "string" ? strip(parsed.classType) : undefined,
      alcoholContent:
        typeof parsed.alcoholContent === "string" ? strip(parsed.alcoholContent) : undefined,
      netContents: typeof parsed.netContents === "string" ? strip(parsed.netContents) : undefined,
      bottlerNameAddress:
        typeof parsed.bottlerNameAddress === "string"
          ? strip(parsed.bottlerNameAddress)
          : undefined,
      countryOfOrigin:
        typeof parsed.countryOfOrigin === "string"
          ? strip(parsed.countryOfOrigin)
          : undefined,
      governmentWarningText:
        typeof parsed.governmentWarningText === "string"
          ? strip(parsed.governmentWarningText)
          : undefined,
      governmentWarningHeaderIsAllCaps: parsed.governmentWarningHeaderIsAllCaps === true,
      governmentWarningHeaderIsBold: parsed.governmentWarningHeaderIsBold === true,
    };

    return { text, extracted };
  } catch {
    // no-op
  }
  return {
    text,
  };
}

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

export default function Home() {
  const [mode, setMode] = useState<Mode>("single");
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [applicationData, setApplicationData] = useState<ApplicationLabelData>(
    defaultApplicationData,
  );
  const [batchJson, setBatchJson] = useState("");
  const [fileList, setFileList] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingCurrent, setProcessingCurrent] = useState(0);
  const [processingTotal, setProcessingTotal] = useState(0);
  const [results, setResults] = useState<VerificationResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [progressMessage, setProgressMessage] = useState<string | null>(null);
  const [currentResultIndex, setCurrentResultIndex] = useState(0);
  const [uploadFileTypeError, setUploadFileTypeError] = useState<string | null>(
    null,
  );
  const [catastrophicError, setCatastrophicError] = useState<string | null>(
    null,
  );
  const [reviewMode, setReviewMode] = useState<
    "summary" | "reviewing" | "complete"
  >("summary");
  const [currentReviewIndex, setCurrentReviewIndex] = useState(0);
  const [manualOverrides, setManualOverrides] = useState<
    Record<string, string>
  >({});
  const [flaggedFields, setFlaggedFields] = useState<Set<string>>(new Set());
  const perLabelReviewState = useRef<
    Record<number, { reviewMode: "summary" | "reviewing" | "complete"; currentReviewIndex: number; manualOverrides: Record<string, string>; flaggedFields: Set<string> }>
  >({});
  const replaceFileInputRef = useRef<HTMLInputElement>(null);
  const [replacingResultIndex, setReplacingResultIndex] = useState<
    number | null
  >(null);
  const [pendingReplaceResultIndex, setPendingReplaceResultIndex] = useState<
    number | null
  >(null);
  const [govWarningExpanded, setGovWarningExpanded] = useState(false);
  const [batchTab, setBatchTab] = useState<"summary" | "detail">("detail");
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [processingPreviewUrl, setProcessingPreviewUrl] = useState<
    string | null
  >(null);
  const processingThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [processingFieldLabel, setProcessingFieldLabel] = useState("");
  const [batchStartTime, setBatchStartTime] = useState(0);

  useEffect(() => {
    if (isProcessing && fileList.length > 0) {
      const idx = Math.min(processingCurrent, fileList.length - 1);
      const url = URL.createObjectURL(fileList[idx]);
      setProcessingPreviewUrl(url);
      return () => {
        URL.revokeObjectURL(url);
        setProcessingPreviewUrl(null);
      };
    }
    setProcessingPreviewUrl(null);
  }, [isProcessing, fileList, processingCurrent]);

  useEffect(() => {
    if (!isProcessing) {
      setProcessingFieldLabel("");
      return;
    }
    const fields = ["Brand name", "Class/Type", "Alcohol content", "Net contents", "Bottler/Producer", "Country of origin", "Government warning"];
    let i = 0;
    setProcessingFieldLabel(fields[0]);
    const cycle = setInterval(() => {
      i = (i + 1) % fields.length;
      setProcessingFieldLabel(fields[i]);
    }, 800);
    return () => clearInterval(cycle);
  }, [isProcessing, processingCurrent]);

  const handleFilesSelected = (files: FileList | null) => {
    if (!files) return;
    setError(null);
    const allFiles = Array.from(files);
    const images = allFiles.filter((file) => file.type.startsWith("image/"));
    const hasUnsupported = allFiles.some(
      (file) => !file.type.startsWith("image/"),
    );
    if (hasUnsupported) {
      setUploadFileTypeError(
        "PDF files aren't supported. Please upload JPG or PNG images.",
      );
    }
    if (!images.length) {
      setError("Please select one or more image files.");
      return;
    }

    setFileList((current) => {
      if (current.length) {
        const existingKeys = new Set(
          current.map((file) => `${file.name}-${file.lastModified}`),
        );
        const deduped = images.filter(
          (file) => !existingKeys.has(`${file.name}-${file.lastModified}`),
        );
        return deduped.length ? [...current, ...deduped] : current;
      }
      return images;
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

  useEffect(() => {
    if (!uploadFileTypeError) return;
    const t = setTimeout(() => setUploadFileTypeError(null), 5000);
    return () => clearTimeout(t);
  }, [uploadFileTypeError]);

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
      setCatastrophicError(null);
      setReviewMode("summary");
      setCurrentReviewIndex(0);
      setManualOverrides({});
      setFlaggedFields(new Set());
      setCurrentResultIndex(0);
      setProgressMessage("Reading label...");
      setProcessingTotal(files.length);
      setProcessingCurrent(0);
      setBatchStartTime(performance.now());

      try {
        const newResults: VerificationResult[] = [];
        const BATCH_SIZE = 3;

        for (let batchStart = 0; batchStart < files.length; batchStart += BATCH_SIZE) {
          const batchEnd = Math.min(batchStart + BATCH_SIZE, files.length);

          const batchItems = files.slice(batchStart, batchEnd).map((file, i) => ({
            file,
            index: batchStart + i,
            appData:
              applications[batchStart + i] ??
              applications[applications.length - 1],
          }));

          let batchCompleted = 0;
          const batchResults = await Promise.all(
            batchItems.map(async ({ file, index, appData }) => {
              const start = performance.now();
              try {
                const timeoutMs = 30000;
                const ocrPromise = ocrImage(file);
                const timeoutPromise = new Promise<never>((_, reject) =>
                  setTimeout(() => reject(new Error("OCR timeout")), timeoutMs),
                );
                const { text: ocrText, extracted: extractedFromApi } =
                  await Promise.race([ocrPromise, timeoutPromise]);
                if (process.env.NODE_ENV === "development") {
                  console.log("RAW OCR TEXT:", ocrText);
                }
                const extracted =
                  extractedFromApi ?? extractFromOcrText(ocrText);
                const checks = compareLabelData(appData, extracted);
                const durationMs = performance.now() - start;
                batchCompleted++;
                setProcessingCurrent(batchStart + batchCompleted);
                return {
                  status: "success" as const,
                  fileName: file.name,
                  checks,
                  rawOcrText: ocrText,
                  durationMs,
                };
              } catch {
                batchCompleted++;
                setProcessingCurrent(batchStart + batchCompleted);
                return {
                  status: "ocr_failed" as const,
                  fileName: file.name,
                  fileIndex: index,
                };
              }
            }),
          );

          newResults.push(...batchResults);
          setResults([...newResults]);
        }
        setProgressMessage(null);
        setStep(3);
      } catch (e) {
        setCatastrophicError(
          "OCR processing stopped unexpectedly. Your images are safe—try again or contact support.",
        );
      } finally {
        setIsProcessing(false);
        setProgressMessage(null);
        setProcessingCurrent(0);
        setProcessingTotal(0);
      }
    },
    [],
  );

  const normalizeApplicationDataForDomestic = useCallback(
    (app: ApplicationLabelData): ApplicationLabelData => {
      const co = (app.countryOfOrigin ?? "").trim();
      if (co) return app;
      const bottler = (app.bottlerNameAddress ?? "").toUpperCase();
      const usKeywords = ["USA", "UNITED STATES", " U.S.", " U.S.A.", " U.S.,", " USA,"];
      const usStateCode = /\b(AK|AL|AR|AZ|CA|CO|CT|DE|FL|GA|HI|IA|ID|IL|IN|KS|KY|LA|MA|MD|ME|MI|MN|MO|MS|MT|NC|ND|NE|NH|NJ|NM|NV|NY|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VA|VT|WA|WI|WV|WY)\b/;
      const isDomestic = usKeywords.some((kw) => bottler.includes(kw)) || usStateCode.test(bottler);
      return isDomestic ? { ...app, countryOfOrigin: "USA" } : app;
    },
    [],
  );

  const handleRunSingle = async () => {
    await runVerification(fileList, [normalizeApplicationDataForDomestic(applicationData)]);
  };

  const handleRunBatch = async () => {
    if (!parsedBatchData) {
      setError("Batch JSON must be a valid array of applications.");
      return;
    }
    await runVerification(fileList, parsedBatchData);
  };

  const handleRunWizard = () => {
    void runVerification(fileList, [normalizeApplicationDataForDomestic(applicationData)]);
  };

  const runSingleImageVerification = useCallback(
    async (resultIndex: number, fileOverride?: File) => {
      const file = fileOverride ?? fileList[resultIndex];
      if (!file) return;
      setReplacingResultIndex(resultIndex);
      try {
        const start = performance.now();
        const { text: ocrText, extracted: extractedFromApi } =
          await ocrImage(file);
        if (process.env.NODE_ENV === "development") {
          console.log("RAW OCR TEXT:", ocrText);
        }
        const extracted =
          extractedFromApi ?? extractFromOcrText(ocrText);
        const checks = compareLabelData(applicationData, extracted);
        const durationMs = performance.now() - start;
        setResults((prev) => {
          const next = [...prev];
          next[resultIndex] = {
            status: "success",
            fileName: file.name,
            checks,
            rawOcrText: ocrText,
            durationMs,
          };
          return next;
        });
      } catch {
        setResults((prev) => {
          const next = [...prev];
          const existing = next[resultIndex];
          if (existing?.status === "ocr_failed")
            next[resultIndex] = { ...existing };
          return next;
        });
      } finally {
        setReplacingResultIndex(null);
      }
    },
    [fileList, applicationData],
  );

  const skipLabelAtResultIndex = useCallback((resultIndex: number) => {
    setResults((prev) => prev.filter((_, i) => i !== resultIndex));
    setFileList((prev) => prev.filter((_, i) => i !== resultIndex));
    setCurrentResultIndex((i) =>
      i >= resultIndex ? Math.max(0, i - 1) : i,
    );
  }, []);

  const replaceFileAtResultIndex = useCallback(
    (resultIndex: number, newFile: File) => {
      setFileList((prev) => {
        const next = [...prev];
        next[resultIndex] = newFile;
        return next;
      });
      void runSingleImageVerification(resultIndex, newFile);
    },
    [runSingleImageVerification],
  );

  const scrollToFirstFailedRef = useRef<HTMLDivElement>(null);


  const resetWizard = () => {
    setMode("single");
    setStep(1);
    setApplicationData(defaultApplicationData);
    setBatchJson("");
    setFileList([]);
    setResults([]);
    setError(null);
    setCatastrophicError(null);
    setUploadFileTypeError(null);
    setProgressMessage(null);
    setProcessingCurrent(0);
    setProcessingTotal(0);
    setCurrentResultIndex(0);
    setReplacingResultIndex(null);
    setPendingReplaceResultIndex(null);
    setBatchTab("detail");
    setConfirmingReset(false);
    setFlaggedFields(new Set());
  };

  /* Keyboard shortcuts (enhance only; every action has a visible button) */
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isTextarea = target.tagName === "TEXTAREA";
      const isInput = target.tagName === "INPUT";

      if (e.key === "Escape") {
        if (step === 2) {
          setStep(1);
          e.preventDefault();
        } else if (step === 3 && !isProcessing) {
          setStep(2);
          e.preventDefault();
        }
        return;
      }

      if (step === 2 && e.key === "Enter" && !isTextarea) {
        const form = target.closest("form");
        if (form && !isProcessing && fileList.length > 0) {
          handleRunWizard();
          e.preventDefault();
        }
        return;
      }

      if (step === 3 && results.length > 1) {
        if (e.key === "ArrowLeft") {
          setCurrentResultIndex((i) => Math.max(0, i - 1));
          e.preventDefault();
        } else if (e.key === "ArrowRight") {
          setCurrentResultIndex((i) => Math.min(results.length - 1, i + 1));
          e.preventDefault();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [step, isProcessing, fileList.length, results.length]);

  /* Save/restore per-label review state when switching labels */
  const prevResultIndex = useRef(currentResultIndex);
  useEffect(() => {
    const prev = prevResultIndex.current;
    if (prev !== currentResultIndex) {
      perLabelReviewState.current[prev] = {
        reviewMode,
        currentReviewIndex,
        manualOverrides,
        flaggedFields,
      };
      const saved = perLabelReviewState.current[currentResultIndex];
      if (saved) {
        setReviewMode(saved.reviewMode);
        setCurrentReviewIndex(saved.currentReviewIndex);
        setManualOverrides(saved.manualOverrides);
        setFlaggedFields(saved.flaggedFields);
      } else {
        setReviewMode("summary");
        setCurrentReviewIndex(0);
        setManualOverrides({});
        setFlaggedFields(new Set());
      }
      setGovWarningExpanded(false);
      setConfirmingReset(false);
      prevResultIndex.current = currentResultIndex;
    }
  }, [currentResultIndex, reviewMode, currentReviewIndex, manualOverrides, flaggedFields]);

  /* Collapse gov warning when moving between fields */
  useEffect(() => {
    setGovWarningExpanded(false);
  }, [currentReviewIndex]);

  const renderProgress = () => {
    const hasBatchSummary = step === 3 && results.length >= 1;
    const isOnSummaryTab = hasBatchSummary && batchTab === "summary";
    const isStep1 = step === 1;
    return (
      <div
        className={`mb-6 flex items-center gap-3 ${isStep1 ? "step1-progress-in" : ""}`}
      >
        <span className="text-[17px] font-bold text-[#1C1C1E]">
          {step === 1 && "Step 1 of 3"}
          {step === 2 && "Step 2 of 3"}
          {step === 3 && !hasBatchSummary && "Step 3 of 3"}
          {step === 3 && hasBatchSummary && !isOnSummaryTab && "Step 3 of 4"}
          {step === 3 && hasBatchSummary && isOnSummaryTab && "Step 4 of 4"}
        </span>
        <div className="flex items-center gap-2">
          {[1, 2, 3].map((s) => (
            <span
              key={s}
              className={`rounded-full transition-all duration-300 ${
                step === s && !isOnSummaryTab
                  ? "progress-dot-active h-3.5 w-3.5 scale-125 bg-[#007AFF] sm:scale-[1.4]"
                  : step > s || (step === s && isOnSummaryTab)
                    ? "h-3.5 w-3.5 bg-[#30D158]"
                    : "h-3.5 w-3.5 bg-[#C7C7CC]"
              }`}
              style={
                step === s && !isOnSummaryTab
                  ? { boxShadow: "0 0 8px rgba(0, 122, 255, 0.5)" }
                  : undefined
              }
            />
          ))}
          {hasBatchSummary && (
            <span
              className={`rounded-full transition-all duration-300 ${
                isOnSummaryTab
                  ? "progress-dot-active h-3.5 w-3.5 scale-125 bg-[#007AFF] sm:scale-[1.4]"
                  : "h-3.5 w-3.5 bg-[#C7C7CC]"
              }`}
              style={
                isOnSummaryTab
                  ? { boxShadow: "0 0 8px rgba(0, 122, 255, 0.5)" }
                  : undefined
              }
            />
          )}
        </div>
      </div>
    );
  };

  /* Screen reader: announce step changes */
  const stepAnnouncement =
    step === 1
      ? "Step 1 of 3: Upload label image"
      : step === 2
        ? "Step 2 of 3: Enter application data"
        : "Step 3 of 3: Comparison results";

  if (step === 1) {
    return (
      <>
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="sr-only"
          key={step}
        >
          {stepAnnouncement}
        </div>
        {catastrophicError ? (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            style={{
              backdropFilter: "blur(12px)",
              backgroundColor: "rgba(0,0,0,0.2)",
            }}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="catastrophic-error-heading"
          >
            <div
              className="w-full max-w-md animate-fade-scale-in rounded-[20px] bg-white p-6 depth-3"
              style={{ animationDuration: "0.3s" }}
            >
              <div className="flex flex-col items-center gap-4 text-center">
                <span className="flex h-10 w-10 items-center justify-center text-[40px] text-[#8E8E93]" aria-hidden>⚠</span>
                <h2 id="catastrophic-error-heading" className="text-[22px] font-semibold text-[#1C1C1E]">Something went wrong</h2>
                <p className="text-[16px] leading-relaxed text-[#8E8E93]">{catastrophicError}</p>
                <div className="flex w-full flex-col gap-3 pt-2">
                  <button type="button" onClick={() => setCatastrophicError(null)} className="flex min-h-[56px] w-full items-center justify-center rounded-[16px] bg-[#007AFF] px-4 py-3 text-[16px] font-semibold text-white depth-2">Try again</button>
                  <a href="mailto:support@example.com?subject=TTB%20Label%20App%20Support" className="min-h-[44px] text-[16px] font-normal text-[#8E8E93] hover:text-[#1C1C1E]">Contact support</a>
                </div>
              </div>
            </div>
          </div>
        ) : null}
        <div className="min-h-screen depth-0 text-[#1C1C1E]">
        <div className="mx-auto flex max-w-xl flex-col gap-10 px-4 py-10 sm:py-12">
          <header className="space-y-2">
            <p
              className="text-[13px] font-semibold tracking-wide text-[#8E8E93]"
              style={{ letterSpacing: "0.5px" }}
            >
              TTB Label Verification
            </p>
            {renderProgress()}
            <div className="step1-header-in flex items-center gap-4">
              <div
                className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-4xl"
                style={{
                  background: "linear-gradient(180deg, #007AFF 0%, #0051D5 100%)",
                  color: "white",
                }}
              >
                📸
              </div>
              <div>
                <h1 className="text-[32px] font-bold tracking-tight text-[#1C1C1E]">
                  Upload label image
                </h1>
                <p className="mt-1 text-[20px] text-[#8E8E93]">
                  Select one or more label images
                </p>
              </div>
            </div>
          </header>

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

          <main className="flex flex-col gap-10">
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
                onClick={() => setStep(2)}
                className="w-full min-h-[56px] rounded-[16px] px-6 py-4 text-[16px] font-semibold text-white transition-all duration-500 hover:scale-[1.02] active:scale-[0.97] disabled:opacity-50 disabled:grayscale disabled:hover:scale-100 sm:w-auto"
                style={{
                  background:
                    "linear-gradient(180deg, #007AFF 0%, #0051D5 100%)",
                  boxShadow: "0 4px 16px rgba(0, 0, 0, 0.08)",
                }}
              >
                Next: Add application data
              </button>
            </div>
            <p className="pt-6 text-center text-[13px] text-[#8E8E93]">
              We encourage you to review TTB&apos;s guidelines at{" "}
              <a href="https://www.ttb.gov" target="_blank" rel="noopener noreferrer" className="underline hover:text-[#1C1C1E]">ttb.gov</a>{" "}
              for additional context on label requirements.
            </p>
          </main>
        </div>
      </div>
    </>
    );
  }

  if (step === 2) {
    const firstFile = fileList[0];

    return (
      <div className="min-h-screen depth-0 text-[#1C1C1E]">
        <div role="status" aria-live="polite" aria-atomic="true" className="sr-only" key={step}>
          {stepAnnouncement}
        </div>
        {catastrophicError ? (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            style={{
              backdropFilter: "blur(12px)",
              backgroundColor: "rgba(0,0,0,0.2)",
            }}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="catastrophic-error-heading"
          >
            <div
              className="w-full max-w-md animate-fade-scale-in rounded-[20px] bg-white p-6 depth-3"
              style={{ animationDuration: "0.3s" }}
            >
              <div className="flex flex-col items-center gap-4 text-center">
                <span
                  className="flex h-10 w-10 items-center justify-center text-[40px] text-[#8E8E93]"
                  aria-hidden
                >
                  ⚠
                </span>
                <h2
                  id="catastrophic-error-heading"
                  className="text-[22px] font-semibold text-[#1C1C1E]"
                >
                  Something went wrong
                </h2>
                <p className="text-[16px] leading-relaxed text-[#8E8E93]">
                  {catastrophicError}
                </p>
                <div className="flex w-full flex-col gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setCatastrophicError(null)}
                    className="flex min-h-[56px] w-full items-center justify-center rounded-[16px] bg-[#007AFF] px-4 py-3 text-[16px] font-semibold text-white depth-2"
                  >
                    Try again
                  </button>
                  <a
                    href="mailto:support@example.com?subject=TTB%20Label%20App%20Support"
                    className="min-h-[44px] text-[16px] font-normal text-[#8E8E93] hover:text-[#1C1C1E]"
                  >
                    Contact support
                  </a>
                </div>
              </div>
            </div>
          </div>
        ) : null}
        <div className="mx-auto flex max-w-xl flex-col gap-10 px-4 py-10 sm:py-12">
          <header className="space-y-2">
            {renderProgress()}
            <div className="step2-header-in flex items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#007AFF]/10 text-3xl">
                📝
              </div>
              <div>
                <h1 className="text-[32px] font-bold tracking-tight text-[#1C1C1E]">
                  Enter application data
                </h1>
                <p className="mt-1 text-[20px] text-[#8E8E93]">
                  Enter the fields from the approved COLA application record for this label.
                </p>
              </div>
            </div>
          </header>

          {error ? (
            <div className="rounded-[20px] border border-[#FF3B30]/30 bg-red-50 px-4 py-3 text-[16px] text-[#FF3B30] depth-1">
              {error}
            </div>
          ) : null}

          <main className="flex flex-col gap-10">
            {firstFile ? (
              <section
                className="step2-preview-in flex h-[88px] items-center gap-4 rounded-[20px] bg-white px-4 depth-1"
                style={{ minHeight: "88px" }}
              >
                <img
                  src={URL.createObjectURL(firstFile)}
                  alt=""
                  className="h-[72px] w-[72px] shrink-0 rounded-[16px] bg-[#F2F2F7] object-contain"
                />
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

            <section
              className="overflow-hidden rounded-[20px] bg-white p-8 depth-1"
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
                  className="text-[14px] font-semibold uppercase tracking-wider text-[#8E8E93]"
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
                    className="mb-1.5 block text-[14px] font-medium text-[#8E8E93]"
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
                  <p className="mt-1 text-[14px] text-[#8E8E93]" style={{ opacity: 0.6 }}>
                    Primary brand name on the approved application
                  </p>
                </div>

                <div className="step2-field-in space-y-1.5">
                  <label
                    htmlFor="class-type"
                    className="block text-[14px] font-medium text-[#8E8E93]"
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
                    placeholder="e.g., Bourbon Whiskey, IPA, Cabernet Sauvignon"
                    className="input-apple h-14 w-full rounded-[16px] border border-[#E5E5EA] bg-white px-4 text-[16px] text-[#1C1C1E] placeholder:opacity-60"
                    style={{ minHeight: "56px" }}
                  />
                </div>

                <div className="step2-field-in grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="alcohol"
                      className="block text-[14px] font-medium text-[#8E8E93]"
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
                      placeholder="e.g., 45% Alc./Vol. or 90 Proof"
                      className="input-apple h-14 w-full rounded-[16px] border border-[#E5E5EA] bg-white px-4 text-[16px] text-[#1C1C1E] placeholder:opacity-60"
                      style={{ minHeight: "56px" }}
                    />
                    <p className="mt-1 text-[12px] text-[#8E8E93]">
                      Optional for some wine/beer types
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <label
                      htmlFor="net-contents"
                      className="block text-[14px] font-medium text-[#8E8E93]"
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
                      placeholder="e.g., 750 mL or 12 fl oz"
                      className="input-apple h-14 w-full rounded-[16px] border border-[#E5E5EA] bg-white px-4 text-[16px] text-[#1C1C1E] placeholder:opacity-60"
                      style={{ minHeight: "56px" }}
                    />
                  </div>
                </div>

                <div className="step2-field-in space-y-1.5">
                  <label
                    htmlFor="bottler-name-address"
                    className="block text-[14px] font-medium text-[#8E8E93]"
                  >
                    Bottler/Producer name & address
                  </label>
                  <input
                    id="bottler-name-address"
                    type="text"
                    value={applicationData.bottlerNameAddress}
                    onChange={(event) =>
                      setApplicationData((current) => ({
                        ...current,
                        bottlerNameAddress: event.target.value,
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
                    className="block text-[14px] font-medium text-[#8E8E93]"
                  >
                    Country of origin
                  </label>
                  <input
                    id="country-of-origin"
                    type="text"
                    value={applicationData.countryOfOrigin}
                    onChange={(event) =>
                      setApplicationData((current) => ({
                        ...current,
                        countryOfOrigin: event.target.value,
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
                    className="block text-[14px] font-medium text-[#8E8E93]"
                  >
                    Government health warning
                  </label>
                  <textarea
                    id="government-warning"
                    value={applicationData.governmentWarning}
                    onChange={(event) =>
                      setApplicationData((current) => ({
                        ...current,
                        governmentWarning: event.target.value,
                      }))
                    }
                    rows={4}
                    className="input-apple w-full resize-y rounded-[16px] border border-[#E5E5EA] bg-white px-4 py-3 text-[16px] leading-relaxed text-[#1C1C1E] placeholder:opacity-60"
                    style={{ lineHeight: 1.6 }}
                  />
                  <p className="mt-1 text-[12px] text-[#8E8E93]">
                    Standard TTB warning (pre-filled)
                  </p>
                </div>

                <div className="step2-buttons-in flex flex-col gap-4 pt-2">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="self-start min-h-[44px] min-w-[44px] text-[16px] font-normal text-[#007AFF] transition-opacity hover:opacity-80"
                    title="Go back (Escape)"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={isProcessing || !fileList.length || !applicationData.brandName.trim()}
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
              <a href="https://www.ttb.gov" target="_blank" rel="noopener noreferrer" className="underline hover:text-[#1C1C1E]">ttb.gov</a>{" "}
              for additional context on label requirements.
            </p>
          </main>
        </div>
        {isProcessing && (
          <div
            className="animate-loading-screen-in fixed inset-0 z-50 flex flex-col items-center overflow-y-auto bg-[#F5F7FA] px-4 pt-12 pb-10"
            aria-live="polite"
            aria-busy="true"
          >
            <div className="animate-loading-content-in flex flex-col items-center">
              {processingPreviewUrl ? (
                <img
                  src={processingPreviewUrl}
                  alt=""
                  className="h-[280px] w-auto max-w-[380px] shrink-0 object-contain rounded-[20px] depth-1 bg-white"
                />
              ) : (
                <div className="h-[280px] w-[380px] shrink-0 rounded-[20px] bg-[#E5E5EA] depth-1" />
              )}
              <p className="mt-5 text-[28px] font-bold text-[#1C1C1E]">
                {processingTotal > 1
                  ? `Processing label ${processingCurrent} of ${processingTotal}`
                  : "Analyzing label..."}
              </p>
              <p className="mt-2 text-[20px] text-[#8E8E93]">
                {processingFieldLabel ? `Checking ${processingFieldLabel}...` : "Starting..."}
              </p>
            </div>
            {processingTotal > 1 && (
              <div className="mx-auto mt-4 w-full max-w-[600px]">
                <div
                  className="h-1.5 w-full overflow-hidden rounded-full bg-[#E5E5EA]"
                  role="progressbar"
                  aria-valuenow={processingCurrent}
                  aria-valuemin={0}
                  aria-valuemax={processingTotal}
                >
                  <div
                    className="h-full rounded-full bg-[#007AFF] transition-all duration-300 ease-out"
                    style={{
                      width: processingTotal
                        ? `${(processingCurrent / processingTotal) * 100}%`
                        : "0%",
                    }}
                  />
                </div>
              </div>
            )}
            <div className="animate-loading-content-in mx-auto mt-8 flex w-full max-w-[600px] flex-col gap-4" style={{ animationDelay: "0.15s" }}>
              {[
                "Brand name",
                "Class/Type",
                "Alcohol content",
                "Net contents",
                "Bottler/Producer name & address",
                "Country of origin",
                "Government warning",
              ].map((label) => (
                <div key={label} className="flex flex-col gap-2">
                  <span className="text-[14px] font-medium text-[#8E8E93]">
                    {label}
                  </span>
                  <div
                    className="skeleton-shimmer h-12 w-full rounded-[16px]"
                    aria-hidden
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (step === 3) {
    const hasResults = results.length > 0;
    const safeIndex =
      currentResultIndex < results.length ? currentResultIndex : 0;
    const activeResult = hasResults ? results[safeIndex] : null;
    const failedCount = results.filter((r) => r.status === "ocr_failed").length;
    const firstFailedIndex = results.findIndex((r) => r.status === "ocr_failed");
    const activeIsSuccess =
      activeResult != null && activeResult.status === "success";
    const activeIsFailed =
      activeResult != null && activeResult.status === "ocr_failed";
    const anyIssue =
      activeIsSuccess &&
      activeResult.checks.some(
        (check) => check.status === "mismatch" || check.status === "missing",
      );
    const issueCount =
      activeIsSuccess
        ? activeResult.checks.filter(
            (c) => c.status === "mismatch" || c.status === "missing",
          ).length
        : 0;
    const anyResultHasIssues = results.some(
      (r) =>
        r.status === "success" &&
        r.checks.some((c) => c.status !== "match"),
    );

    return (
      <>
        <div role="status" aria-live="polite" aria-atomic="true" className="sr-only" key={step}>
          {stepAnnouncement}
        </div>
        {catastrophicError ? (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            style={{ backdropFilter: "blur(12px)", backgroundColor: "rgba(0,0,0,0.2)" }}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="catastrophic-error-heading"
          >
            <div className="w-full max-w-md animate-fade-scale-in rounded-[20px] bg-white p-6 depth-3" style={{ animationDuration: "0.3s" }}>
              <div className="flex flex-col items-center gap-4 text-center">
                <span className="flex h-10 w-10 items-center justify-center text-[40px] text-[#8E8E93]" aria-hidden>⚠</span>
                <h2 id="catastrophic-error-heading" className="text-[22px] font-semibold text-[#1C1C1E]">Something went wrong</h2>
                <p className="text-[16px] leading-relaxed text-[#8E8E93]">{catastrophicError}</p>
                <div className="flex w-full flex-col gap-3 pt-2">
                  <button type="button" onClick={() => setCatastrophicError(null)} className="flex min-h-[56px] w-full items-center justify-center rounded-[16px] bg-[#007AFF] px-4 py-3 text-[16px] font-semibold text-white depth-2">Try again</button>
                  <a href="mailto:support@example.com?subject=TTB%20Label%20App%20Support" className="min-h-[44px] text-[16px] font-normal text-[#8E8E93] hover:text-[#1C1C1E]">Contact support</a>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      <div className="min-h-screen depth-0 text-[#1C1C1E]">
        <div
          className="animate-fade-scale-in mx-auto flex max-w-5xl flex-col gap-10 px-4 py-10"
          style={{ animationDuration: "0.55s", animationTimingFunction: "ease-out" }}
        >
          <header className="space-y-2">
            {renderProgress()}
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#30D158]/10 text-2xl text-[#30D158]">
                ✓
              </div>
              <div>
                <h1 className="text-[32px] font-bold tracking-tight text-[#1C1C1E]">
                  Comparison results
                </h1>
                <p className="mt-1 text-[20px] text-[#8E8E93]">
                  Review how the label matches the application data.
                </p>
              </div>
            </div>
          </header>

          {error ? (
            <div className="rounded-[20px] border border-[#FF3B30]/30 bg-red-50 px-4 py-3 text-[16px] text-[#FF3B30] depth-1">
              {error}
            </div>
          ) : null}

          {failedCount > 0 && results.length > 1 && (
            <section
              ref={scrollToFirstFailedRef}
              className="animate-fade-scale-in rounded-[20px] px-5 py-4 depth-1"
              style={{
                background: "linear-gradient(135deg, #FFF4E5 0%, #FFF9F0 100%)",
              }}
              role="alert"
              aria-live="polite"
            >
              <div className="flex items-start gap-3">
                <span className="mt-0.5 text-[28px] text-[#FF9F0A]" aria-hidden>
                  ⚠
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[17px] font-semibold text-[#1C1C1E]">
                    {failedCount} label{failedCount !== 1 ? "s" : ""} couldn't
                    be processed
                  </p>
                  <p className="mt-1 text-[15px] text-[#8E8E93]">
                    Upload clearer images to try again.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      document.getElementById("first-failed-label")?.scrollIntoView({ behavior: "smooth" });
                    }}
                    className="mt-3 text-[16px] font-semibold text-[#007AFF] hover:opacity-80"
                  >
                    Review failed labels ↓
                  </button>
                </div>
              </div>
            </section>
          )}

          {results.length >= 1 && (
            <div className="flex gap-1 rounded-[12px] bg-[#F2F2F7] p-1">
              <button
                type="button"
                onClick={() => setBatchTab("detail")}
                className={`flex-1 rounded-[10px] px-4 py-2 text-[15px] font-semibold transition-all duration-200 ${
                  batchTab === "detail"
                    ? "bg-white text-[#1C1C1E] shadow-sm"
                    : "text-[#8E8E93] hover:text-[#1C1C1E]"
                }`}
              >
                Label {safeIndex + 1} of {results.length}
              </button>
              <button
                type="button"
                onClick={() => setBatchTab("summary")}
                className={`flex-1 rounded-[10px] px-4 py-2 text-[15px] font-semibold transition-all duration-200 ${
                  batchTab === "summary"
                    ? "bg-white text-[#1C1C1E] shadow-sm"
                    : "text-[#8E8E93] hover:text-[#1C1C1E]"
                }`}
              >
                Step 4: Summary
              </button>
            </div>
          )}

          <main className="flex flex-col gap-10">
            {batchTab === "summary" && results.length >= 1 ? (
              <section className="mx-auto flex w-full max-w-[600px] flex-col gap-4">
                {/* Aggregate stats */}
                {(() => {
                  const passedCount = results.filter((r) => r.status === "success" && r.checks.every((c) => c.status === "match")).length;
                  const reviewCount = results.filter((r) => r.status === "success" && r.checks.some((c) => c.status !== "match")).length;
                  const ocrFailedCount = results.filter((r) => r.status === "ocr_failed").length;
                  const totalMs = results.filter((r) => r.status === "success").reduce((sum, r) => sum + (r.status === "success" ? r.durationMs : 0), 0);
                  const avgMs = totalMs / Math.max(1, results.filter((r) => r.status === "success").length);
                  const totalSec = totalMs / 1000;
                  const totalTimeStr = totalSec >= 60 ? `${Math.floor(totalSec / 60)}m ${Math.round(totalSec % 60)}s` : `${totalSec.toFixed(1)}s`;
                  return (
                    <div className="rounded-[20px] bg-white p-5 depth-1">
                      <p className="text-[17px] font-semibold text-[#1C1C1E]">Verification Complete</p>
                      <p className="mt-1 text-[13px] text-[#8E8E93]">
                        {results.length} label{results.length !== 1 ? "s" : ""} processed
                      </p>
                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <div className="rounded-[12px] bg-[#F2F2F7] px-3 py-2.5 text-center">
                          <p className="text-[22px] font-bold text-[#1C1C1E]">{totalTimeStr}</p>
                          <p className="text-[12px] text-[#3C3C43]">Total time</p>
                        </div>
                        <div className="rounded-[12px] bg-[#F2F2F7] px-3 py-2.5 text-center">
                          <p className="text-[22px] font-bold text-[#1C1C1E]">{(avgMs / 1000).toFixed(1)}s</p>
                          <p className="text-[12px] text-[#3C3C43]">Avg per label</p>
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-3">
                        <div className="rounded-[12px] bg-[#F2F2F7] px-3 py-2.5 text-center">
                          <p className="text-[22px] font-bold text-[#248A3D]">{passedCount}</p>
                          <p className="text-[12px] text-[#3C3C43]">Passed</p>
                        </div>
                        <div className="rounded-[12px] bg-[#F2F2F7] px-3 py-2.5 text-center">
                          <p className="text-[22px] font-bold text-[#FF9500]">{reviewCount}</p>
                          <p className="text-[12px] text-[#3C3C43]">Need review</p>
                        </div>
                        <div className="rounded-[12px] bg-[#F2F2F7] px-3 py-2.5 text-center">
                          <p className="text-[22px] font-bold text-[#D70015]">{ocrFailedCount}</p>
                          <p className="text-[12px] text-[#3C3C43]">Failed</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
                          const passedCount = results.filter((r) => r.status === "success" && r.checks.every((c) => c.status === "match")).length;
                          const reviewCount = results.filter((r) => r.status === "success" && r.checks.some((c) => c.status !== "match")).length;
                          const ocrFailedCount = results.filter((r) => r.status === "ocr_failed").length;
                          const totalMs = results.filter((r) => r.status === "success").reduce((sum, r) => sum + (r.status === "success" ? r.durationMs : 0), 0);
                          const avgMs = totalMs / Math.max(1, results.filter((r) => r.status === "success").length);
                          const totalSec = totalMs / 1000;
                          const totalTimeStr = totalSec >= 60 ? `${Math.floor(totalSec / 60)}m ${Math.round(totalSec % 60)}s` : `${totalSec.toFixed(1)}s`;
                          const rows: string[] = [];
                          rows.push("Verification Summary");
                          rows.push(["Metric", "Value"].join(","));
                          rows.push(["Total labels", String(results.length)].join(","));
                          rows.push(["Total time", totalTimeStr].join(","));
                          rows.push(["Avg per label", `${(avgMs / 1000).toFixed(1)}s`].join(","));
                          rows.push(["Passed", String(passedCount)].join(","));
                          rows.push(["Need review", String(reviewCount)].join(","));
                          rows.push(["Failed (OCR)", String(ocrFailedCount)].join(","));
                          rows.push("");
                          rows.push("Per-Label Detail");
                          const fieldKeys = ["brandName", "classType", "alcoholContent", "netContents", "bottlerNameAddress", "countryOfOrigin", "governmentWarning", "alcoholContentFormat"];
                          const fieldLabels: Record<string, string> = { brandName: "Brand name", classType: "Class/Type", alcoholContent: "Alcohol content", netContents: "Net contents", bottlerNameAddress: "Bottler/Producer", countryOfOrigin: "Country of origin", governmentWarning: "Government warning", alcoholContentFormat: "ABV abbreviation" };
                          const header = ["File Name"];
                          for (const fk of fieldKeys) {
                            header.push(`${fieldLabels[fk]} Status`, `${fieldLabels[fk]} Expected`, `${fieldLabels[fk]} Found`);
                          }
                          header.push("Reviewer Decision", "Issues", "Duration (s)");
                          rows.push(header.join(","));
                          for (let ri = 0; ri < results.length; ri++) {
                            const r = results[ri];
                            if (r.status !== "success") {
                              const cells = [esc(r.fileName)];
                              for (let fi = 0; fi < fieldKeys.length; fi++) { cells.push("", "", ""); }
                              cells.push("", "OCR Failed", "");
                              rows.push(cells.join(","));
                              continue;
                            }
                            const saved = perLabelReviewState.current[ri];
                            const cells = [esc(r.fileName)];
                            for (const fk of fieldKeys) {
                              const check = r.checks.find((c) => c.field === fk);
                              cells.push(
                                check?.status ?? "—",
                                esc(check?.expected ?? ""),
                                esc(check?.actual ?? ""),
                              );
                            }
                            const decision = saved?.reviewMode === "complete"
                              ? (saved.flaggedFields.size > 0 ? "Flagged" : "Accepted")
                              : "Not reviewed";
                            const issues = r.checks.filter((c) => c.status !== "match").length;
                            cells.push(decision, String(issues), (r.durationMs / 1000).toFixed(1));
                            rows.push(cells.join(","));
                          }
                          const blob = new Blob([rows.join("\n")], { type: "text/csv" });
                          const a = document.createElement("a");
                          a.href = URL.createObjectURL(blob);
                          a.download = `batch-results-${new Date().toISOString().slice(0, 10)}.csv`;
                          a.click();
                          URL.revokeObjectURL(a.href);
                        }}
                        className="mt-4 flex min-h-[48px] w-full items-center justify-center rounded-[16px] border-2 border-[#E5E5EA] bg-white px-4 py-2.5 text-[15px] font-semibold text-[#1C1C1E] transition-all duration-500 active:scale-[0.98] hover:scale-[1.02]"
                      >
                        Export All as CSV
                      </button>
                    </div>
                  );
                })()}
                {(() => {
                  const FIELD_KEYS = ["brandName", "classType", "alcoholContent", "netContents", "bottlerNameAddress", "countryOfOrigin", "governmentWarning", "alcoholContentFormat"] as const;
                  const FIELD_LABELS: Record<string, string> = {
                    brandName: "Brand name",
                    classType: "Class/Type",
                    alcoholContent: "Alcohol content",
                    netContents: "Net contents",
                    bottlerNameAddress: "Bottler/Producer",
                    countryOfOrigin: "Country of origin",
                    governmentWarning: "Government warning",
                    alcoholContentFormat: "Alcohol content abbreviation",
                  };
                  const fieldCounts: Record<string, number> = {};
                  for (const key of FIELD_KEYS) fieldCounts[key] = 0;
                  for (const r of results) {
                    if (r.status !== "success") continue;
                    for (const check of r.checks) {
                      if ((check.status === "mismatch" || check.status === "missing") && fieldCounts[check.field] !== undefined) {
                        fieldCounts[check.field]++;
                      }
                    }
                  }
                  const problematic = FIELD_KEYS
                    .map((key) => ({ field: key, count: fieldCounts[key] ?? 0 }))
                    .filter((x) => x.count > 0)
                    .sort((a, b) => b.count - a.count);
                  const maxCount = problematic.length > 0 ? Math.max(...problematic.map((p) => p.count)) : 0;
                  return (
                    <div className="rounded-[20px] bg-white p-5 depth-1">
                      <p className="text-[17px] font-semibold text-[#1C1C1E]">Most problematic fields</p>
                      {problematic.length === 0 ? (
                        <p className="mt-2 text-[15px] text-[#8E8E93]">No recurring field issues across labels.</p>
                      ) : (
                        <ul className="mt-3 list-none overflow-hidden rounded-[12px]" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                          {problematic.map(({ field, count }) => {
                            const isHigh = maxCount > 0 && count >= maxCount * 0.6;
                            const color = isHigh ? "#FF3B30" : "#FF9500";
                            return (
                              <li key={field} className="flex items-center justify-between border-b border-[#E5E5EA]/80 px-4 py-3 last:border-b-0">
                                <span className="text-[15px] font-medium text-[#1C1C1E]">{FIELD_LABELS[field] ?? field}</span>
                                <span className="text-[15px] font-semibold tabular-nums" style={{ color }}>{count} label{count !== 1 ? "s" : ""}</span>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  );
                })()}
                {results.map((result, i) => {
                  const isSuccess = result.status === "success";
                  const hasIssues =
                    isSuccess &&
                    result.checks.some((c) => c.status !== "match");
                  const isFailed = result.status === "ocr_failed";
                  const issueCount = isSuccess
                    ? result.checks.filter((c) => c.status !== "match").length
                    : 0;
                  const icon = isFailed ? "❌" : hasIssues ? "⚠️" : "✅";
                  const durationStr = isSuccess ? `${(result.durationMs / 1000).toFixed(1)}s` : "";
                  const statusText = isFailed
                    ? "Could not read label"
                    : hasIssues
                      ? `${issueCount} field${issueCount !== 1 ? "s" : ""} need review`
                      : "All fields verified";
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        setCurrentResultIndex(i);
                        setBatchTab("detail");
                      }}
                      className="flex items-center gap-4 rounded-[20px] bg-white px-5 py-4 text-left transition-transform duration-150 active:scale-[0.98] hover:scale-[1.01] depth-1"
                    >
                      <span className="text-[28px] leading-none">{icon}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[16px] font-semibold text-[#1C1C1E]">
                          {result.fileName}
                        </p>
                        <p className="mt-0.5 text-[14px] text-[#8E8E93]">
                          {statusText}{durationStr ? ` · ${durationStr}` : ""}
                        </p>
                      </div>
                      <span className="text-[22px] font-light text-[#C7C7CC]">
                        ›
                      </span>
                    </button>
                  );
                })}
              </section>
            ) : !hasResults || !activeResult ? (
              <section className="rounded-[20px] bg-white p-8 text-[16px] text-[#8E8E93] depth-1">
                No results yet. Run a verification to see comparisons.
              </section>
            ) : activeIsFailed ? (
              /* Scenario 1: OCR failed card */
              <section
                id={safeIndex === firstFailedIndex ? "first-failed-label" : undefined}
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
                        Couldn't read this label
                      </h2>
                      <p className="mt-2 text-[16px] text-[#8E8E93]">
                        The image quality may be too low, or the text might be
                        unclear.
                      </p>
                    </div>
                  </div>
                  {fileList[safeIndex] && (
                    <div className="flex justify-center">
                      <img
                        src={URL.createObjectURL(fileList[safeIndex]!)}
                        alt=""
                        className="h-[120px] rounded-[16px] border border-[#E5E5EA] bg-white object-contain"
                      />
                    </div>
                  )}
                  <div className="flex flex-col gap-3">
                    <input
                      ref={replaceFileInputRef}
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      aria-label="Upload a clearer photo"
                      onChange={(e) => {
                        const i = pendingReplaceResultIndex;
                        setPendingReplaceResultIndex(null);
                        const file = e.target.files?.[0];
                        if (i != null && file) replaceFileAtResultIndex(i, file);
                        e.target.value = "";
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (fileList[safeIndex]) {
                          void runSingleImageVerification(safeIndex);
                        }
                      }}
                      disabled={replacingResultIndex !== null}
                      className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-[16px] px-4 py-3 text-[16px] font-semibold text-white depth-2 transition-opacity hover:opacity-95 disabled:opacity-60"
                      style={{
                        background: "linear-gradient(180deg, #007AFF 0%, #0051D5 100%)",
                        boxShadow: "0 4px 12px rgba(0, 122, 255, 0.25)",
                      }}
                    >
                      {replacingResultIndex === safeIndex ? (
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
                      onClick={() => {
                        setPendingReplaceResultIndex(safeIndex);
                        replaceFileInputRef.current?.click();
                      }}
                      disabled={replacingResultIndex !== null}
                      className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-[16px] border-2 border-[#E5E5EA] bg-white px-4 py-3 text-[16px] font-semibold text-[#1C1C1E] transition-all duration-200 active:scale-[0.98] hover:scale-[1.02] disabled:opacity-60"
                    >
                      Upload a clearer photo
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setResults((prev) => {
                          const next = [...prev];
                          const fieldKeys: FieldCheck["field"][] = ["brandName", "classType", "alcoholContent", "netContents", "bottlerNameAddress", "countryOfOrigin", "governmentWarning"];
                          next[safeIndex] = {
                            status: "success",
                            fileName: prev[safeIndex].fileName,
                            checks: fieldKeys.map((field) => ({ field, status: "missing" as const, expected: "", actual: "" })),
                            rawOcrText: "",
                            durationMs: 0,
                          };
                          return next;
                        });
                      }}
                      className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-[16px] border-2 border-[#E5E5EA] bg-white px-4 py-3 text-[16px] font-semibold text-[#1C1C1E] transition-all duration-200 active:scale-[0.98] hover:scale-[1.02]"
                    >
                      Enter fields manually
                    </button>
                    <button
                      type="button"
                      onClick={() => skipLabelAtResultIndex(safeIndex)}
                      className="min-h-[44px] text-[16px] font-normal text-[#8E8E93] hover:text-[#1C1C1E]"
                    >
                      Skip this label
                    </button>
                    <button
                      type="button"
                      onClick={() => runSingleImageVerification(safeIndex)}
                      disabled={replacingResultIndex !== null}
                      className="min-h-[44px] text-[16px] font-normal text-[#8E8E93] hover:text-[#1C1C1E] disabled:opacity-60"
                    >
                      Try again
                    </button>
                  </div>
                </div>
              </section>
            ) : (
              <>
                {(() => {
                  const FIELD_LABEL_MAP: Record<string, string> = {
                    brandName: "Brand name",
                    classType: "Class/Type",
                    alcoholContent: "Alcohol content",
                    netContents: "Net contents",
                    bottlerNameAddress: "Bottler/Producer name & address",
                    countryOfOrigin: "Country of origin",
                    governmentWarning: "Government warning",
                    alcoholContentFormat: "Alcohol content abbreviation",
                  };
                  const fieldsNeedingReview = activeResult.checks.filter(
                    (c) =>
                      c.status === "mismatch" || c.status === "missing",
                  );
                  const matchCount = activeResult.checks.filter(
                    (c) => c.status === "match",
                  ).length;
                  const totalReviewCount = fieldsNeedingReview.length;
                  const currentCheck =
                    totalReviewCount > 0
                      ? fieldsNeedingReview[currentReviewIndex]
                      : null;
                  const isLastField =
                    totalReviewCount > 0 &&
                    currentReviewIndex >= totalReviewCount - 1;

                  /* ——— SUMMARY: one card + one CTA ——— */
                  if (reviewMode === "summary") {
                    return (
                      <section className="mx-auto flex max-w-[600px] flex-col gap-8">
                        <div
                          className="animate-fade-scale-in flex min-h-[140px] flex-col justify-center rounded-[24px] p-8"
                          style={{
                            boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
                            animationDuration: "0.6s",
                            animationTimingFunction:
                              "cubic-bezier(0.34, 1.56, 0.64, 1)",
                            ...(anyIssue
                              ? {
                                  background:
                                    "linear-gradient(135deg, #E3F2FD 0%, #F5F9FF 100%)",
                                }
                              : {
                                  background:
                                    "linear-gradient(135deg, #E8F5E9 0%, #F1F8F4 100%)",
                                }),
                          }}
                        >
                          <div className="flex items-start gap-4">
                            <span
                              className="flex h-12 w-12 shrink-0 items-center justify-center text-[48px] leading-none"
                              style={{
                                color: anyIssue ? "#007AFF" : "#30D158",
                              }}
                              aria-hidden
                            >
                              {anyIssue ? "⚠️" : "✓"}
                            </span>
                            <div className="min-w-0 flex-1">
                              <h2
                                className="text-[22px] font-semibold tracking-tight text-[#1C1C1E]"
                                style={{ letterSpacing: "-0.01em" }}
                              >
                                {anyIssue
                                  ? `${issueCount} field${issueCount !== 1 ? "s" : ""} need your review`
                                  : "All fields verified"}
                              </h2>
                              <p className="mt-1 text-[16px] font-normal text-[#8E8E93]">
                                {anyIssue
                                  ? `${matchCount} field${matchCount !== 1 ? "s" : ""} matched automatically`
                                  : "This label matches the application"}
                              </p>
                            </div>
                          </div>
                          {/* Per-field scorecard */}
                          <div className="mt-6 flex flex-col gap-2">
                            {activeResult.checks.map((check) => {
                              const label = FIELD_LABEL_MAP[check.field] ?? check.field;
                              const icon =
                                check.status === "match"
                                  ? "✓"
                                  : check.status === "missing"
                                  ? "✗"
                                  : "⚠";
                              const color =
                                check.status === "match"
                                  ? "#30D158"
                                  : check.status === "missing"
                                  ? "#FF3B30"
                                  : "#FF9500";
                              return (
                                <div
                                  key={check.field}
                                  className="flex items-center gap-3 rounded-[12px] bg-white px-4 py-3"
                                  style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
                                >
                                  <span
                                    className="text-[18px] font-bold leading-none"
                                    style={{ color, minWidth: "20px" }}
                                    aria-hidden
                                  >
                                    {icon}
                                  </span>
                                  <span className="text-[15px] font-medium text-[#1C1C1E]">
                                    {label}
                                  </span>
                                  {check.status !== "match" && (
                                    <span
                                      className="ml-auto rounded-full px-2 py-0.5 text-[12px] font-semibold"
                                      style={{
                                        background: check.status === "missing" ? "#FFEBEB" : "#FFF4E5",
                                        color: check.status === "missing" ? "#FF3B30" : "#FF9500",
                                      }}
                                    >
                                      {check.status === "missing" ? "Missing" : "Review"}
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          <div className="mt-6 flex flex-col gap-4">
                            {anyIssue ? (
                              <button
                                type="button"
                                onClick={() => setReviewMode("reviewing")}
                                className="flex min-h-[56px] w-full items-center justify-center rounded-[24px] px-6 py-4 text-[17px] font-semibold text-white transition-transform duration-150 active:scale-[0.97]"
                                style={{
                                  background:
                                    "linear-gradient(180deg, #007AFF 0%, #0051D5 100%)",
                                  boxShadow:
                                    "0 4px 12px rgba(0, 122, 255, 0.25)",
                                }}
                              >
                                Start Review
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={resetWizard}
                                className="flex min-h-[56px] w-full items-center justify-center rounded-[24px] px-6 py-4 text-[17px] font-semibold text-white transition-transform duration-150 active:scale-[0.97]"
                                style={{
                                  background:
                                    "linear-gradient(180deg, #007AFF 0%, #0051D5 100%)",
                                  boxShadow:
                                    "0 4px 12px rgba(0, 122, 255, 0.25)",
                                }}
                              >
                                Check Another Label
                              </button>
                            )}
                          </div>
                        </div>
                        {results.length > 1 && (
                          <div className="flex items-center justify-center gap-4 pt-4">
                            <button
                              type="button"
                              aria-label="Previous label"
                              disabled={safeIndex === 0}
                              onClick={() =>
                                setCurrentResultIndex((i) => Math.max(0, i - 1))
                              }
                              className="inline-flex min-h-[48px] min-w-[48px] items-center justify-center rounded-[12px] border border-[#E5E5EA] bg-white text-[#1C1C1E] transition-transform duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              ‹
                            </button>
                            <span className="min-w-[80px] text-center text-[15px] text-[#8E8E93]">
                              {safeIndex + 1} / {results.length}
                            </span>
                            <button
                              type="button"
                              aria-label="Next label"
                              disabled={safeIndex >= results.length - 1}
                              onClick={() =>
                                setCurrentResultIndex((i) =>
                                  Math.min(results.length - 1, i + 1),
                                )
                              }
                              className="inline-flex min-h-[48px] min-w-[48px] items-center justify-center rounded-[12px] border border-[#E5E5EA] bg-white text-[#1C1C1E] transition-transform duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              ›
                            </button>
                          </div>
                        )}
                      </section>
                    );
                  }

                  /* ——— REVIEW: one field at a time ——— */
                  if (reviewMode === "reviewing" && currentCheck) {
                    const fieldLabel =
                      FIELD_LABEL_MAP[currentCheck.field] ?? currentCheck.field;
                    return (
                      <section className="mx-auto flex max-w-[600px] flex-col gap-8">
                        <div
                          className="rounded-[24px] bg-white p-8"
                          style={{
                            boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
                          }}
                        >
                          {fileList[safeIndex] ? (
                            <img
                              src={URL.createObjectURL(fileList[safeIndex]!)}
                              alt=""
                              className="mb-6 w-full rounded-[16px] bg-[#F5F5F7] object-contain"
                              style={{ maxHeight: "400px" }}
                            />
                          ) : (
                            <div
                              className="mb-6 w-full rounded-[16px] bg-[#F5F5F7]"
                              style={{ height: "200px" }}
                            />
                          )}

                          {currentCheck.field === "governmentWarning" && currentCheck.status === "missing" ? (
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
                                <h3 className="mt-2 text-[22px] font-bold text-[#D70015]" style={{ letterSpacing: "-0.01em" }}>
                                  CRITICAL: Government Warning Required
                                </h3>
                                <p className="mt-3 text-[17px] leading-relaxed text-[#3C3C43]">
                                  No government health warning was detected on this label. Federal law (27 CFR § 16.21) requires all alcohol labels to display:
                                </p>
                                <pre
                                  className="mt-4 overflow-x-auto rounded-[12px] border-2 border-[#FF3B30] bg-white p-4 text-[14px] leading-relaxed text-black"
                                  style={{ fontFamily: "'SF Mono', 'Monaco', 'Courier New', monospace", whiteSpace: "pre-wrap" }}
                                >
                                  {STANDARD_GOVERNMENT_WARNING}
                                </pre>
                                <p className="mt-3 text-[15px] italic text-[#3C3C43]">
                                  The header must appear as "GOVERNMENT WARNING:" in all caps and bold.
                                </p>
                              </div>
                              <div className="mt-6 flex flex-col gap-4">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (isLastField) {
                                      setReviewMode("complete");
                                    } else {
                                      setCurrentReviewIndex((i) => i + 1);
                                    }
                                  }}
                                  className="flex min-h-[56px] w-full items-center justify-center rounded-[24px] bg-[#FF3B30] px-6 py-4 text-[17px] font-semibold text-white transition-transform duration-150 active:scale-[0.97]"
                                >
                                  Acknowledge &amp; Continue
                                </button>
                              </div>
                            </>
                          ) : currentCheck.status === "mismatch" ? (
                            <>
                              <p
                                className="text-[22px] font-semibold text-[#1C1C1E]"
                                style={{ letterSpacing: "-0.01em" }}
                              >
                                ⚠️ {fieldLabel}
                              </p>
                              <p className="mt-2 text-[12px] font-medium uppercase tracking-wide text-[#8E8E93]">
                                Expected
                              </p>
                              <p className="mt-1 text-[17px] font-normal text-[#1C1C1E]">
                                {currentCheck.field === "governmentWarning" && !govWarningExpanded && (currentCheck.expected ?? "").length > 80
                                  ? (currentCheck.expected ?? "").slice(0, 80) + "…"
                                  : currentCheck.expected ?? "—"}
                              </p>
                              <p className="mt-5 text-[12px] font-medium uppercase tracking-wide text-[#8E8E93]">
                                Found on label
                              </p>
                              <p className="mt-1 text-[17px] font-normal text-[#1C1C1E]">
                                {currentCheck.field === "governmentWarning" && !govWarningExpanded && (currentCheck.actual ?? "").length > 80
                                  ? (currentCheck.actual ?? "").slice(0, 80) + "…"
                                  : currentCheck.actual ?? "—"}
                              </p>
                              {currentCheck.field === "governmentWarning" &&
                                ((currentCheck.expected ?? "").length > 80 || (currentCheck.actual ?? "").length > 80) && (
                                  <button
                                    type="button"
                                    onClick={() => setGovWarningExpanded((v) => !v)}
                                    className="mt-2 text-[15px] font-semibold text-[#007AFF] hover:opacity-80"
                                  >
                                    {govWarningExpanded ? "Show less" : "Show full text"}
                                  </button>
                                )}
                              {currentCheck.notes ? (
                                <p className="mt-5 text-[15px] font-normal italic text-[#8E8E93]">
                                  {currentCheck.notes}
                                  {currentCheck.noteHref && (
                                    <>
                                      {" "}
                                      <a
                                        href={currentCheck.noteHref}
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
                                  onClick={() => {
                                    if (isLastField) {
                                      setReviewMode("complete");
                                    } else {
                                      setCurrentReviewIndex((i) => i + 1);
                                    }
                                  }}
                                  className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-[16px] border-2 border-[#34C759]/40 bg-[#F2F2F7] px-6 py-4 text-[17px] font-semibold text-[#248A3D] transition-all duration-500 active:scale-[0.97] hover:scale-[1.02]"
                                >
                                  <span aria-hidden>✓</span> Accept — Values Match
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setFlaggedFields((prev) => new Set(prev).add(currentCheck.field));
                                    if (isLastField) {
                                      setReviewMode("complete");
                                    } else {
                                      setCurrentReviewIndex((i) => i + 1);
                                    }
                                  }}
                                  className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-[16px] border-2 border-[#FF453A]/40 bg-[#F2F2F7] px-6 py-4 text-[17px] font-semibold text-[#D70015] transition-all duration-500 active:scale-[0.97] hover:scale-[1.02]"
                                >
                                  <span aria-hidden>✕</span> Flag — Does Not Match
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
                                Couldn't read {fieldLabel} clearly from the
                                photo.
                              </p>
                              <p className="mt-2 text-[15px] font-normal text-[#8E8E93]">
                                Enter the value manually, or flag as missing.
                              </p>
                              <input
                                type="text"
                                placeholder="Type what the label says"
                                value={
                                  manualOverrides[currentCheck.field] ?? ""
                                }
                                onChange={(e) =>
                                  setManualOverrides((prev) => ({
                                    ...prev,
                                    [currentCheck.field]: e.target.value,
                                  }))
                                }
                                className="mt-4 w-full rounded-[16px] border-2 border-[#E5E5EA] bg-white px-4 py-3 text-[17px] text-[#1C1C1E] placeholder:text-[#C7C7CC] focus:border-[#8E8E93] focus:outline-none focus:ring-2 focus:ring-[#8E8E93]/20"
                                style={{ minHeight: "52px" }}
                              />
                              {currentCheck.expected ? (
                                <p className="mt-4 text-[15px] text-[#8E8E93]">
                                  Expected: {currentCheck.expected}
                                </p>
                              ) : null}
                              <div className="mt-8 flex flex-col gap-4">
                                <button
                                  type="button"
                                  disabled={!(manualOverrides[currentCheck.field] ?? "").trim()}
                                  onClick={() => {
                                    if (isLastField) {
                                      setReviewMode("complete");
                                    } else {
                                      setCurrentReviewIndex((i) => i + 1);
                                    }
                                  }}
                                  className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-[16px] border-2 border-[#34C759]/40 bg-[#F2F2F7] px-6 py-4 text-[17px] font-semibold text-[#248A3D] transition-all duration-500 active:scale-[0.97] hover:scale-[1.02] disabled:opacity-40 disabled:hover:scale-100"
                                >
                                  <span aria-hidden>✓</span> Accept — I Entered the Value
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setFlaggedFields((prev) => new Set(prev).add(currentCheck.field));
                                    if (isLastField) {
                                      setReviewMode("complete");
                                    } else {
                                      setCurrentReviewIndex((i) => i + 1);
                                    }
                                  }}
                                  className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-[16px] border-2 border-[#FF453A]/40 bg-[#F2F2F7] px-6 py-4 text-[17px] font-semibold text-[#D70015] transition-all duration-500 active:scale-[0.97] hover:scale-[1.02]"
                                >
                                  <span aria-hidden>✕</span> Flag — Field Missing from Label
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </section>
                    );
                  }

                  /* ——— COMPLETE ——— */
                  if (reviewMode === "complete") {
                    const durationSec =
                      activeResult.status === "success"
                        ? (activeResult.durationMs / 1000).toFixed(1)
                        : "—";
                    const flaggedCount = flaggedFields.size;
                    const acceptedCount = totalReviewCount - flaggedCount;
                    const hasFlags = flaggedCount > 0;
                    return (
                      <section className="mx-auto flex max-w-[600px] flex-col gap-8">
                        <div
                          className="rounded-[24px] p-8"
                          style={{
                            boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
                            background: hasFlags
                              ? "linear-gradient(135deg, #E3F2FD 0%, #F5F9FF 100%)"
                              : "linear-gradient(135deg, #E8F5E9 0%, #F1F8F4 100%)",
                          }}
                        >
                          <div className="flex items-center gap-4">
                            <span
                              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[20px] font-bold leading-none"
                              style={{
                                color: hasFlags ? "#D70015" : "#248A3D",
                                background: hasFlags ? "#FFF0F0" : "#F0FFF4",
                              }}
                              aria-hidden
                            >
                              {hasFlags ? "!" : "✓"}
                            </span>
                            <h2 className="text-[22px] font-semibold tracking-tight text-[#1C1C1E]">
                              {hasFlags ? "Label needs attention" : "Label verified"}
                            </h2>
                          </div>
                          <div className="mt-5 flex flex-col gap-3">
                            {flaggedCount > 0 && (
                              <div className="flex items-center gap-3 rounded-[12px] border border-[#FF3B30]/25 bg-[#FFE5E5] px-4 py-2.5">
                                <span className="text-[15px] font-semibold text-[#FF3B30]">{flaggedCount}</span>
                                <span className="text-[15px] text-[#FF3B30]">field{flaggedCount !== 1 ? "s" : ""} flagged as not matching</span>
                              </div>
                            )}
                            {acceptedCount > 0 && (
                              <div className="flex items-center gap-3 rounded-[12px] border border-[#30D158]/25 bg-[#E8F5E9] px-4 py-2.5">
                                <span className="text-[15px] font-semibold text-[#30D158]">{acceptedCount}</span>
                                <span className="text-[15px] text-[#248A3D]">field{acceptedCount !== 1 ? "s" : ""} accepted by reviewer</span>
                              </div>
                            )}
                            {matchCount > 0 && (
                              <div className="flex items-center gap-3 rounded-[12px] border border-[#30D158]/25 bg-[#E8F5E9] px-4 py-2.5">
                                <span className="text-[15px] font-semibold text-[#30D158]">{matchCount}</span>
                                <span className="text-[15px] text-[#248A3D]">field{matchCount !== 1 ? "s" : ""} matched automatically</span>
                              </div>
                            )}
                          </div>
                          <p className="mt-5 text-[15px] font-normal text-[#8E8E93]">
                            Processed in {durationSec} seconds
                          </p>
                          <div className="mt-8 flex flex-col gap-4">
                            {results.length > 1 && safeIndex < results.length - 1 ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setCurrentResultIndex(safeIndex + 1);
                                }}
                                className="flex min-h-[56px] w-full items-center justify-center rounded-[24px] px-6 py-4 text-[17px] font-semibold text-white transition-transform duration-150 active:scale-[0.97]"
                                style={{
                                  background:
                                    "linear-gradient(180deg, #007AFF 0%, #0051D5 100%)",
                                  boxShadow:
                                    "0 4px 12px rgba(0, 122, 255, 0.25)",
                                }}
                              >
                                Next Label
                              </button>
                            ) : safeIndex === results.length - 1 ? (
                              <button
                                type="button"
                                onClick={() => setBatchTab("summary")}
                                className="flex min-h-[56px] w-full items-center justify-center rounded-[24px] px-6 py-4 text-[17px] font-semibold text-white transition-transform duration-150 active:scale-[0.97]"
                                style={{
                                  background:
                                    "linear-gradient(180deg, #007AFF 0%, #0051D5 100%)",
                                  boxShadow:
                                    "0 4px 12px rgba(0, 122, 255, 0.25)",
                                }}
                              >
                                View Batch Summary
                              </button>
                            ) : null}
                            <button
                              type="button"
                              onClick={resetWizard}
                              className="min-h-[44px] text-center text-[16px] font-normal text-[#8E8E93] hover:text-[#1C1C1E]"
                            >
                              Check Another
                            </button>
                          </div>
                        </div>
                        {results.length > 1 && (
                          <div className="flex items-center justify-center gap-4 pt-4">
                            <button
                              type="button"
                              aria-label="Previous label"
                              disabled={safeIndex === 0}
                              onClick={() => setCurrentResultIndex((i) => Math.max(0, i - 1))}
                              className="inline-flex min-h-[48px] min-w-[48px] items-center justify-center rounded-[12px] border border-[#E5E5EA] bg-white text-[#1C1C1E] transition-transform duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              ‹
                            </button>
                            <span className="min-w-[80px] text-center text-[15px] text-[#8E8E93]">
                              {safeIndex + 1} / {results.length}
                            </span>
                            <button
                              type="button"
                              aria-label="Next label"
                              disabled={safeIndex >= results.length - 1}
                              onClick={() => setCurrentResultIndex((i) => Math.min(results.length - 1, i + 1))}
                              className="inline-flex min-h-[48px] min-w-[48px] items-center justify-center rounded-[12px] border border-[#E5E5EA] bg-white text-[#1C1C1E] transition-transform duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              ›
                            </button>
                          </div>
                        )}
                      </section>
                    );
                  }

                  return null;
                })()}
              </>
            )}

            <div className="flex justify-center pt-6">
              {confirmingReset ? (
                <div className="flex w-full max-w-[320px] flex-col items-center gap-3">
                  <p className="text-center text-[15px] text-[#8E8E93]">
                    Unreviewed fields won&apos;t be saved. Start over?
                  </p>
                  <div className="flex w-full gap-3">
                    <button
                      type="button"
                      onClick={() => setConfirmingReset(false)}
                      className="flex min-h-[52px] flex-1 items-center justify-center rounded-[12px] border-2 border-[#E5E5EA] bg-white px-4 py-3 text-[16px] font-semibold text-[#1C1C1E] transition-all duration-200 hover:bg-[#F2F2F7] active:scale-[0.98]"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={resetWizard}
                      className="flex min-h-[52px] flex-1 items-center justify-center rounded-[12px] px-4 py-3 text-[16px] font-semibold text-white transition-all duration-200 active:scale-[0.98]"
                      style={{
                        background:
                          "linear-gradient(180deg, #007AFF 0%, #0051D5 100%)",
                        boxShadow: "0 4px 12px rgba(0, 122, 255, 0.25)",
                      }}
                    >
                      Start Over
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (anyResultHasIssues && reviewMode !== "complete") {
                      setConfirmingReset(true);
                    } else {
                      resetWizard();
                    }
                  }}
                  className="inline-flex min-h-[56px] w-full max-w-[320px] items-center justify-center rounded-[12px] px-6 py-4 text-[17px] font-semibold text-white transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                  style={{
                    background:
                      "linear-gradient(180deg, #007AFF 0%, #0051D5 100%)",
                    boxShadow: "0 4px 12px rgba(0, 122, 255, 0.25)",
                  }}
                >
                  Check another label
                </button>
              )}
            </div>
            <p className="pt-6 text-center text-[13px] text-[#8E8E93]">
              We encourage you to review TTB&apos;s guidelines at{" "}
              <a href="https://www.ttb.gov" target="_blank" rel="noopener noreferrer" className="underline hover:text-[#1C1C1E]">ttb.gov</a>{" "}
              for additional context on label requirements.
            </p>
          </main>
        </div>
      </div>
    </>
    );
  }

}

