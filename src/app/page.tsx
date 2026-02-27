/* eslint-disable @next/next/no-img-element */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CatastrophicErrorModal } from "@/components/CatastrophicErrorModal";
import { LabelNav } from "@/components/LabelNav";
import { OcrFailedCard } from "@/components/OcrFailedCard";
import { ProcessingOverlay } from "@/components/ProcessingOverlay";
import { BatchSummaryTab } from "@/components/BatchSummaryTab";
import { ReviewFieldCard } from "@/components/ReviewFieldCard";
import { ReviewSummaryCard } from "@/components/ReviewSummaryCard";
import { Step3Results } from "@/components/Step3Results";
import { Step1Upload } from "@/components/Step1Upload";
import { Step2AppData } from "@/components/Step2AppData";
import { ThumbnailCard } from "@/components/ThumbnailCard";
import { WizardProgress } from "@/components/WizardProgress";
import {
  STANDARD_GOVERNMENT_WARNING,
  type ApplicationLabelData,
  type FieldCheck,
} from "@/lib/labelComparison";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useReviewState } from "@/hooks/useReviewState";
import { useVerification } from "@/hooks/useVerification";
import {
  defaultApplicationData,
  type Mode,
  type VerificationResult,
} from "@/lib/types";
import { DEMO_PRESETS, getPresetById } from "@/data/presets";
import { DemoPickerScreen } from "@/components/DemoPickerScreen";

