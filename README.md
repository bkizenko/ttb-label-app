## AI-Powered Alcohol Label Verification (Prototype)

This is a small web app that helps TTB label compliance agents quickly compare what is on a label image with what is in the application (COLA) record.

The focus is on **fast, obvious verification** of routine fields, keeping human agents in control.

### Core workflow

- **Single label mode**
  - Upload one label image.
  - Fill in the application record fields (brand name, class/type, ABV, net contents, government warning).
  - Click **Run verification**.
  - The app performs OCR in the browser and shows a table of matches/mismatches for each key field.

- **Batch mode**
  - Upload multiple label images at once.
  - Paste a JSON array of application records (one per label, last record reused if there are more labels than records).
  - Click **Run batch verification** to process them in sequence.

Behind the scenes:

- OCR uses **Google Gemini 2.5 Flash** via a server-side API route (`/api/ocr`).
- Gemini returns **structured JSON** fields (brand, class/type, ABV, net contents, bottler/producer info, country of origin, government warning).
- Comparison logic normalizes text to tolerate:
  - Case differences (`STONE'S THROW` vs `Stone's Throw`).
  - Spacing and punctuation noise.
  - Minor formatting differences, while still surfacing potential issues for human review.
- The **government warning text** is compared word-for-word (ignoring spacing/punctuation), and the app separately validates the `GOVERNMENT WARNING:` header for **all caps** and **bold**.

### Getting started (local)

Prerequisites:

- Node.js 18+ and npm installed.
- A Google AI Studio API key (`GEMINI_API_KEY`).

Create a `.env.local` file:

```bash
cp .env.example .env.local
```

Then set `GEMINI_API_KEY` in `.env.local`.

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Then open `http://localhost:3000` in your browser.

## Deployment

Live demo: [https://ttb-label-p9mg5uf7r-bkizenkos-projects.vercel.app/](https://ttb-label-p9mg5uf7r-bkizenkos-projects.vercel.app/)

For the best experience during this prototype:

- Use reasonably sized label images (e.g. under ~5 MB).
- Photos that are upright, reasonably lit, and not extremely skewed will OCR more reliably.

### How to use the app

1. **Choose mode**
   - Use the buttons at the top to switch between **Single label** and **Batch**.

2. **Add label image(s)**
   - Click the upload area and select image files.
   - In batch mode you can select multiple images at once.

3. **Provide application data**
   - **Single**: fill in the form for brand, class/type, ABV, net contents, bottler/producer name & address, country of origin, and the government warning.
   - **Batch**: paste a JSON array of application records, for example:

     ```json
     [
       {
         "brandName": "OLD TOM DISTILLERY",
         "classType": "Kentucky Straight Bourbon Whiskey",
         "alcoholContent": "45% Alc./Vol. (90 Proof)",
         "netContents": "750 mL",
         "bottlerNameAddress": "Bottled by Old Tom Distillery, Louisville, KY",
         "countryOfOrigin": "United States",
         "governmentWarning": "GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems."
       }
     ]
     ```

4. **Run verification**
   - Click **Run verification** (single) or **Run batch verification**.
   - The app shows:
     - Per-field status: **Match**, **Needs review**, or **Not found**.
     - The expected value from the application.
     - The value detected on the label (if any).
     - Short notes to guide human judgment.
### Technical choices and rationale

- **Next.js + React + TypeScript**
  - Fast to develop and easy to deploy (e.g. Vercel, Azure Web Apps).
  - Supports modern, accessible UI for agents with varying tech comfort.

- **Tailwind CSS**
  - Keeps the UI visually clean and consistent with minimal CSS overhead.
  - Helps emphasize key actions and statuses (e.g., green for matches, amber for review, red for missing).

- **Server-side OCR via Google Gemini API**
  - Uses Gemini Vision to extract structured fields from the label image.
  - Trades simplicity of deployment for requiring outbound access and an API key.

- **Heuristic parsing and comparison**
  - Extracts fields with simple regexes and heuristics rather than a heavy model.
  - Uses normalization (case, accents, non-alphanumeric removal) so that obvious equivalents count as matches.
  - Separates **content checks** from **format checks** (e.g. the exact `GOVERNMENT WARNING:` header in all caps).

### Performance expectations

- For typical label images, OCR and comparison should complete in **around a few seconds per label** on a modern laptop browser.
- The UI surfaces a lightweight progress indicator (`Reading label 1 of N...`).
- For extremely large images or poor-quality photos, processing may take longer; in a production setting we would:
  - Pre-normalize/resize images server-side.
  - Potentially move OCR to a more optimized engine or dedicated service within the agency network.

### Assumptions and limitations

- **Prototype only**:
  - No persistence or integration with the live COLA system.
  - No PII or sensitive data is stored; everything happens in memory in the browser.

- **Image quality**:
  - Strong glare, heavy skew, or extremely small fonts will reduce OCR accuracy.
  - Bold/italics/true font weight cannot be reliably inferred from OCR, so the app focuses on text content and capitalization.

- **Nuance and human judgment**:
  - Close-but-not-identical strings (e.g. minor punctuation or spacing differences) are intentionally flagged as "Needs review" instead of auto-accepting.
  - Edge cases like creative branding, unusual layouts, or non-standard phrasing will still require agent review.

### Deployment notes

- You can deploy this app on any platform that supports Node.js:
  - **Vercel**: push to GitHub and import the repo into Vercel (Next.js is first-class supported).
  - **Azure App Service / Azure Static Web Apps**: build with `npm run build` and follow Azure's Next.js deployment guide.
- For a future production-grade system inside TTB infrastructure, you could:
  - Host Next.js behind the existing COLA authentication layer.
  - Move OCR + parsing into an internal API (e.g. .NET or Node microservice) running on Azure within the FedRAMP boundary.
  - Swap in a more accurate OCR/vision model that can handle more challenging photography conditions.

## Known Limitations

**OCR Accuracy**: Gemini can still struggle with extreme glare, severe skew, or very small decorative text.
When OCR returns partial matches (e.g., "Kentucky Straight" instead of "Kentucky Straight
Bourbon Whiskey"), the system uses substring matching to flag these for agent review rather
than rejecting them outright. This matches the real-world workflow where agents use judgment
for minor discrepancies.

**Future Enhancement**: A production deployment could add image pre-processing (deskew, contrast)
and/or a dedicated OCR/Vision service tuned for label layouts.

### Next steps if this were extended

- Tighten field extraction with layout-aware OCR or a lightweight vision model.
- Add direct import of COLA application data instead of manual entry/JSON.
- Record review outcomes (accepted/rejected) to continuously improve the heuristics or train downstream models.
- Add accessibility refinements and keyboard-only workflows for faster agent use.

