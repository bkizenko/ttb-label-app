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
  "governmentWarningText": "string or null"
}

Rules:
- Preserve the label's wording exactly for governmentWarningText.
- brandName should be the complete brand name exactly as printed (include all words).
- If a field is not visible on the label, set it to null.`;

export async function POST(req: NextRequest) {
  const t0 = Date.now();
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
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

  const apiStart = Date.now();
  let rawText: string;
  try {
    const result = await model.generateContent([
      { inlineData: { data: imageBase64, mimeType } },
      OCR_PROMPT,
    ]);
    rawText = result.response.text() ?? "";
    console.log("[OCR] Gemini API", Date.now() - apiStart, "ms");
  } catch (error) {
    console.error(
      "[OCR] Full error:",
      JSON.stringify(error, Object.getOwnPropertyNames(error)),
    );
    const message = error instanceof Error ? error.message : String(error);
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
    };
  } catch {
    console.log("[OCR] JSON parse failed, returning raw text only");
  }

  const tEnd = Date.now();
  console.log("[OCR] response parse", tEnd - parseStart, "ms");
  console.log("[OCR] total", tEnd - t0, "ms");
  return NextResponse.json({
    text: rawText,
    ...(extracted && { extracted }),
  });
}