export default function Home() {
  const [mode, setMode] = useState<Mode>("single");
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [applicationData, setApplicationData] = useState<ApplicationLabelData>(
    defaultApplicationData,
  );
  const [batchJson, setBatchJson] = useState("");
  const [fileList, setFileList] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [progressMessage, setProgressMessage] = useState<string | null>(null);
  const [currentResultIndex, setCurrentResultIndex] = useState(0);
  const [uploadFileTypeError, setUploadFileTypeError] = useState<string | null>(
    null,
  );
  const [catastrophicError, setCatastrophicError] = useState<string | null>(
    null,
  );
  const replaceFileInputRef = useRef<HTMLInputElement>(null);
  const [demoPickerOpen, setDemoPickerOpen] = useState(false);
  const [selectedDemoPresetId, setSelectedDemoPresetId] = useState<string | null>(
    DEMO_PRESETS[0]?.id ?? null,
  );

  const {
    reviewMode,
    setReviewMode,
    currentReviewIndex,
    setCurrentReviewIndex,
    manualOverrides,
    setManualOverrides,
    flaggedFields,
    setFlaggedFields,
    perLabelReviewState,
  } = useReviewState({
    currentResultIndex,
    onLabelChange: () => {
      setGovWarningExpanded(false);
      setConfirmingReset(false);
    },
  });
  const [replacingResultIndex, setReplacingResultIndex] = useState<
    number | null
  >(null);
  const [pendingReplaceResultIndex, setPendingReplaceResultIndex] = useState<
    number | null
  >(null);
  const [govWarningExpanded, setGovWarningExpanded] = useState(false);
  const [batchTab, setBatchTab] = useState<"summary" | "detail">("detail");
  const [confirmingReset, setConfirmingReset] = useState(false);

  const {
    results,
    setResults,
    isProcessing,
    processingCurrent,
    processingTotal,
    processingPreviewUrl,
    processingFieldLabel,
    batchElapsedMs,
    runVerification,
    runSingleImageVerification,
  } = useVerification({
    fileList,
    applicationData,
    onRunStart: () => {
      setReviewMode("summary");
      setCurrentReviewIndex(0);
      setManualOverrides({});
      setFlaggedFields(new Set());
      setCurrentResultIndex(0);
      setError(null);
      setCatastrophicError(null);
      setProgressMessage("Reading label...");
    },
    onRunComplete: () => {
      setProgressMessage(null);
      setStep(3);
    },
    onCatastrophicError: setCatastrophicError,
    onValidationError: setError,
    onSingleImageStart: setReplacingResultIndex,
    onSingleImageEnd: () => setReplacingResultIndex(null),
  });

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

  const demoImageUrl = useCallback((imagePath: string) => {
    const encoded = imagePath
      .split("/")
      .map((seg) => encodeURIComponent(seg))
      .join("/");
    return `/demo/${encoded}`;
  }, []);

  const handleLoadDemoPreset = useCallback(async () => {
    const preset = selectedDemoPresetId ? getPresetById(selectedDemoPresetId) : null;
    if (!preset) return;
    try {
      const files: File[] = [];
      for (let i = 0; i < preset.imagePaths.length; i++) {
        const path = preset.imagePaths[i];
        const url = demoImageUrl(path);
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Demo image not found: ${path}`);
        const blob = await res.blob();
        const fileName = path.split("/").pop() ?? `demo-${i + 1}.png`;
        files.push(new File([blob], fileName, { type: blob.type || "image/png" }));
      }
      setFileList(files);
      setApplicationData({ ...preset.applicationData });
      setError(null);
      setDemoPickerOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load demo image.");
    }
  }, [selectedDemoPresetId, demoImageUrl]);

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
    setCurrentResultIndex(0);
    setReplacingResultIndex(null);
    setPendingReplaceResultIndex(null);
    setBatchTab("detail");
    setConfirmingReset(false);
    setFlaggedFields(new Set());
  };

  useKeyboardShortcuts({
    step,
    isProcessing,
    fileListLength: fileList.length,
    resultsLength: results.length,
    onStep2Back: () => setStep(1),
    onStep3Back: () => setStep(2),
    onRunWizard: handleRunWizard,
    onPrevLabel: () =>
      setCurrentResultIndex((i) => Math.max(0, i - 1)),
    onNextLabel: () =>
      setCurrentResultIndex((i) => Math.min(results.length - 1, i + 1)),
  });

  /* Collapse gov warning when moving between fields */
  useEffect(() => {
    setGovWarningExpanded(false);
  }, [currentReviewIndex]);

  const hasBatchSummary = step === 3 && results.length >= 1;
  const isOnSummaryTab = hasBatchSummary && batchTab === "summary";

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
          <CatastrophicErrorModal
            message={catastrophicError}
            onDismiss={() => setCatastrophicError(null)}
          />
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
            <WizardProgress step={step} hasBatchSummary={hasBatchSummary} isOnSummaryTab={isOnSummaryTab} />
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

          {demoPickerOpen ? (
            <DemoPickerScreen
              presets={DEMO_PRESETS}
              selectedId={selectedDemoPresetId}
              onSelect={setSelectedDemoPresetId}
              onLoadDemo={handleLoadDemoPreset}
              onBack={() => setDemoPickerOpen(false)}
            />
          ) : (
            <>
              <button
                type="button"
                onClick={() => setDemoPickerOpen(true)}
                className="w-full min-h-[48px] rounded-[16px] border-2 border-[#E5E5EA] bg-white px-6 py-3 text-[15px] font-semibold text-[#1C1C1E] transition-all duration-200 hover:border-[#007AFF] hover:bg-[#F0F7FF] hover:text-[#007AFF] active:scale-[0.98]"
              >
                Not sure where to start?
              </button>
              <Step1Upload
                error={error}
                uploadFileTypeError={uploadFileTypeError}
                fileList={fileList}
                onFilesSelected={handleFilesSelected}
                onRemoveFile={removeSelectedFile}
                onClearAll={clearAllFiles}
                onNext={() => setStep(2)}
              />
            </>
          )}
        </div>
      </div>
    </>
    );
  }

  if (step === 2) {
    return (
      <div className="min-h-screen depth-0 text-[#1C1C1E]">
        <div role="status" aria-live="polite" aria-atomic="true" className="sr-only" key={step}>
          {stepAnnouncement}
        </div>
        {catastrophicError ? (
          <CatastrophicErrorModal
            message={catastrophicError}
            onDismiss={() => setCatastrophicError(null)}
          />
        ) : null}
        <div className="mx-auto flex max-w-xl flex-col gap-10 px-4 py-10 sm:py-12">
          <header className="space-y-2">
            <WizardProgress step={step} hasBatchSummary={hasBatchSummary} isOnSummaryTab={isOnSummaryTab} />
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

          <Step2AppData
            applicationData={applicationData}
            setApplicationData={setApplicationData}
            fileList={fileList}
            error={error}
            isProcessing={isProcessing}
            onBack={() => setStep(1)}
            onSubmit={handleRunWizard}
          />
        </div>
        {isProcessing && (
          <ProcessingOverlay
            processingPreviewUrl={processingPreviewUrl}
            processingCurrent={processingCurrent}
            processingTotal={processingTotal}
            processingFieldLabel={processingFieldLabel}
          />
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
          <CatastrophicErrorModal
            message={catastrophicError}
            onDismiss={() => setCatastrophicError(null)}
          />
        ) : null}
        <Step3Results
          step={step}
          hasBatchSummary={hasBatchSummary}
          isOnSummaryTab={isOnSummaryTab}
          batchTab={batchTab}
          setBatchTab={setBatchTab}
          resultsCount={results.length}
          currentIndex={safeIndex}
          failedCount={failedCount}
          firstFailedIndex={firstFailedIndex}
          onReviewFailedLabels={() => {
            if (firstFailedIndex >= 0) {
              setCurrentResultIndex(firstFailedIndex);
              setBatchTab("detail");
            }
          }}
          error={error}
          scrollToFirstFailedRef={scrollToFirstFailedRef}
        >
          <main className="flex flex-col gap-10">
            {batchTab === "summary" && results.length >= 1 ? (
              <BatchSummaryTab
                results={results}
                perLabelReviewState={perLabelReviewState}
                batchElapsedMs={batchElapsedMs}
                onSelectLabel={(i) => {
                  setCurrentResultIndex(i);
                  setBatchTab("detail");
                  const result = results[i];
                  const hasFieldsToReview =
                    result?.status === "success" &&
                    result.checks.some(
                      (c) => c.status === "mismatch" || c.status === "missing",
                    );
                  setReviewMode(hasFieldsToReview ? "reviewing" : "summary");
                  setCurrentReviewIndex(0);
                }}
              />
            ) : !hasResults || !activeResult ? (
              <section className="rounded-[20px] bg-white p-8 text-[16px] text-[#8E8E93] depth-1">
                No results yet. Run a verification to see comparisons.
              </section>
            ) : activeIsFailed ? (
              <>
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
                <OcrFailedCard
                  id={safeIndex === firstFailedIndex ? "first-failed-label" : undefined}
                  previewFile={fileList[safeIndex] ?? null}
                  isReplacing={replacingResultIndex !== null}
                  onTryAgain={() => {
                    if (fileList[safeIndex]) void runSingleImageVerification(safeIndex);
                  }}
                  onUploadClearer={() => {
                    setPendingReplaceResultIndex(safeIndex);
                    replaceFileInputRef.current?.click();
                  }}
                  onEnterManually={() => {
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
                    setReviewMode("reviewing");
                    setCurrentReviewIndex(0);
                    setManualOverrides({});
                    setFlaggedFields(new Set());
                  }}
                  onSkip={() => skipLabelAtResultIndex(safeIndex)}
                />
              </>
            ) : (
              <>
                {(() => {
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

                  /* ——— Just finished last label: show only "View batch summary" button ——— */
                  if (reviewMode === "complete") {
                    return (
                      <div className="flex flex-col items-center gap-4 py-6">
                        <button
                          type="button"
                          onClick={() => setBatchTab("summary")}
                          className="inline-flex min-h-[56px] w-full max-w-[320px] items-center justify-center rounded-[12px] px-6 py-4 text-[17px] font-semibold text-white transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                          style={{
                            background:
                              "linear-gradient(180deg, #007AFF 0%, #0051D5 100%)",
                            boxShadow: "0 4px 12px rgba(0, 122, 255, 0.25)",
                          }}
                        >
                          View batch summary
                        </button>
                      </div>
                    );
                  }

                  /* ——— SUMMARY: one card + one CTA ——— */
                  if (reviewMode === "summary") {
                    return (
                      <ReviewSummaryCard
                        anyIssue={anyIssue}
                        issueCount={issueCount}
                        matchCount={matchCount}
                        checks={activeResult.checks}
                        onStartReview={() => setReviewMode("reviewing")}
                        onViewBatchSummary={() => setBatchTab("summary")}
                        onCheckAnother={resetWizard}
                        currentIndex={safeIndex}
                        totalLabels={results.length}
                        onPrev={() => {
                          setCurrentResultIndex((i) => Math.max(0, i - 1));
                          setCurrentReviewIndex(0);
                        }}
                        onNext={() => {
                          setCurrentResultIndex((i) =>
                            Math.min(results.length - 1, i + 1),
                          );
                          setCurrentReviewIndex(0);
                        }}
                      />
                    );
                  }

                  /* ——— REVIEW: one field at a time ——— */
                  if (reviewMode === "reviewing" && currentCheck) {
                    const goNext = () => {
                      if (isLastField) {
                        if (safeIndex + 1 < results.length) {
                          setReviewMode("summary");
                          setCurrentResultIndex(safeIndex + 1);
                          setCurrentReviewIndex(0);
                        } else {
                          setReviewMode("complete");
                        }
                      } else {
                        setCurrentReviewIndex((i) => i + 1);
                      }
                    };
                    return (
                      <>
                        <ReviewFieldCard
                          check={currentCheck}
                          previewFile={fileList[safeIndex] ?? null}
                          isLastField={isLastField}
                          govWarningExpanded={govWarningExpanded}
                          onToggleGovWarning={() =>
                            setGovWarningExpanded((v) => !v)
                          }
                          manualOverrideValue={
                            manualOverrides[currentCheck.field] ?? ""
                          }
                          onManualOverrideChange={(value) =>
                            setManualOverrides((prev) => ({
                              ...prev,
                              [currentCheck.field]: value,
                            }))
                          }
                          standardGovernmentWarning={
                            STANDARD_GOVERNMENT_WARNING
                          }
                          onAcceptMatch={goNext}
                          onFlag={() => {
                            setFlaggedFields((prev) =>
                              new Set(prev).add(currentCheck.field),
                            );
                            goNext();
                          }}
                          onAcceptEntered={goNext}
                        />
                        {results.length > 1 ? (
                          <LabelNav
                            currentIndex={safeIndex}
                            total={results.length}
                            onPrev={() => {
                              setCurrentResultIndex((i) => Math.max(0, i - 1));
                              setCurrentReviewIndex(0);
                            }}
                            onNext={() => {
                              setCurrentResultIndex((i) =>
                                Math.min(results.length - 1, i + 1),
                              );
                              setCurrentReviewIndex(0);
                            }}
                          />
                        ) : null}
                      </>
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
                    if (batchTab === "summary") {
                      resetWizard();
                      return;
                    }
                    const allLabelsReviewed =
                      results.length > 0 &&
                      results.every(
                        (_, i) => perLabelReviewState.current[i] != null,
                      );
                    if (
                      anyResultHasIssues &&
                      !allLabelsReviewed
                    ) {
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
        </Step3Results>
    </>
    );
  }

}

