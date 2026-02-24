# Evaluation Audit — TTB Label Verification App

Audited: 2026-02-24  
Reviewer posture: Senior engineer evaluating a take-home submission

---

## 1. PASS / FAIL AUDIT

| # | Requirement | Verdict | Evidence |
|---|-------------|---------|----------|
| 1 | OCR extracts brand name accurately and completely | **PASS (weak)** | Gemini 2.5 Flash does the heavy OCR lifting. Client-side `extractFromOcrText` then guesses the brand from the first 3 non-type-keyword lines — fragile heuristic, but works for typical labels. |
| 2 | OCR extracts class/type designation | **PASS** | Keyword list of ~30 beverage types matched against OCR text. Falls back to individual word detection. Covers common types. |
| 3 | OCR extracts alcohol content | **PASS** | Regex handles both `XX% Alc./Vol.` and `XX Proof` patterns. Includes OCR-error correction hacks (`BE` → `4`, `B5` → `85`). |
| 4 | OCR extracts net contents | **PASS** | Regex matches `\d+ (mL|L|FL OZ|oz)` patterns. |
| 5 | OCR extracts name and address of bottler/producer | **FAIL** | Field does not exist in `ApplicationLabelData`, `ExtractedLabelData`, the extraction logic, the comparison logic, or the UI. Completely absent. |
| 6 | OCR extracts country of origin for imports | **FAIL** | Same — not in the data model, extraction, comparison, or UI at all. |
| 7 | Government warning extracted word-for-word | **PASS** | Slices raw OCR text from the `GOVERNMENT WARNING` index forward (up to 400 chars). Compared with `normalizeForLooseMatch` which strips punctuation/spacing but preserves word content. |
| 8 | "GOVERNMENT WARNING:" validated as all caps | **FAIL** | `page.tsx:186` — regex is `/GOVERNMENT WARNING[.:]/i`. The **`i` flag makes it case-insensitive**, so `"Government Warning:"` (title case — exactly the rejection case Jenny described) passes validation. The `i` flag must be removed. |
| 9 | "GOVERNMENT WARNING:" validated as bold | **FAIL** | Code acknowledges "bold styling cannot be detected from OCR" but does nothing about it. Gemini is a vision model — the prompt could ask "Is the text 'GOVERNMENT WARNING:' rendered in bold?" but this is not attempted. |
| 10 | Comparison: brand name is case-insensitive match | **PASS** | `normalizeForComparison` lowercases + strips punctuation. `STONE'S THROW` vs `Stone's Throw` → 100% similarity. Tested. |
| 11 | Comparison: numeric fields (ABV, net contents) exact match | **PASS (weak)** | `normalizeNumeric` strips non-digits → exact comparison. But when that fails, falls through to **fuzzy matching at 90% threshold** — not "exact". Practical risk is low (test suite confirms 45% vs 40% is a mismatch), but the fallback path is technically not exact. |
| 12 | Comparison: government warning character-for-character exact | **PASS (weak)** | `normalizeForLooseMatch` strips ALL non-alphanumeric chars and uppercases. This means `"warning."` vs `"warning"` are identical. Tolerant of OCR noise but not truly character-for-character. Acceptable tradeoff given OCR reality. |
| 13 | Results returned in under 5 seconds | **PASS (likely)** | Uses Gemini API with streaming. Typical single-label response is 2-5s depending on image size and API latency. Cannot guarantee <5s for large images or during API congestion. |
| 14 | UI simple enough for non-technical users | **PASS** | 3-step wizard. Apple HIG-inspired design. Large touch targets (56px buttons, 44px min). Screen reader announcements. Keyboard shortcuts. Clean visual hierarchy. |
| 15 | Batch upload for 200-300 labels | **PASS (weak)** | Multi-file upload works. Sequential processing with progress bar. But: (a) processes labels one-at-a-time with no parallelism — 300 labels × 3-5s each = 15-25 minutes, (b) batch application data requires pasting raw JSON, (c) Gemini API rate limits not handled. |
| 16 | Handles poor quality images | **PASS (weak)** | Gemini handles moderate quality issues (angles, lighting). Failed OCR results get a friendly "Couldn't read this label" card with options to retry, replace image, or skip. No image preprocessing (rotation, contrast enhancement). |
| 17 | Error handling — graceful failures, not crashes | **PASS** | OCR failures caught per-label, don't stop batch. Catastrophic error modal with retry. File type validation. Invalid JSON handling. No uncaught promise rejections. |
| 18 | README with setup, approach, tools, assumptions | **FAIL** | README exists and is detailed, but **actively lies about the tech stack**. Claims "OCR is done on-device using `tesseract.js`" (lines 22, 101-103) — the actual code uses Gemini API via a server route. `tesseract.js` is not in `package.json`. An evaluator who reads the README then inspects the code will question the candidate's honesty or attention to detail. |
| 19 | Code quality — clean, organized, well-structured | **FAIL** | `page.tsx` is **2,001 lines** — a single React component containing all state (20+ useState hooks), all UI for 3 wizard steps, all OCR logic, all parsing heuristics, all keyboard handling, and all batch processing. No component decomposition. No custom hooks. The comparison logic (`labelComparison.ts`) is properly separated, but the main page is the opposite of "clean, organized, well-structured." |
| 20 | Deployed and working at Vercel URL | **PASS (assumed)** | Vercel config present. README links to `https://ttb-label-p9mg5uf7r-bkizenkos-projects.vercel.app/`. Requires `GEMINI_API_KEY` env var to be set on Vercel. |

