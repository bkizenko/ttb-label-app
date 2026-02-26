export interface LabelNavProps {
  currentIndex: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
}

export function LabelNav({ currentIndex, total, onPrev, onNext }: LabelNavProps) {
  return (
    <div className="flex items-center justify-center gap-4 pt-4">
      <button
        type="button"
        aria-label="Previous label"
        disabled={currentIndex === 0}
        onClick={onPrev}
        className="inline-flex min-h-[48px] min-w-[48px] items-center justify-center rounded-[12px] border border-[#E5E5EA] bg-white text-[#1C1C1E] transition-transform duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
      >
        ‹
      </button>
      <span className="min-w-[80px] text-center text-[15px] text-[#8E8E93]">
        {currentIndex + 1} / {total}
      </span>
      <button
        type="button"
        aria-label="Next label"
        disabled={currentIndex >= total - 1}
        onClick={onNext}
        className="inline-flex min-h-[48px] min-w-[48px] items-center justify-center rounded-[12px] border border-[#E5E5EA] bg-white text-[#1C1C1E] transition-transform duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
      >
        ›
      </button>
    </div>
  );
}
