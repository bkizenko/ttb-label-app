import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";
import type { ExtractedLabelData } from "@/lib/labelComparison";

const OCR_PROMPT = `Analyze this alcohol label image and extract structured fields.

Return ONLY valid JSON (no markdown fences, no commentary). If a field is not visible on the label, set it to null.

Schema:
{
  "brandName": "string or null",
  "classType": "string or null",
  "alcoholContent": "string or null",
  "netContents": "string or null",
  "bottlerNameAddress": "string or null",
  "countryOfOrigin": "string or null",
  "governmentWarningText": "string or null",
  "governmentWarningHeaderIsAllCaps": true or false,
  "governmentWarningHeaderIsBold": true or false
}

Rules:
- Preserve the label's wording exactly for governmentWarningText.
- brandName should be the complete brand name exactly as printed (include all words).
- If a field is not visible on the label, set it to null.
- governmentWarningHeaderIsAllCaps: true if the header reads "GOVERNMENT WARNING" in all capital letters, false if it uses title case or lowercase.
- governmentWarningHeaderIsBold: true if the "GOVERNMENT WARNING" header appears visually bolder/heavier than the surrounding warning body text.
- If government warning is not visible, set governmentWarningText to null and both booleans to false.`;

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const t0 = Date.now();
  // #region agent log
  console.log("[DBG-ROUTE] handler entered", { hasKey: !!process.env.GEMINI_API_KEY, t0 });
  // #endregion
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    // #region agent log
    console.error("[DBG-ROUTE] GEMINI_API_KEY missing!");
    // #endregion
    return NextResponse.json(
      { error: "GEMINI_API_KEY is not configured" },
      { status: 500 },
    );
  }

  let imageBase64: string;
  let mimeType: string;
  try {
    const body = await req.json();
    imageBase64 = body.imageBase64;
    mimeType = body.mimeType || "image/png";
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body: imageBase64 and mimeType required" },
      { status: 400 },
    );
  }
  const tAfterBody = Date.now();
  console.log("[OCR] body parsed", tAfterBody - t0, "ms");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: { temperature: 0 },
  });

  const MAX_RETRIES = 3;
  const apiStart = Date.now();
  let rawText: string;
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const result = await model.generateContent([
        { inlineData: { data: imageBase64, mimeType } },
        OCR_PROMPT,
      ]);
      rawText = result.response.text() ?? "";
      console.log("[OCR] Gemini API", Date.now() - apiStart, "ms", attempt > 0 ? `(retry ${attempt})` : "");
      lastError = null;
      break;
    } catch (error) {
      lastError = error;
      const msg = error instanceof Error ? error.message : String(error);
      const isRateLimit = msg.includes("429") || msg.toLowerCase().includes("rate") || msg.toLowerCase().includes("quota");
      if (isRateLimit && attempt < MAX_RETRIES - 1) {
        const backoffMs = 1000 * Math.pow(2, attempt);
        console.log(`[OCR] Rate limited, retrying in ${backoffMs}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
        await new Promise((r) => setTimeout(r, backoffMs));
        continue;
      }
      console.error("[OCR] Full error:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
    }
  }
  if (lastError || !rawText!) {
    const message = lastError instanceof Error ? lastError.message : String(lastError ?? "OCR failed");
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const parseStart = Date.now();
  let extracted: ExtractedLabelData | undefined;
  try {
    const trimmed = rawText.replace(/^[\s\S]*?\{/, "{").replace(/\}[\s\S]*$/, "}");
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;

    const stripNewlines = (s: string) => s.replace(/\s+/g, " ").trim();

    const govWarning =
      typeof parsed.governmentWarningText === "string"
        ? stripNewlines(parsed.governmentWarningText)
        : undefined;
    const bottlerNameAddress =
      typeof parsed.bottlerNameAddress === "string"
        ? stripNewlines(parsed.bottlerNameAddress)
        : undefined;
    const countryOfOrigin =
      typeof parsed.countryOfOrigin === "string"
        ? stripNewlines(parsed.countryOfOrigin)
        : undefined;

    extracted = {
      brandName:
        typeof parsed.brandName === "string"
          ? stripNewlines(parsed.brandName)
          : undefined,
      classType:
        typeof parsed.classType === "string"
          ? stripNewlines(parsed.classType)
          : undefined,
      alcoholContent:
        typeof parsed.alcoholContent === "string"
          ? stripNewlines(parsed.alcoholContent)
          : undefined,
      netContents:
        typeof parsed.netContents === "string"
          ? stripNewlines(parsed.netContents)
          : undefined,
      bottlerNameAddress,
      countryOfOrigin,
      governmentWarningText: govWarning,
      governmentWarningHeaderIsAllCaps: parsed.governmentWarningHeaderIsAllCaps === true,
      governmentWarningHeaderIsBold: parsed.governmentWarningHeaderIsBold === true,
    };
  } catch {
    console.log("[OCR] JSON parse failed, returning raw text only");
  }

  const tEnd = Date.now();
  console.log("[OCR] response parse", tEnd - parseStart, "ms");
  console.log("[OCR] total", tEnd - t0, "ms");
  // #region agent log
  console.log("[DBG-ROUTE] returning success", { totalMs: tEnd - t0 });
  // #endregion
  return NextResponse.json({
    text: rawText,
    ...(extracted && { extracted }),
  });
}