**Score: 12 PASS, 5 FAIL, 3 PASS-weak-enough-to-be-concerning**

---

## 2. TOP 5 FAILURES (ranked by severity)

### 1. Two required TTB fields completely missing (name/address, country of origin)

**Severity: CRITICAL — immediate disqualification risk**

The project requirements explicitly list "Name and address of bottler/producer" and "Country of origin for imports" as required fields. They are not in the data model, not extracted, not compared, and not in the UI. An evaluator checking requirements against code will see two checkboxes that can't be ticked. This signals incomplete reading of the requirements.

### 2. README lies about the technology stack

**Severity: HIGH — credibility destroyer**

The README repeatedly claims Tesseract.js for on-device OCR:
- "OCR is done **on-device** using `tesseract.js` (no external ML endpoints)"
- "On-device OCR via `tesseract.js`"
- "Avoids outbound calls to ML endpoints, which are often blocked on government networks"

The actual code uses Google Gemini 2.5 Flash via a server-side API route that makes outbound HTTPS calls to Google's servers. `tesseract.js` is not in `package.json`. This makes the entire "rationale" section of the README fiction. Evaluators will either think you copy-pasted from an earlier version or deliberately misrepresented your work.

### 3. Government warning all-caps validation is broken

**Severity: HIGH — demonstrates the wrong thing works**

`page.tsx:186`:
```js
const hasExactHeader = /GOVERNMENT WARNING[.:]/i.test(text);
```

The `i` (case-insensitive) flag means `"Government Warning:"` passes validation as all-caps. Jenny's interview specifically described rejecting this exact case: *"I caught one last month where they used 'Government Warning' in title case instead of all caps. Rejected."* The bug makes the feature do the opposite of what the stakeholder described.

### 4. `page.tsx` is a 2,000-line monolith

**Severity: MEDIUM — code quality evaluation criterion**

One file contains:
- 20+ `useState` hooks
- OCR calling logic (`ocrImage`)
- Text parsing/extraction logic (`extractFromOcrText`)
- A `ThumbnailCard` component
- All UI for 3 wizard steps (upload, form, results)
- Keyboard shortcut handling
- Batch processing orchestration
- Review workflow state machine
- File replacement logic

This would be the first thing a senior reviewer notices when opening the project. Even if everything else worked perfectly, a 2,000-line single component demonstrates poor engineering habits for a submission being evaluated on "code quality and organization."

### 5. OCR prompt wastes Gemini's capabilities

**Severity: MEDIUM — missed opportunity, fragile architecture**

