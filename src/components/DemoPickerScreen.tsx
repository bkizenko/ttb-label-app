"use client";

import type { DemoPreset } from "@/data/presets";

export interface DemoPickerScreenProps {
  presets: DemoPreset[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onLoadDemo: () => void;
  onBack: () => void;
}

export function DemoPickerScreen({
  presets,
  selectedId,
  onSelect,
  onLoadDemo,
  onBack,
}: DemoPickerScreenProps) {
  return (
    <div className="flex flex-col gap-8">
      <p className="text-[17px] text-[#8E8E93]">
        Choose a sample label to load. The image and application data will be
        filled in so you can try the flow.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {presets.map((preset) => {
          const isSelected = selectedId === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onSelect(preset.id)}
              className={`flex min-h-[72px] items-center gap-4 rounded-[16px] border-2 px-5 py-4 text-left transition-all duration-200 ${
                isSelected
                  ? "border-[#007AFF] bg-[#F0F7FF]"
                  : "border-[#E5E5EA] bg-white hover:border-[#D1D5DB] hover:bg-[#FAFBFC]"
              }`}
              style={{
                boxShadow: isSelected
                  ? "0 0 0 2px rgba(0, 122, 255, 0.2)"
                  : "0 2px 8px rgba(0,0,0,0.04)",
              }}
            >
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg ${
                  isSelected ? "bg-[#007AFF] text-white" : "bg-[#E5E5EA] text-[#8E8E93]"
                }`}
                aria-hidden
              >
                {isSelected ? "✓" : "○"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[17px] font-semibold text-[#1C1C1E]">
                  {preset.label}
                </p>
                <p className="mt-0.5 text-[13px] text-[#8E8E93]">
                  {preset.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onBack}
          className="min-h-[48px] rounded-[16px] border-2 border-[#E5E5EA] bg-white px-6 py-3 text-[15px] font-semibold text-[#1C1C1E] transition-all duration-200 hover:bg-[#F2F2F7] active:scale-[0.98]"
        >
          Back
        </button>
        <button
          type="button"
          disabled={!selectedId}
          onClick={onLoadDemo}
          className="min-h-[48px] rounded-[16px] px-6 py-3 text-[15px] font-semibold text-white transition-all duration-200 disabled:opacity-40 active:scale-[0.98]"
          style={{
            background: "linear-gradient(180deg, #007AFF 0%, #0051D5 100%)",
            boxShadow: "0 4px 12px rgba(0, 122, 255, 0.25)",
          }}
        >
          Load demo
        </button>
      </div>
    </div>
  );
}
