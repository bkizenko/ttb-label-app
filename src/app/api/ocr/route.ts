import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import type { ExtractedLabelData } from "@/lib/labelComparison";

const OCR_PROMPT = `Read every piece of text on this alcohol bottle label carefully and completely. Return ONLY a JSON object with these fields: brandName (the full brand name exactly as printed, including all words), classType, alcoholContent, netContents, governmentWarning (the complete warning text word-for-word, note if GOVERNMENT WARNING header is bold and/or all caps), producerName, countryOfOrigin. Also include governmentWarningHeaderIsBold (true if the header appears bold on the label) and governmentWarningHeaderIsAllCaps (true if the header is in all capitals). If a field is not found, use empty string. No markdown or commentary.`;

export async function POST(req: NextRequest) {
  const t0 = Date.now();
  console.log("[OCR] route hit", t0);

  const apiKey = process.env.GEMINI_API_KEY;
  console.log("[OCR] API key present:", !!apiKey);

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

  const ONE_MB = 1024 * 1024;
  const MAX_LONGEST_SIDE = 1280; // cap for speed (~5s target)
  const MIN_LONGEST_SIDE = 1024; // below this OCR often fails
  let payloadBase64 = imageBase64;
  let payloadMimeType = mimeType;
  const tResizeStart = Date.now();
  try {
    const inputBuffer = Buffer.from(imageBase64, "base64");
    const pipeline = sharp(inputBuffer);
    const meta = await pipeline.metadata();
    const w = meta.width ?? 0;
    const h = meta.height ?? 0;
    const longest = Math.max(w, h);

    if (inputBuffer.length > ONE_MB) {
      const resizedBuffer = await sharp(inputBuffer)
        .resize(MAX_LONGEST_SIDE, MAX_LONGEST_SIDE, {
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({ quality: 90 })
        .toBuffer();
      payloadBase64 = resizedBuffer.toString("base64");
      payloadMimeType = "image/jpeg";
    } else if (longest < MIN_LONGEST_SIDE && longest > 0) {
      const resizedBuffer = await sharp(inputBuffer)
        .resize(MIN_LONGEST_SIDE, MIN_LONGEST_SIDE, {
          fit: "inside",
          withoutEnlargement: false,
        })
        .jpeg({ quality: 90 })
        .toBuffer();
      payloadBase64 = resizedBuffer.toString("base64");
      payloadMimeType = "image/jpeg";
    }
  } catch (e) {
    console.warn("[OCR] resize failed, using original image", e);
  }
  const tAfterResize = Date.now();
  console.log("[OCR] pre-processing (resize)", tAfterResize - tResizeStart, "ms");
  console.log("[OCR] pre-processing total (parse + resize)", tAfterResize - t0, "ms");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const apiStart = Date.now();
  let rawText: string;
  try {
    const result = await model.generateContent([
      { inlineData: { data: payloadBase64, mimeType: payloadMimeType } },
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
      typeof parsed.governmentWarning === "string"
        ? stripNewlines(parsed.governmentWarning)
        : undefined;
    const headerBold = parsed.governmentWarningHeaderIsBold === true;
    const headerAllCaps = parsed.governmentWarningHeaderIsAllCaps === true;
    const hasGovernmentWarningHeaderExact = headerBold && headerAllCaps;

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
      governmentWarningText: govWarning,
      hasGovernmentWarningHeaderExact,
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
