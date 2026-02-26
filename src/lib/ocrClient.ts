import type { ExtractedLabelData } from "@/lib/labelComparison";

export function extractFromOcrText(text: string): ExtractedLabelData {
  const cleanText = text
    .replace(/\|/g, " ")
    .replace(/[—–_]{2,}/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const singleLine = text
    .replace(/[\r\n|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const allCaps = text.toUpperCase();

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\|/g, " ").trim())
    .filter(
      (l) =>
        l.length > 2 &&
        !/^[:\-—_\s|]+$/.test(l) &&
        !/(government|warning|surgeon|pregnancy|according)/i.test(l),
    );

  const brandLines = lines
    .slice(0, 3)
    .filter(
      (l) =>
        !/(whiskey|bourbon|vodka|gin|rum|tequila|ipa|lager|wine|proof|alc|vol|ml|oz)/i.test(
          l,
        ),
    );

  const brandName =
    brandLines
      .slice(0, 2)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim() || undefined;

  const typeKeywords = [
    "Kentucky Straight Bourbon Whiskey",
    "Straight Bourbon Whiskey",
    "Bourbon Whiskey",
    "Kentucky Bourbon",
    "Rye Whiskey",
    "Tennessee Whiskey",
    "Single Malt",
    "Blended Whiskey",
    "Scotch Whisky",
    "Irish Whiskey",
    "Whiskey",
    "Whisky",
    "Vodka",
    "Gin",
    "Rum",
    "Tequila",
    "Mezcal",
    "India Pale Ale",
    "IPA",
    "Pale Ale",
    "Amber Ale",
    "Lager",
    "Pilsner",
    "Stout",
    "Porter",
    "Red Wine",
    "White Wine",
    "Rosé Wine",
    "Cabernet Sauvignon",
    "Merlot",
    "Pinot Noir",
    "Chardonnay",
    "Sauvignon Blanc",
    "Wine",
    "Beer",
    "Ale",
  ];

  let classType: string | undefined;

  for (const keyword of typeKeywords) {
    const regex = new RegExp(keyword.replace(/\s+/g, "\\s*"), "i");
    if (regex.test(singleLine)) {
      classType = keyword;
      break;
    }
  }

  if (!classType) {
    const typeWords = [
      "kentucky",
      "straight",
      "bourbon",
      "whiskey",
      "vodka",
      "gin",
      "rum",
      "ipa",
      "lager",
      "stout",
      "wine",
    ];
    const foundWords = typeWords.filter((word) =>
      new RegExp(word, "i").test(singleLine),
    );
    if (foundWords.length > 0) {
      classType = foundWords
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
    }
  }

  let alcoholContent: string | undefined;

  const proofMatch = singleLine.match(/(\d{2,3})\s*Proof/i);
  if (proofMatch) {
    const proof = parseInt(proofMatch[1], 10);
    const abv = (proof / 2).toFixed(1).replace(".0", "");
    alcoholContent = `${abv}% Alc./Vol. (${proof} Proof)`;
  } else {
    let percentText = singleLine;
    percentText = percentText.replace(/BE\s*(\d)/gi, "4$1");
    percentText = percentText.replace(/B5/gi, "85");
    percentText = percentText.replace(/4S/gi, "45");
    percentText = percentText.replace(/O(?=\d)/gi, "0");

    const percentMatch = percentText.match(/(\d{1,2}(?:\.\d)?)\s*%/);
    if (percentMatch) {
      alcoholContent = `${percentMatch[1]}% Alc./Vol.`;
    }
  }

  const netMatch = singleLine.match(
    /(\d+(?:\.\d+)?)\s*(mL|ML|ml|L|l|FL\s*OZ|fl\.?\s*oz|OZ|oz)/i,
  );
  const netContents = netMatch
    ? `${netMatch[1]} ${netMatch[2]}`
    : undefined;

  const warningIndex = allCaps.indexOf("GOVERNMENT WARNING");
  const warningText =
    warningIndex >= 0
      ? text
          .slice(warningIndex, warningIndex + 400)
          .replace(/\s+/g, " ")
          .trim()
      : undefined;

  return {
    brandName,
    classType,
    alcoholContent,
    netContents,
    governmentWarningText: warningText,
  };
}

export async function ocrImage(
  file: File,
): Promise<{ text: string; extracted?: ExtractedLabelData }> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  const res = await fetch("/api/ocr", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageBase64: base64, mimeType: file.type }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || res.statusText);
  }
  const data = await res.json();
  const text = data.text ?? "";
  const extractedFromApi = data.extracted as ExtractedLabelData | undefined;

  if (extractedFromApi) {
    return { text, extracted: extractedFromApi };
  }

  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    const strip = (s: string) => s.replace(/\s+/g, " ").trim();

    const extracted: ExtractedLabelData = {
      brandName: typeof parsed.brandName === "string" ? strip(parsed.brandName) : undefined,
      classType: typeof parsed.classType === "string" ? strip(parsed.classType) : undefined,
      alcoholContent:
        typeof parsed.alcoholContent === "string" ? strip(parsed.alcoholContent) : undefined,
      netContents: typeof parsed.netContents === "string" ? strip(parsed.netContents) : undefined,
      bottlerNameAddress:
        typeof parsed.bottlerNameAddress === "string"
          ? strip(parsed.bottlerNameAddress)
          : undefined,
      countryOfOrigin:
        typeof parsed.countryOfOrigin === "string"
          ? strip(parsed.countryOfOrigin)
          : undefined,
      governmentWarningText:
        typeof parsed.governmentWarningText === "string"
          ? strip(parsed.governmentWarningText)
          : undefined,
      governmentWarningHeaderIsAllCaps: parsed.governmentWarningHeaderIsAllCaps === true,
      governmentWarningHeaderIsBold: parsed.governmentWarningHeaderIsBold === true,
    };

    return { text, extracted };
  } catch {
    // no-op
  }
  return {
    text,
  };
}
