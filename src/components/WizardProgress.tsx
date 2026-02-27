export interface WizardProgressProps {
  step: 1 | 2 | 3;
  hasBatchSummary: boolean;
  isOnSummaryTab: boolean;
  isStep1?: boolean;
}

export function WizardProgress({
  step,
  hasBatchSummary,
  isOnSummaryTab,
  isStep1 = step === 1,
}: WizardProgressProps) {
  return (
    <div
      className={`mb-6 flex items-center gap-3 ${isStep1 ? "step1-progress-in" : ""}`}
    >
      <span className="text-[17px] font-bold text-[#1C1C1E]">
        {step === 1 && "Step 1 of 4"}
        {step === 2 && "Step 2 of 4"}
        {step === 3 && !hasBatchSummary && "Step 3 of 4"}
        {step === 3 && hasBatchSummary && !isOnSummaryTab && "Step 3 of 4"}
        {step === 3 && hasBatchSummary && isOnSummaryTab && "Step 4 of 4"}
      </span>
      <div className="flex items-center gap-2">
        {[1, 2, 3, 4].map((s) => {
          const currentStepIndex = step === 3 && hasBatchSummary && isOnSummaryTab ? 4 : step;
          const isCurrent = s === currentStepIndex;
          const isPreceding = s < currentStepIndex;
          return (
            <span
              key={s}
              className={`rounded-full transition-all duration-300 ${
                isCurrent
                  ? "progress-dot-active h-3.5 w-3.5 scale-125 bg-[#007AFF] sm:scale-[1.4]"
                  : isPreceding
                    ? "h-3.5 w-3.5 bg-[#30D158]"
                    : "h-3.5 w-3.5 bg-[#C7C7CC]"
              }`}
              style={
                isCurrent
                  ? { boxShadow: "0 0 8px rgba(0, 122, 255, 0.5)" }
                  : undefined
              }
            />
          );
        })}
      </div>
    </div>
  );
}
