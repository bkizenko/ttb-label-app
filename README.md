## AI-Powered Alcohol Label Verification (Prototype)

Web app that helps TTB label compliance agents compare label images with application (COLA) data. Fast, obvious verification of routine fields with human agents in control.

### Tech stack

- **Next.js 16** (App Router), **React**, **TypeScript**
- **Tailwind CSS** for UI
- **Google Gemini 2.5 Flash** for OCR (server-side API route)
- Deployable on **Vercel**, Azure, or any Node.js host

### Setup and run (local)

- **Prerequisites**: Node.js 18+, npm, and a Google AI Studio API key (`GEMINI_API_KEY`).
- Copy `.env.example` to `.env.local` and set `GEMINI_API_KEY`.
- Install and run:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Deployed app

**Live demo**: [https://ttb-label-app.vercel.app](https://ttb-label-app.vercel.app)

### Approach and assumptions

- OCR runs server-side via `/api/ocr` (Gemini Vision). Comparison and UI run in the browser.
- Text is normalized (case, spacing, punctuation) so obvious equivalents count as matches; government warning is checked word-for-word plus all-caps and bold for the header.
- Single-label and batch modes; application data can be entered in a form or pasted as JSON. Optional presets and a “Not sure where to start?” demo flow load sample data and run a verification.
- Prototype only: no persistence, no COLA integration; all data stays in memory.

### Known limitations

- **Image formats**: Accepted formats are **PNG, JPEG, and WebP**. For HEIC or other formats, convert first (e.g. [cloudconvert.com/png-converter](https://cloudconvert.com/png-converter)).
- **OCR accuracy**: Strong glare, skew, or very small text can reduce accuracy. Bold/formatting is inferred by the model; when it cannot verify bold/all-caps for the government warning, the app flags for manual review.
- **Performance**: Images are resized (long edge ≤ 1500 px) before OCR to keep processing time down; see `PERFORMANCE.md` for notes.

### Trade-offs

- Server-side OCR requires an API key and outbound access; no offline use.
- Heuristic comparison favors surfacing possible issues over strict auto-pass; some manual review is expected.
- No audit log or export to COLA; suitable for prototype/demo only.
