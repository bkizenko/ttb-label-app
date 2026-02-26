# Image processing performance

## Strategy (Phase 6)

- **Client-side resize before OCR**: Images are resized so the long edge is at most 1500 px (`MAX_OCR_LONG_EDGE` in `src/lib/ocrClient.ts`). This reduces payload size and API processing time. Aspect ratio is preserved; output is JPEG (0.88 quality) when the source is not PNG.
- **No accuracy trade-off**: 1500 px on the long edge is sufficient for label text; we do not reduce prompt detail or loosen comparison logic.

## Benchmarking

- **Per-label time**: Shown in the app as "Xs" per label and in the batch summary; stored as `durationMs` on each result (OCR + comparison).
- **Batch time**: "Total time" in the batch summary uses wall-clock from run start to run complete (`batchElapsedMs` in `useVerification`).
- To compare before/after resize: run a few labels with the same images, note the per-label times and total time from the summary or from terminal logs (`[OCR] total X ms`). Resize typically reduces both transfer and Gemini processing time for large photos.