The Gemini prompt is:
> "Extract all visible text from this alcohol label exactly as it appears. Return only the raw text, no commentary."

This uses a vision-language model as a dumb OCR engine, then runs fragile regex/heuristic parsing client-side. Gemini can extract structured data directly:

```
"Extract the following fields from this alcohol label image as JSON:
- brandName
- classType  
- alcoholContent
- netContents
- bottlerName
- bottlerAddress
- countryOfOrigin
- governmentWarning (exact text)
- isGovernmentWarningHeaderAllCaps (boolean)
- isGovernmentWarningHeaderBold (boolean)"
```

This would fix failures #1, #3, and #9 simultaneously, eliminate the fragile `extractFromOcrText` heuristics, and produce more accurate results.

---

## 3. FIX PLAN

### Fix 1: Add missing fields (name/address, country of origin)

**Files:** `src/lib/labelComparison.ts`, `src/app/page.tsx`

**Step A — Update data types** in `labelComparison.ts`:

```ts
export type ApplicationLabelData = {
  brandName: string;
  classType: string;
  alcoholContent: string;
  netContents: string;
  bottlerNameAddress: string;      // ADD
  countryOfOrigin: string;         // ADD
  governmentWarning: string;
};

export type ExtractedLabelData = {
  brandName?: string;
  classType?: string;
  alcoholContent?: string;
  netContents?: string;
  bottlerNameAddress?: string;     // ADD
  countryOfOrigin?: string;        // ADD
  governmentWarningText?: string;
  hasGovernmentWarningHeaderExact?: boolean;
};
```

**Step B — Add comparison logic** in `compareLabelData()`:

Add fuzzy checks for `bottlerNameAddress` (threshold 80) and `countryOfOrigin` (threshold 90) using the same `pushFuzzyCheck` pattern as brand name.

**Step C — Add UI fields** in `page.tsx`:

Add two input fields in the Step 2 form (after net contents, before government warning).

**Step D — Add extraction** in `extractFromOcrText()`:

Add regex/heuristic for address patterns and country names, or (better) switch to structured Gemini extraction per Fix 5.

---

### Fix 2: Fix the README

**File:** `README.md`

Replace all Tesseract.js references with accurate Gemini API description:

- Line 22-23: Change "OCR is done **on-device** using `tesseract.js`" → "OCR uses **Google Gemini 2.5 Flash** via a server-side API route"
- Lines 101-103: Change "On-device OCR via `tesseract.js`" → "Server-side OCR via Google Gemini API"
- Lines 103: Remove "Avoids outbound calls to ML endpoints" — the app does exactly that
- Line 144: Change "Browser-based Tesseract struggles with decorative fonts" → "Gemini handles most label styles well; decorative/extreme fonts may reduce accuracy"
- Add `GEMINI_API_KEY` to "Getting started" prerequisites

---

### Fix 3: Fix government warning all-caps validation

**File:** `src/app/page.tsx`, line 186

```diff
- const hasExactHeader = /GOVERNMENT WARNING[.:]/i.test(text);
+ const hasExactHeader = /GOVERNMENT WARNING[.:]/.test(text);
```

Remove the `i` flag. The regex literal already contains uppercase text, so it will only match the all-caps form.

**File:** `src/lib/labelComparison.test.ts`

Add a test case:

```ts
it("rejects title-case 'Government Warning:' as not all-caps header", () => {
  // Simulates the exact case Jenny described rejecting
  const extracted: ExtractedLabelData = {
    ...fullMatch,
    hasGovernmentWarningHeaderExact: false, // what the fixed extractor should produce
  };
  const checks = compareLabelData(baseApplication, extracted);
  const headerCheck = checks.find(c => c.field === "governmentWarningHeader");
  expect(headerCheck?.status).toBe("mismatch");
});
```

---

### Fix 4: Break up `page.tsx`

**Target structure:**

