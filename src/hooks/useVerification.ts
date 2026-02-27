"use client";

import { useCallback, useEffect, useState } from "react";
import { compareLabelData, type ApplicationLabelData } from "@/lib/labelComparison";
import { extractFromOcrText, ocrImage } from "@/lib/ocrClient";
import type { VerificationResult } from "@/lib/types";

export interface UseVerificationOptions {
  fileList: File[];
  applicationData: ApplicationLabelData;
  onRunStart?: () => void;
  onRunComplete?: () => void;
  onCatastrophicError?: (message: string) => void;
  onValidationError?: (message: string) => void;
  onSingleImageStart?: (resultIndex: number) => void;
  onSingleImageEnd?: () => void;
}

export function useVerification({
  fileList,
  applicationData,
  onRunStart,
  onRunComplete,
  onCatastrophicError,
  onValidationError,
  onSingleImageStart,
  onSingleImageEnd,
}: UseVerificationOptions) {
  const [results, setResults] = useState<VerificationResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingCurrent, setProcessingCurrent] = useState(0);
  const [processingTotal, setProcessingTotal] = useState(0);
  const [processingPreviewUrl, setProcessingPreviewUrl] = useState<string | null>(null);
  const [processingFieldLabel, setProcessingFieldLabel] = useState("");
  const [batchStartTime, setBatchStartTime] = useState(0);
  const [batchEndTime, setBatchEndTime] = useState(0);

  useEffect(() => {
    if (isProcessing && fileList.length > 0) {
      const idx = Math.min(processingCurrent, fileList.length - 1);
      const url = URL.createObjectURL(fileList[idx]);
      setProcessingPreviewUrl(url);
      return () => {
        URL.revokeObjectURL(url);
        setProcessingPreviewUrl(null);
      };
    }
    setProcessingPreviewUrl(null);
  }, [isProcessing, fileList, processingCurrent]);

  useEffect(() => {
    if (!isProcessing) {
      setProcessingFieldLabel("");
      return;
    }
    const fields = [
      "Brand name",
      "Class/Type",
      "Alcohol content",
      "Net contents",
      "Bottler/Producer",
      "Country of origin",
      "Government warning",
    ];
    let i = 0;
    setProcessingFieldLabel(fields[0]);
    const cycle = setInterval(() => {
      i = (i + 1) % fields.length;
      setProcessingFieldLabel(fields[i]);
    }, 800);
    return () => clearInterval(cycle);
  }, [isProcessing, processingCurrent]);

  const runVerification = useCallback(
    async (files: File[], applications: ApplicationLabelData[]) => {
      if (!files.length) {
        onValidationError?.("Please add at least one label image.");
        return;
      }
      if (!applications.length) {
        onValidationError?.("Please provide application data to compare against.");
        return;
      }

      setIsProcessing(true);
      setResults([]);
      setProcessingTotal(files.length);
      setProcessingCurrent(0);
      setBatchEndTime(0);
      setBatchStartTime(performance.now());
      onRunStart?.();

      try {
        const newResults: VerificationResult[] = [];
        const BATCH_SIZE = 3;

        for (let batchStart = 0; batchStart < files.length; batchStart += BATCH_SIZE) {
          const batchEnd = Math.min(batchStart + BATCH_SIZE, files.length);

          const batchItems = files.slice(batchStart, batchEnd).map((file, i) => ({
            file,
            index: batchStart + i,
            appData:
              applications[batchStart + i] ?? applications[applications.length - 1],
          }));

          let batchCompleted = 0;
          const batchResults = await Promise.all(
            batchItems.map(async ({ file, index, appData }) => {
              const start = performance.now();
              try {
                const timeoutMs = 60000;
                const ocrPromise = ocrImage(file);
                const timeoutPromise = new Promise<never>((_, reject) =>
                  setTimeout(() => reject(new Error("OCR timeout")), timeoutMs),
                );
                // #region agent log
                console.log(`[DBG-BATCH] starting OCR for index=${index} file=${file.name}`);
                fetch('http://127.0.0.1:7651/ingest/c0175708-cdcf-43ef-bb15-43fcf640f0c3',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'76393b'},body:JSON.stringify({sessionId:'76393b',location:'useVerification.ts:batch-start',message:'batch OCR start',data:{index,fileName:file.name,timeoutMs},timestamp:Date.now(),hypothesisId:'H5'})}).catch(()=>{});
                // #endregion
                const { text: ocrText, extracted: extractedFromApi } =
                  await Promise.race([ocrPromise, timeoutPromise]);
                if (process.env.NODE_ENV === "development") {
                  console.log("RAW OCR TEXT:", ocrText);
                }
                const extracted =
                  extractedFromApi ?? extractFromOcrText(ocrText);
                const checks = compareLabelData(appData, extracted);
                const durationMs = performance.now() - start;
                batchCompleted++;
                setProcessingCurrent(batchStart + batchCompleted);
                return {
                  status: "success" as const,
                  fileName: file.name,
                  checks,
                  rawOcrText: ocrText,
                  durationMs,
                };
              } catch (err) {
                // #region agent log
                const errMsg = err instanceof Error ? err.message : String(err);
                console.error(`[DBG-BATCH] OCR failed index=${index} file=${file.name} error=${errMsg} elapsed=${(performance.now()-start).toFixed(0)}ms`);
                fetch('http://127.0.0.1:7651/ingest/c0175708-cdcf-43ef-bb15-43fcf640f0c3',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'76393b'},body:JSON.stringify({sessionId:'76393b',location:'useVerification.ts:batch-fail',message:'batch OCR failed',data:{index,fileName:file.name,error:errMsg,elapsedMs:performance.now()-start},timestamp:Date.now(),hypothesisId:'H1,H2,H5'})}).catch(()=>{});
                // #endregion
                batchCompleted++;
                setProcessingCurrent(batchStart + batchCompleted);
                return {
                  status: "ocr_failed" as const,
                  fileName: file.name,
                  fileIndex: index,
                };
              }
            }),
          );

          newResults.push(...batchResults);
          setResults([...newResults]);
        }
        setBatchEndTime(performance.now());
        onRunComplete?.();
      } catch {
        onCatastrophicError?.(
          "OCR processing stopped unexpectedly. Your images are safe—try again or contact support.",
        );
      } finally {
        setIsProcessing(false);
        setProcessingCurrent(0);
        setProcessingTotal(0);
      }
    },
    [onRunStart, onRunComplete, onCatastrophicError, onValidationError],
  );

  const runSingleImageVerification = useCallback(
    async (resultIndex: number, fileOverride?: File) => {
      const file = fileOverride ?? fileList[resultIndex];
      if (!file) return;
      onSingleImageStart?.(resultIndex);
      try {
        const start = performance.now();
        const { text: ocrText, extracted: extractedFromApi } = await ocrImage(file);
        if (process.env.NODE_ENV === "development") {
          console.log("RAW OCR TEXT:", ocrText);
        }
        const extracted = extractedFromApi ?? extractFromOcrText(ocrText);
        const checks = compareLabelData(applicationData, extracted);
        const durationMs = performance.now() - start;
        setResults((prev) => {
          const next = [...prev];
          next[resultIndex] = {
            status: "success",
            fileName: file.name,
            checks,
            rawOcrText: ocrText,
            durationMs,
          };
          return next;
        });
      } catch {
        setResults((prev) => {
          const next = [...prev];
          const existing = next[resultIndex];
          if (existing?.status === "ocr_failed") next[resultIndex] = { ...existing };
          return next;
        });
      } finally {
        onSingleImageEnd?.();
      }
    },
    [fileList, applicationData, onSingleImageStart, onSingleImageEnd],
  );

  const batchElapsedMs =
    batchStartTime > 0 && batchEndTime > 0 ? batchEndTime - batchStartTime : 0;

  return {
    results,
    setResults,
    isProcessing,
    processingCurrent,
    processingTotal,
    processingPreviewUrl,
    processingFieldLabel,
    batchStartTime,
    batchEndTime,
    batchElapsedMs,
    runVerification,
    runSingleImageVerification,
  };
}
