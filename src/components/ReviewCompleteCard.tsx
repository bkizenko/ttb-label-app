import { LabelNav } from "@/components/LabelNav";

export interface ReviewCompleteCardProps {
  hasFlags: boolean;
  flaggedCount: number;
  acceptedCount: number;
  matchCount: number;
  durationSec: string;
  onNextLabel: () => void;
  onViewBatchSummary: () => void;
  currentIndex: number;
  totalLabels: number;
  onPrev: () => void;
  onNext: () => void;
}

export function ReviewCompleteCard({
  hasFlags,
  flaggedCount,
  acceptedCount,
  matchCount,
  durationSec,
  onNextLabel,
  onViewBatchSummary,
  currentIndex,
  totalLabels,
  onPrev,
  onNext,
}: ReviewCompleteCardProps) {
  const showNextLabel = totalLabels > 1 && currentIndex < totalLabels - 1;
  const showViewSummary = currentIndex === totalLabels - 1;
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
              <span className="text-[15px] font-semibold text-[#FF3B30]">
                {flaggedCount}
              </span>
              <span className="text-[15px] text-[#FF3B30]">
                field{flaggedCount !== 1 ? "s" : ""} flagged as not matching
              </span>
            </div>
          )}
          {acceptedCount > 0 && (
            <div className="flex items-center gap-3 rounded-[12px] border border-[#30D158]/25 bg-[#E8F5E9] px-4 py-2.5">
              <span className="text-[15px] font-semibold text-[#30D158]">
                {acceptedCount}
              </span>
              <span className="text-[15px] text-[#248A3D]">
                field{acceptedCount !== 1 ? "s" : ""} accepted by reviewer
              </span>
            </div>
          )}
          {matchCount > 0 && (
            <div className="flex items-center gap-3 rounded-[12px] border border-[#30D158]/25 bg-[#E8F5E9] px-4 py-2.5">
              <span className="text-[15px] font-semibold text-[#30D158]">
                {matchCount}
              </span>
              <span className="text-[15px] text-[#248A3D]">
                field{matchCount !== 1 ? "s" : ""} matched automatically
              </span>
            </div>
          )}
        </div>
        <p className="mt-5 text-[15px] font-normal text-[#8E8E93]">
          Processed in {durationSec} seconds
        </p>
        <div className="mt-8 flex flex-col gap-4">
          {showNextLabel ? (
            <button
              type="button"
              onClick={onNextLabel}
              className="flex min-h-[56px] w-full items-center justify-center rounded-[24px] px-6 py-4 text-[17px] font-semibold text-white transition-transform duration-150 active:scale-[0.97]"
              style={{
                background:
                  "linear-gradient(180deg, #007AFF 0%, #0051D5 100%)",
                boxShadow: "0 4px 12px rgba(0, 122, 255, 0.25)",
              }}
            >
              Next Label
            </button>
          ) : showViewSummary ? (
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
              View Batch Summary
            </button>
          ) : null}
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
