export type ApplicationLabelData = {
  brandName: string;
  classType: string;
  alcoholContent: string;
  netContents: string;
  governmentWarning: string;
};

export type ExtractedLabelData = {
  brandName?: string;
  classType?: string;
  alcoholContent?: string;
  netContents?: string;
  governmentWarningText?: string;
  hasGovernmentWarningHeaderExact?: boolean;
};

export type FieldCheckStatus = "match" | "mismatch" | "missing";

export type FieldCheck = {
  field: keyof ApplicationLabelData | "governmentWarningHeader";
  status: FieldCheckStatus;
  expected?: string;
  actual?: string;
  notes?: string;
};

export function normalizeForComparison(text: string | undefined): string {
  if (!text) return "";

  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function similarityScore(str1: string, str2: string): number {
  const norm1 = normalizeForComparison(str1);
  const norm2 = normalizeForComparison(str2);

  if (norm1 === norm2) return 100;

  const matrix: number[][] = [];
  const len1 = norm1.length;
  const len2 = norm2.length;

  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = norm1[i - 1] === norm2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }

  const distance = matrix[len1][len2];
  const maxLen = Math.max(len1, len2);
  const similarity = ((maxLen - distance) / maxLen) * 100;

  return Math.round(similarity);
}

function normalizeNumeric(text: string | undefined): string {
  if (!text) return "";

  // Keep only digits so "750 mL" → "750", "45% Alc./Vol. (90 Proof)" → "4590"
  return text.toLowerCase().replace(/[^\d]/g, "").trim();
}

const normalizeForLooseMatch = (value: string) =>
  value
    .toUpperCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]/g, "");

const normalizeWhitespace = (value: string) =>
  value
    .replace(/\s+/g, " ")
    .trim();

function pushFuzzyCheck(
  checks: FieldCheck[],
  field: keyof ApplicationLabelData,
  expected: string,
  actual: string,
  matchThreshold: number,
): void {
  const similarity = similarityScore(expected, actual);

  if (similarity === 100) {
    checks.push({
      field,
      status: "match",
      expected,
      actual,
    });
  } else if (similarity >= matchThreshold) {
    checks.push({
      field,
      status: "match",
      expected,
      actual,
      notes: `${similarity}% match - minor formatting difference. Use your judgment.`,
    });
  } else if (similarity >= 70) {
    checks.push({
      field,
      status: "mismatch",
      expected,
      actual,
      notes: `${similarity}% match - please verify this is the same.`,
    });
  } else {
    checks.push({
      field,
      status: "mismatch",
      expected,
      actual,
      notes: `${similarity}% match - these appear to be different.`,
    });
  }
}

export const compareLabelData = (
  application: ApplicationLabelData,
  extracted: ExtractedLabelData,
): FieldCheck[] => {
  const checks: FieldCheck[] = [];

  // Brand and class: fuzzy only
  const textOnlyFields: {
    field: keyof ApplicationLabelData;
    key: keyof ExtractedLabelData;
    threshold: number;
  }[] = [
    { field: "brandName", key: "brandName", threshold: 85 },
    { field: "classType", key: "classType", threshold: 85 },
  ];

  for (const { field, key, threshold } of textOnlyFields) {
    const expectedRaw = application[field];
    const actualRaw = extracted[key as keyof ExtractedLabelData];
    const expected =
      typeof expectedRaw === "string" ? normalizeWhitespace(expectedRaw) : "";
    const actual =
      typeof actualRaw === "string"
        ? normalizeWhitespace(actualRaw)
        : "";

    if (!actualRaw || actual === "") {
      checks.push({
        field,
        status: "missing",
        expected: expectedRaw,
        notes: "Not clearly found on label",
      });
      continue;
    }

    pushFuzzyCheck(checks, field, expected, actual, threshold);
  }

  // Numeric fields: try numeric normalization first, then fuzzy fallback
  const numericFields: {
    field: "alcoholContent" | "netContents";
    key: "alcoholContent" | "netContents";
    threshold: number;
  }[] = [
    { field: "alcoholContent", key: "alcoholContent", threshold: 90 },
    { field: "netContents", key: "netContents", threshold: 90 },
  ];

  for (const { field, key, threshold } of numericFields) {
    const expectedRaw = application[field];
    const actualRaw = extracted[key];
    const expected =
      typeof expectedRaw === "string" ? normalizeWhitespace(expectedRaw) : "";
    const actual =
      typeof actualRaw === "string"
        ? normalizeWhitespace(actualRaw)
        : "";

    if (!actualRaw || actual === "") {
      checks.push({
        field,
        status: "missing",
        expected: expectedRaw,
        notes: "Not clearly found on label",
      });
      continue;
    }

    const normExpected = normalizeNumeric(expectedRaw);
    const normActual = normalizeNumeric(actualRaw);

    if (normExpected !== "" && normActual !== "" && normExpected === normActual) {
      checks.push({
        field,
        status: "match",
        expected: expectedRaw,
        actual: actualRaw,
      });
    } else {
      pushFuzzyCheck(checks, field, expected, actual, threshold);
    }
  }

  const expectedWarning = normalizeWhitespace(application.governmentWarning);
  const actualWarning = extracted.governmentWarningText
    ? normalizeWhitespace(extracted.governmentWarningText)
    : undefined;

  if (!actualWarning) {
    checks.push({
      field: "governmentWarning",
      status: "missing",
      expected: expectedWarning,
      notes: "Government warning text not clearly detected",
    });
  } else {
    const expectedNormalized = normalizeForLooseMatch(expectedWarning);
    const actualNormalized = normalizeForLooseMatch(actualWarning);

    const isMatch = expectedNormalized === actualNormalized;

    checks.push({
      field: "governmentWarning",
      status: isMatch ? "match" : "mismatch",
      expected: expectedWarning,
      actual: actualWarning,
      notes: !isMatch
        ? "Warning text must match word-for-word; agent should review."
        : undefined,
    });
  }

  checks.push({
    field: "governmentWarningHeader",
    status: extracted.hasGovernmentWarningHeaderExact ? "match" : "mismatch",
    expected: "GOVERNMENT WARNING:",
    actual: extracted.hasGovernmentWarningHeaderExact
      ? "GOVERNMENT WARNING:"
      : "Not found exactly as 'GOVERNMENT WARNING:'",
    notes:
      "Header must appear in all caps; bold styling cannot be detected from OCR.",
  });

  return checks;
};

export const STANDARD_GOVERNMENT_WARNING = `GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.`;

