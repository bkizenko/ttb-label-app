# TTB Label Verification (Prototype)

This app helps you compare alcohol label images with application (COLA) data. You upload a photo of a label, enter the expected information, and the app checks whether they match.

---

## How to run it on your computer

You don’t need to be a developer; follow these steps in order.

### 1. Install Node.js

- Go to [https://nodejs.org](https://nodejs.org) and download the **LTS** version.
- Run the installer and finish the setup.

### 2. Get a Google AI (Gemini) API key

- Go to [Google AI Studio](https://aistudio.google.com/apikey).
- Sign in, then create an API key.
- Copy the key and keep it somewhere safe (you’ll paste it in the next step).

### 3. Open the project folder in Terminal (Mac) or Command Prompt (Windows)

- On Mac: open **Terminal**, then type `cd` followed by a space, drag the project folder onto the Terminal window, and press Enter.
- On Windows: open **Command Prompt**, type `cd` followed by a space, then the path to the project folder (e.g. `cd C:\Users\YourName\ttb-label-app`), and press Enter.

### 4. Create your environment file

- In the project folder, find the file **`.env.example`**.
- Duplicate it and rename the copy to **`.env.local`**.
- Open **`.env.local`** in a text editor and set your API key:

  ```
  GEMINI_API_KEY=paste-your-key-here
  ```

- Save the file.

### 5. Install dependencies and start the app

In the same Terminal/Command Prompt window, run:

```bash
npm install
npm run dev
```

When you see “Ready” or a local URL, open your browser and go to:

**http://localhost:3000**

You should see the TTB Label Verification app. Use **“Not sure where to start?”** to try a sample label with pre-filled data.

---

## Test and demo images

The repo includes additional test/demo images used by the **“Not sure where to start?”** flow. They are in **`public/demo/`**:

- **`public/demo/wine images/`** — Wine (DAOU) labels (JPG, HEIC)
- **`public/demo/stone's throw/`** — Stone’s Throw IPA (PNG, JPG)
- **`public/demo/vodka images/`** — Absolut vodka (HEIC, JPG)
- **`public/demo/old tom distillery test images/`** — Old Tom bourbon (PNG, JPG)

Demo presets in `src/data/presets.ts` reference a subset of these. To list all files:  
`find public/demo -type f \( -name "*.jpg" -o -name "*.png" -o -name "*.HEIC" \)`

---

## Image formats

- The app **accepts PNG, JPEG, and WebP**.
- **HEIC** (common on iPhones) can be detected and may work, but **we recommend converting HEIC to PNG or JPEG first** for more reliable results. You can use a free converter such as [CloudConvert](https://cloudconvert.com/heic-to-png) or your device’s export option.

---

## Limitations

- **No persistence** — Prototype only; nothing is saved server-side. Data stays in your browser for the session.
- **No COLA integration** — Standalone proof-of-concept as specified; not wired to the TTB COLA system.
- **Cold start** — During development we saw occasional timeouts on the first request after deploy (serverless cold start); retrying worked. This is no longer an issue in normal use.
- **HEIC preview** — HEIC images cannot be rendered in this app (the image preview will not load in the browser). If extraction still runs, it may work in some environments (e.g. when the browser or API can decode HEIC); we recommend converting HEIC to PNG or JPEG for reliable preview and OCR.

---

## Trade-offs

- **More explanatory text** — We added notes, hints, and field-level guidance (e.g. match percentages, TTB references) to support reviewers. That extra text may make the interface denser and slightly harder for less tech-savvy users; accommodating those users was a guiding principle of the project, so we kept the flow simple and the copy as plain as we could while still being accurate.

---

## Tech stack (for developers)

- Next.js 16, React, TypeScript, Tailwind CSS
- Google Gemini 2.5 Flash for OCR (server route)
- Deployed at [https://ttb-label-app.vercel.app](https://ttb-label-app.vercel.app)

### Deploying to Vercel

Vercel does **not** use `.env.local`. To avoid 500 errors on `/api/ocr`, add the Gemini API key in the Vercel dashboard:

1. Open your project on [vercel.com](https://vercel.com) → **Settings** → **Environment Variables**.
2. Add **`GEMINI_API_KEY`** with your key (same value as in `.env.local`).
3. Select **Production** (and **Preview** if you use preview deployments), then Save.
4. **Redeploy** the project (Deployments → ⋮ on the latest → Redeploy) so the new variable is applied.
