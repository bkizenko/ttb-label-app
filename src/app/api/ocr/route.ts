import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
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

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  try {
    const result = await model.generateContent([
      { inlineData: { data: imageBase64, mimeType } },
      "Extract all visible text from this alcohol label exactly as it appears. Return only the raw text, no commentary.",
    ]);
    const text = result.response.text();
    return NextResponse.json({ text: text ?? "" });
  } catch (e) {
    const message = e instanceof Error ? e.message : "OCR request failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
