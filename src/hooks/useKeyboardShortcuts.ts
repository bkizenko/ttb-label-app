"use client";

import { useEffect } from "react";

export interface UseKeyboardShortcutsOptions {
  step: 1 | 2 | 3;
  isProcessing: boolean;
  fileListLength: number;
  resultsLength: number;
  onStep2Back: () => void;
  onStep3Back: () => void;
  onRunWizard: () => void;
  onPrevLabel: () => void;
  onNextLabel: () => void;
}

/**
 * Keyboard shortcuts (enhance only; every action has a visible button).
 * - Escape: step back (step 2 → 1, step 3 → 2 when not processing).
 * - Enter on step 2: run wizard when focus not in textarea.
 * - Arrow Left/Right on step 3: previous/next label when multiple results.
 */
export function useKeyboardShortcuts({
  step,
  isProcessing,
  fileListLength,
  resultsLength,
  onStep2Back,
  onStep3Back,
  onRunWizard,
  onPrevLabel,
  onNextLabel,
}: UseKeyboardShortcutsOptions) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isTextarea = target.tagName === "TEXTAREA";

      if (e.key === "Escape") {
        if (step === 2) {
          onStep2Back();
          e.preventDefault();
        } else if (step === 3 && !isProcessing) {
          onStep3Back();
          e.preventDefault();
        }
        return;
      }

      if (step === 2 && e.key === "Enter" && !isTextarea) {
        const form = target.closest("form");
        if (form && !isProcessing && fileListLength > 0) {
          onRunWizard();
          e.preventDefault();
        }
        return;
      }

      if (step === 3 && resultsLength > 1) {
        if (e.key === "ArrowLeft") {
          onPrevLabel();
          e.preventDefault();
        } else if (e.key === "ArrowRight") {
          onNextLabel();
          e.preventDefault();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    step,
    isProcessing,
    fileListLength,
    resultsLength,
    onStep2Back,
    onStep3Back,
    onRunWizard,
    onPrevLabel,
    onNextLabel,
  ]);
}
