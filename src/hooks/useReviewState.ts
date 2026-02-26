"use client";

import { useEffect, useRef, useState } from "react";

const noop = () => {};

export type ReviewMode = "summary" | "reviewing" | "complete";

export interface PerLabelReviewState {
  reviewMode: ReviewMode;
  currentReviewIndex: number;
  manualOverrides: Record<string, string>;
  flaggedFields: Set<string>;
}

export interface UseReviewStateOptions {
  currentResultIndex: number;
  onLabelChange?: () => void;
}

export function useReviewState({
  currentResultIndex,
  onLabelChange,
}: UseReviewStateOptions) {
  const [reviewMode, setReviewMode] = useState<ReviewMode>("summary");
  const [currentReviewIndex, setCurrentReviewIndex] = useState(0);
  const [manualOverrides, setManualOverrides] = useState<Record<string, string>>(
    {},
  );
  const [flaggedFields, setFlaggedFields] = useState<Set<string>>(new Set());

  const perLabelReviewState = useRef<Record<number, PerLabelReviewState>>({});
  const prevResultIndex = useRef(currentResultIndex);
  const onLabelChangeRef = useRef<() => void>(noop);
  onLabelChangeRef.current = onLabelChange ?? noop;

  useEffect(() => {
    const prev = prevResultIndex.current;
    if (prev !== currentResultIndex) {
      perLabelReviewState.current[prev] = {
        reviewMode,
        currentReviewIndex,
        manualOverrides,
        flaggedFields,
      };
      const saved = perLabelReviewState.current[currentResultIndex];
      if (saved) {
        setReviewMode(saved.reviewMode);
        setCurrentReviewIndex(saved.currentReviewIndex);
        setManualOverrides(saved.manualOverrides);
        setFlaggedFields(saved.flaggedFields);
      } else {
        setReviewMode("summary");
        setCurrentReviewIndex(0);
        setManualOverrides({});
        setFlaggedFields(new Set());
      }
      onLabelChangeRef.current?.();
      prevResultIndex.current = currentResultIndex;
    }
  }, [currentResultIndex, reviewMode, currentReviewIndex, manualOverrides, flaggedFields]);

  return {
    reviewMode,
    setReviewMode,
    currentReviewIndex,
    setCurrentReviewIndex,
    manualOverrides,
    setManualOverrides,
    flaggedFields,
    setFlaggedFields,
    perLabelReviewState,
  };
}
