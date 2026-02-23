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

export const compareLabelData = (
  application: ApplicationLabelData,
  extracted: ExtractedLabelData,
): FieldCheck[] => {
  const checks: FieldCheck[] = [];

  const compareField = (
    field: keyof ApplicationLabelData,
    opts?: { loose?: boolean },
  ) => {
    const expectedRaw = application[field];
    const actualRaw = extracted[field];

    if (!actualRaw) {
      checks.push({
        field,
        status: "missing",
        expected: expectedRaw,
        notes: "Not clearly found on label",
      });
      return;
    }

    const expected = normalizeWhitespace(expectedRaw);
    const actual = normalizeWhitespace(actualRaw);

    const isMatch = opts?.loose
      ? normalizeForLooseMatch(expected) === normalizeForLooseMatch(actual)
      : expected === actual;

    checks.push({
      field,
      status: isMatch ? "match" : "mismatch",
      expected,
      actual,
      notes: !isMatch ? "Review with human judgment" : undefined,
    });
  };

  compareField("brandName", { loose: true });
  compareField("classType", { loose: true });
  compareField("alcoholContent");
  compareField("netContents");

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

