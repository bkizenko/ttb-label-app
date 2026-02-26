import { WizardProgress } from "@/components/WizardProgress";

export interface Step3ResultsProps {
  step: 1 | 2 | 3;
  hasBatchSummary: boolean;
  isOnSummaryTab: boolean;
  batchTab: "summary" | "detail";
  setBatchTab: (tab: "summary" | "detail") => void;
  resultsCount: number;
  currentIndex: number;
  failedCount: number;
  firstFailedIndex: number;
  onReviewFailedLabels: () => void;
  error: string | null;
  scrollToFirstFailedRef: React.RefObject<HTMLDivElement | null>;
  children: React.ReactNode;
}

export function Step3Results({
  step,
  hasBatchSummary,
  isOnSummaryTab,
  batchTab,
  setBatchTab,
  resultsCount,
  currentIndex,
  failedCount,
  firstFailedIndex,
  onReviewFailedLabels,
  error,
  scrollToFirstFailedRef,
  children,
}: Step3ResultsProps) {
  return (
    <div className="min-h-screen depth-0 text-[#1C1C1E]">
      <div
        className="animate-fade-scale-in mx-auto flex max-w-5xl flex-col gap-10 px-4 py-10"
        style={{
          animationDuration: "0.55s",
          animationTimingFunction: "ease-out",
        }}
      >
        <header className="space-y-2">
          <WizardProgress
            step={step}
            hasBatchSummary={hasBatchSummary}
            isOnSummaryTab={isOnSummaryTab}
          />
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

        {failedCount > 0 && resultsCount > 1 && (
          <section
            ref={scrollToFirstFailedRef}
            className="animate-fade-scale-in rounded-[20px] px-5 py-4 depth-1"
            style={{
              background:
                "linear-gradient(135deg, #FFF4E5 0%, #FFF9F0 100%)",
            }}
            role="alert"
            aria-live="polite"
          >
            <div className="flex items-start gap-3">
              <span
                className="mt-0.5 text-[28px] text-[#FF9F0A]"
                aria-hidden
              >
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
                  onClick={onReviewFailedLabels}
                  className="mt-3 text-[16px] font-semibold text-[#007AFF] hover:opacity-80"
                >
                  Review failed labels ↓
                </button>
              </div>
            </div>
          </section>
        )}

        {resultsCount >= 1 && (
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
              Label {currentIndex + 1} of {resultsCount}
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

        {children}
      </div>
    </div>
  );
}
