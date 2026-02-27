"use client";

import type { RefObject } from "react";
import type { PerLabelReviewState } from "@/hooks/useReviewState";
import type { VerificationResult } from "@/lib/types";
import { FIELD_LABEL_MAP } from "@/lib/fieldLabels";

const FIELD_KEYS = [
  "brandName",
  "classType",
  "alcoholContent",
  "netContents",
  "bottlerNameAddress",
  "countryOfOrigin",
  "governmentWarning",
  "alcoholContentFormat",
] as const;

const SUMMARY_FIELD_LABELS: Record<string, string> = {
  brandName: "Brand name",
  classType: "Class/Type",
  alcoholContent: "Alcohol content",
  netContents: "Net contents",
  bottlerNameAddress: "Bottler/Producer",
  countryOfOrigin: "Country of origin",
  governmentWarning: "Government warning",
  alcoholContentFormat: "ABV abbreviation",
};

export interface BatchSummaryTabProps {
  results: VerificationResult[];
  perLabelReviewState: RefObject<Record<number, PerLabelReviewState>>;
  /** Wall-clock time from batch start to batch complete (ms). When set, used for "Total time" instead of sum of per-label OCR times. */
  batchElapsedMs?: number;
  onSelectLabel: (index: number) => void;
}

export function BatchSummaryTab({
  results,
  perLabelReviewState,
  batchElapsedMs = 0,
  onSelectLabel,
}: BatchSummaryTabProps) {
  const passedCount = results.filter(
    (r) => r.status === "success" && r.checks.every((c) => c.status === "match"),
  ).length;
  const reviewCount = results.filter(
    (r) => r.status === "success" && r.checks.some((c) => c.status !== "match"),
  ).length;
  const ocrFailedCount = results.filter((r) => r.status === "ocr_failed").length;
  const successResults = results.filter((r) => r.status === "success");
  const sumOcrMs = successResults.reduce(
    (sum, r) => sum + (r.durationMs ?? 0),
    0,
  );
  const totalMs = batchElapsedMs > 0 ? batchElapsedMs : sumOcrMs;
  const avgMs = totalMs / Math.max(1, successResults.length);
  const totalSec = totalMs / 1000;
  const totalTimeStr =
    totalSec >= 60
      ? `${Math.floor(totalSec / 60)}m ${Math.round(totalSec % 60)}s`
      : `${totalSec.toFixed(1)}s`;

  const handleExportCsv = () => {
    const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
    const rows: string[] = [];
    rows.push("Verification Summary");
    rows.push(["Metric", "Value"].join(","));
    rows.push(["Total labels", String(results.length)].join(","));
    rows.push(["Total time", totalTimeStr].join(","));
    rows.push(["Avg per label", `${(avgMs / 1000).toFixed(1)}s`].join(","));
    rows.push(["Passed", String(passedCount)].join(","));
    rows.push(["Need review", String(reviewCount)].join(","));
    rows.push(["Failed (OCR)", String(ocrFailedCount)].join(","));
    rows.push("");
    rows.push("Per-Label Detail");
    const header = ["File Name"];
    for (const fk of FIELD_KEYS) {
      header.push(
        `${SUMMARY_FIELD_LABELS[fk]} Status`,
        `${SUMMARY_FIELD_LABELS[fk]} Expected`,
        `${SUMMARY_FIELD_LABELS[fk]} Found`,
      );
    }
    header.push("Reviewer Decision", "Issues", "Duration (s)");
    rows.push(header.join(","));
    for (let ri = 0; ri < results.length; ri++) {
      const r = results[ri];
      if (r.status !== "success") {
        const cells = [esc(r.fileName)];
        for (let fi = 0; fi < FIELD_KEYS.length; fi++) {
          cells.push("", "", "");
        }
        cells.push("", "OCR Failed", "");
        rows.push(cells.join(","));
        continue;
      }
      const saved = perLabelReviewState.current?.[ri];
      const cells = [esc(r.fileName)];
      for (const fk of FIELD_KEYS) {
        const check = r.checks.find((c) => c.field === fk);
        cells.push(
          check?.status ?? "—",
          esc(check?.expected ?? ""),
          esc(check?.actual ?? ""),
        );
      }
      const decision =
        saved?.reviewMode === "complete"
          ? saved.flaggedFields.size > 0
            ? "Flagged"
            : "Accepted"
          : "Not reviewed";
      const issues = r.checks.filter((c) => c.status !== "match").length;
      cells.push(decision, String(issues), (r.durationMs / 1000).toFixed(1));
      rows.push(cells.join(","));
    }
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `batch-results-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const fieldCounts: Record<string, number> = {};
  for (const key of FIELD_KEYS) fieldCounts[key] = 0;
  for (const r of results) {
    if (r.status !== "success") continue;
    for (const check of r.checks) {
      if (
        (check.status === "mismatch" || check.status === "missing") &&
        fieldCounts[check.field] !== undefined
      ) {
        fieldCounts[check.field]++;
      }
    }
  }
  const problematic = FIELD_KEYS.map((key) => ({
    field: key,
    count: fieldCounts[key] ?? 0,
  }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count);
  const maxCount =
    problematic.length > 0
      ? Math.max(...problematic.map((p) => p.count))
      : 0;

  return (
    <section className="mx-auto flex w-full max-w-[600px] flex-col gap-4">
      <div className="rounded-[20px] bg-white p-5 depth-1">
        <p className="text-[17px] font-semibold text-[#1C1C1E]">
          Verification Complete
        </p>
        <p className="mt-1 text-[13px] text-[#8E8E93]">
          {results.length} label{results.length !== 1 ? "s" : ""} processed
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-[12px] bg-[#F2F2F7] px-3 py-2.5 text-center">
            <p className="text-[22px] font-bold text-[#1C1C1E]">
              {totalTimeStr}
            </p>
            <p className="text-[12px] text-[#3C3C43]">Total time</p>
          </div>
          <div className="rounded-[12px] bg-[#F2F2F7] px-3 py-2.5 text-center">
            <p className="text-[22px] font-bold text-[#1C1C1E]">
              {(avgMs / 1000).toFixed(1)}s
            </p>
            <p className="text-[12px] text-[#3C3C43]">Avg per label</p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-3">
          <div className="rounded-[12px] bg-[#F2F2F7] px-3 py-2.5 text-center">
            <p className="text-[22px] font-bold text-[#248A3D]">
              {passedCount}
            </p>
            <p className="text-[12px] text-[#3C3C43]">Passed</p>
          </div>
          <div className="rounded-[12px] bg-[#F2F2F7] px-3 py-2.5 text-center">
            <p className="text-[22px] font-bold text-[#FF9500]">
              {reviewCount}
            </p>
            <p className="text-[12px] text-[#3C3C43]">Need review</p>
          </div>
          <div className="rounded-[12px] bg-[#F2F2F7] px-3 py-2.5 text-center">
            <p className="text-[22px] font-bold text-[#D70015]">
              {ocrFailedCount}
            </p>
            <p className="text-[12px] text-[#3C3C43]">Failed</p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleExportCsv}
          className="mt-4 flex min-h-[48px] w-full items-center justify-center rounded-[16px] border-2 border-[#E5E5EA] bg-white px-4 py-2.5 text-[15px] font-semibold text-[#1C1C1E] transition-all duration-500 active:scale-[0.98] hover:scale-[1.02]"
        >
          Export All as CSV
        </button>
      </div>

      <div className="rounded-[20px] bg-white p-5 depth-1">
        <p className="text-[17px] font-semibold text-[#1C1C1E]">
          Most problematic fields
        </p>
        {problematic.length === 0 ? (
          <p className="mt-2 text-[15px] text-[#8E8E93]">
            No recurring field issues across labels.
          </p>
        ) : (
          <ul
            className="mt-3 list-none overflow-hidden rounded-[12px]"
            style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
          >
            {problematic.map(({ field, count }) => {
              const isHigh = maxCount > 0 && count >= maxCount * 0.6;
              const color = isHigh ? "#FF3B30" : "#FF9500";
              return (
                <li
                  key={field}
                  className="flex items-center justify-between border-b border-[#E5E5EA]/80 px-4 py-3 last:border-b-0"
                >
                  <span className="text-[15px] font-medium text-[#1C1C1E]">
                    {FIELD_LABEL_MAP[field] ?? field}
                  </span>
                  <span
                    className="text-[15px] font-semibold tabular-nums"
                    style={{ color }}
                  >
                    {count} label{count !== 1 ? "s" : ""}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {results.map((result, i) => {
        const isSuccess = result.status === "success";
        const hasIssues =
          isSuccess &&
          result.checks.some((c) => c.status !== "match");
        const isFailed = result.status === "ocr_failed";
        const issueCount = isSuccess
          ? result.checks.filter((c) => c.status !== "match").length
          : 0;
        const icon = isFailed ? "❌" : hasIssues ? "⚠️" : "✅";
        const statusText = isFailed
          ? "Could not read label"
          : hasIssues
            ? `${issueCount} field${issueCount !== 1 ? "s" : ""} need review`
            : "All fields verified";
        return (
          <button
            key={i}
            type="button"
            onClick={() => onSelectLabel(i)}
            className="flex items-center gap-4 rounded-[20px] bg-white px-5 py-4 text-left transition-transform duration-150 active:scale-[0.98] hover:scale-[1.01] depth-1"
          >
            <span className="text-[28px] leading-none">{icon}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[16px] font-semibold text-[#1C1C1E]">
                {result.fileName}
              </p>
              <p className="mt-0.5 text-[14px] text-[#8E8E93]">
                {statusText}
              </p>
            </div>
            <span className="text-[22px] font-light text-[#C7C7CC]">›</span>
          </button>
        );
      })}
    </section>
  );
}
