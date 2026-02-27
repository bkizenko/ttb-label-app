import type { FieldCheck } from "@/lib/labelComparison";
import { FIELD_LABEL_MAP } from "@/lib/fieldLabels";
import { LabelNav } from "@/components/LabelNav";

export interface ReviewSummaryCardProps {
  anyIssue: boolean;
  issueCount: number;
  matchCount: number;
  checks: FieldCheck[];
  onStartReview: () => void;
  onViewBatchSummary: () => void;
  onCheckAnother: () => void;
  currentIndex: number;
  totalLabels: number;
  onPrev: () => void;
  onNext: () => void;
}

export function ReviewSummaryCard({
  anyIssue,
  issueCount,
  matchCount,
  checks,
  onStartReview,
  onViewBatchSummary,
  onCheckAnother,
  currentIndex,
  totalLabels,
  onPrev,
  onNext,
}: ReviewSummaryCardProps) {
  return (
    <section id="review-summary-card" className="mx-auto flex max-w-[600px] flex-col gap-8">
      <div
        className="animate-fade-scale-in flex min-h-[140px] flex-col justify-center rounded-[24px] p-8"
        style={{
          boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
          animationDuration: "0.6s",
          animationTimingFunction: "cubic-bezier(0.34, 1.56, 0.64, 1)",
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
        <div className="mt-6 flex flex-col gap-2">
          {checks.map((check) => {
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
                      background:
                        check.status === "missing" ? "#FFEBEB" : "#FFF4E5",
                      color:
                        check.status === "missing" ? "#FF3B30" : "#FF9500",
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
              onClick={onStartReview}
              className="flex min-h-[56px] w-full items-center justify-center rounded-[24px] px-6 py-4 text-[17px] font-semibold text-white transition-transform duration-150 active:scale-[0.97]"
              style={{
                background:
                  "linear-gradient(180deg, #007AFF 0%, #0051D5 100%)",
                boxShadow: "0 4px 12px rgba(0, 122, 255, 0.25)",
              }}
            >
              Start Review
            </button>
          ) : currentIndex >= totalLabels - 1 ? (
            <button
              type="button"
              onClick={onViewBatchSummary}
              className="flex min-h-[56px] w-full items-center justify-center rounded-[24px] px-6 py-4 text-[17px] font-semibold text-white transition-transform duration-150 active:scale-[0.97]"
              style={{
                background:
                  "linear-gradient(180deg, #007AFF 0%, #0051D5 100%)",
                boxShadow: "0 4px 12px rgba(0, 122, 255, 0.25)",
              }}
            >
              View batch summary
            </button>
          ) : (
            <button
              type="button"
              onClick={onNext}
              className="flex min-h-[56px] w-full items-center justify-center rounded-[24px] px-6 py-4 text-[17px] font-semibold text-white transition-transform duration-150 active:scale-[0.97]"
              style={{
                background:
                  "linear-gradient(180deg, #007AFF 0%, #0051D5 100%)",
                boxShadow: "0 4px 12px rgba(0, 122, 255, 0.25)",
              }}
            >
              Next label
            </button>
          )}
        </div>
      </div>
      {totalLabels > 1 && (
        <LabelNav
          currentIndex={currentIndex}
          total={totalLabels}
          onPrev={onPrev}
          onNext={onNext}
        />
      )}
    </section>
  );
}
