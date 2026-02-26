export interface CatastrophicErrorModalProps {
  message: string;
  onDismiss: () => void;
}

export function CatastrophicErrorModal({ message, onDismiss }: CatastrophicErrorModalProps) {
  return (
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
          <span className="flex h-10 w-10 items-center justify-center text-[40px] text-[#8E8E93]" aria-hidden>
            ⚠
          </span>
          <h2 id="catastrophic-error-heading" className="text-[22px] font-semibold text-[#1C1C1E]">
            Something went wrong
          </h2>
          <p className="text-[16px] leading-relaxed text-[#8E8E93]">{message}</p>
          <div className="flex w-full flex-col gap-3 pt-2">
            <button
              type="button"
              onClick={onDismiss}
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
  );
}
