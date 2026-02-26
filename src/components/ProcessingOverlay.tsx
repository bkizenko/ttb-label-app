export interface ProcessingOverlayProps {
  processingPreviewUrl: string | null;
  processingCurrent: number;
  processingTotal: number;
  processingFieldLabel: string;
}

export function ProcessingOverlay({
  processingPreviewUrl,
  processingCurrent,
  processingTotal,
  processingFieldLabel,
}: ProcessingOverlayProps) {
  return (
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
      <div
        className="animate-loading-content-in mx-auto mt-8 flex w-full max-w-[600px] flex-col gap-4"
        style={{ animationDelay: "0.15s" }}
      >
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
  );
}