```
src/
  components/
    ThumbnailCard.tsx          (lines 219-291 — already a component, just move it)
    WizardProgress.tsx         (lines 645-678 — the progress dots)
    Step1Upload.tsx            (lines 688-878 — upload step)
    Step2ApplicationData.tsx   (lines 881-1297 — form + loading states)
    Step3Results.tsx           (lines 1299-1996 — results + review flow)
    CatastrophicErrorModal.tsx (repeated 3 times — extract once)
    BatchProgressCard.tsx      (repeated 2 times — extract once)
  hooks/
    useVerification.ts         (runVerification, runSingleImageVerification, state)
    useKeyboardShortcuts.ts    (lines 598-636)
  lib/
    ocrClient.ts               (ocrImage function, lines 198-217)
    extractFromOcrText.ts      (extractFromOcrText, lines 37-196)
    labelComparison.ts         (keep as-is)
  app/
    page.tsx                   (thin shell: mode/step routing + state provider)
```

This doesn't change any functionality — just moves code to logical files.

---

### Fix 5: Switch to structured Gemini extraction

**File:** `src/app/api/ocr/route.ts`

Replace the generic OCR prompt with a structured extraction prompt:

```ts
const prompt = `Analyze this alcohol beverage label image. Extract the following fields as JSON. 
If a field is not visible, set it to null.

{
  "brandName": "the primary brand name",
  "classType": "the class/type designation (e.g. Kentucky Straight Bourbon Whiskey)",
  "alcoholContent": "alcohol content as shown (e.g. 45% Alc./Vol. (90 Proof))",
  "netContents": "net contents as shown (e.g. 750 mL)",
  "bottlerNameAddress": "name and address of bottler/producer",
  "countryOfOrigin": "country of origin if shown, null if domestic",
  "governmentWarningText": "the full government warning text, word for word",
  "isGovernmentWarningHeaderAllCaps": true/false,
  "isGovernmentWarningHeaderBold": true/false
}

Return ONLY valid JSON, no markdown fences.`;
```

Then parse the JSON response directly instead of running `extractFromOcrText` heuristics. Keep `extractFromOcrText` as a fallback for when Gemini returns non-JSON.

This single change fixes:
- Missing bottler/producer field (Fix 1)
- Missing country of origin field (Fix 1)  
- Bold detection (requirement #9)
- Fragile heuristic parsing
- Brand name extraction accuracy

---

### Fix 6: Remove API key logging

**File:** `src/app/api/ocr/route.ts`, lines 5, 8-9

```diff
  export async function POST(req: NextRequest) {
-   console.log("OCR route hit");
-
    const apiKey = process.env.GEMINI_API_KEY;
-   console.log("API key present:", !!apiKey);
-   console.log("Key prefix:", process.env.GEMINI_API_KEY?.slice(0, 10));
```

Logging the first 10 characters of an API key to stdout is a security issue that would be flagged in any code review.

---

## Priority Order for Fixes

If time is limited, implement in this order:

1. **Fix 3** (5 min) — Remove the `i` flag. One character change.
2. **Fix 6** (2 min) — Remove console.logs. Three line deletions.
3. **Fix 2** (15 min) — Fix README to match reality. Text edits only.
4. **Fix 5** (30 min) — Structured Gemini prompt. Fixes #1, #5, #6, #9 simultaneously.
5. **Fix 1** (45 min) — Add missing fields to types, comparison, and UI. Mostly covered by Fix 5 if done first.
6. **Fix 4** (60 min) — Component decomposition. Important but lowest risk if everything else works.

Total estimated time to fix all critical issues: **~2.5 hours**

---

## Summary Verdict

This submission has a solid foundation — the UI is genuinely good, the comparison logic is thoughtful, the wizard flow is clean, and the test coverage on comparison logic is decent. But it has **two completely missing required fields**, a **README that describes a different app**, and a **broken validation for the exact scenario a stakeholder described**. These three issues together would likely result in a rejection, because they signal the candidate either didn't read the requirements carefully or didn't verify their work before submitting.

The fastest path to a passing submission is: Fix 3 → Fix 6 → Fix 2 → Fix 5 (structured Gemini prompt, which solves missing fields + bold detection in one shot) → Fix 4 if time permits.
