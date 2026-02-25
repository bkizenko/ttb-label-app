export type ApplicationLabelData = {
  brandName: string;
  classType: string;
  alcoholContent: string;
  netContents: string;
  bottlerNameAddress: string;
  countryOfOrigin: string;
  governmentWarning: string;
};

export type ExtractedLabelData = {
  brandName?: string;
  classType?: string;
  alcoholContent?: string;
  netContents?: string;
  bottlerNameAddress?: string;
  countryOfOrigin?: string;
  governmentWarningText?: string;
  governmentWarningHeaderIsAllCaps?: boolean;
  governmentWarningHeaderIsBold?: boolean;
};

export type FieldCheckStatus = "match" | "mismatch" | "missing";

export type FieldCheck = {
  field:
    | keyof ApplicationLabelData
    | "alcoholContentFormat";
  status: FieldCheckStatus;
  expected?: string;
  actual?: string;
  notes?: string;
  noteHref?: string;
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

function isSubstringMatch(
  expected: string,
  actual: string,
): { match: boolean; pct: number } {
  const normExp = normalizeForComparison(expected);
  const normAct = normalizeForComparison(actual);
  if (!normExp || !normAct) return { match: false, pct: 0 };

  const expWords = normExp.split(" ");
  const actWords = normAct.split(" ");
  const matchedWords = actWords.filter((w) => expWords.includes(w));
  const pct = Math.round((matchedWords.length / expWords.length) * 100);

  const isPrefix =
    normExp.startsWith(normAct) || normAct.startsWith(normExp);

  return { match: isPrefix || pct >= 40, pct };
}

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

  // Brand name: fuzzy only
  {
    const expectedRaw = application.brandName;
    const actualRaw = extracted.brandName;
    const expected =
      typeof expectedRaw === "string" ? normalizeWhitespace(expectedRaw) : "";
    const actual =
      typeof actualRaw === "string" ? normalizeWhitespace(actualRaw) : "";

    if (!actualRaw || actual === "") {
      checks.push({
        field: "brandName",
        status: "missing",
        expected: expectedRaw,
        notes: "Not clearly found on label",
      });
    } else {
      pushFuzzyCheck(checks, "brandName", expected, actual, 85);
    }
  }

  // Class/type: fuzzy + substring/prefix fallback for partial OCR reads
  {
    const expectedRaw = application.classType;
    const actualRaw = extracted.classType;
    const expected =
      typeof expectedRaw === "string" ? normalizeWhitespace(expectedRaw) : "";
    const actual =
      typeof actualRaw === "string" ? normalizeWhitespace(actualRaw) : "";

    if (!actualRaw || actual === "") {
      checks.push({
        field: "classType",
        status: "missing",
        expected: expectedRaw,
        notes: "Not clearly found on label",
      });
    } else {
      const similarity = similarityScore(expected, actual);
      if (similarity >= 85) {
        checks.push({
          field: "classType",
          status: "match",
          expected,
          actual,
          notes:
            similarity === 100
              ? undefined
              : `${similarity}% match - minor formatting difference. Use your judgment.`,
        });
      } else {
        const sub = isSubstringMatch(expected, actual);
        if (sub.match) {
          checks.push({
            field: "classType",
            status: "match",
            expected,
            actual,
            notes: `Partial OCR read (${sub.pct}% of words matched). Use your judgment.`,
          });
        } else {
          pushFuzzyCheck(checks, "classType", expected, actual, 85);
        }
      }
    }
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

  // ABV abbreviation: TTB prohibits "ABV" as a standalone abbreviation
  if (
    /\bABV\b/i.test(application.alcoholContent) ||
    /\bABV\b/i.test(extracted.alcoholContent ?? "")
  ) {
    checks.push({
      field: "alcoholContentFormat",
      status: "mismatch",
      expected: "Alc. by Vol. (or similar)",
      actual: "Contains 'ABV'",
      notes:
        "TTB prohibits 'ABV' as a standalone abbreviation. Labels must use 'Alc. by Vol.', 'Alcohol X% by volume', or similar.",
      noteHref: "https://www.ttb.gov/regulated-commodities/beverage-alcohol/distilled-spirits/labeling",
    });
  }

  // Bottler/producer name + address: fuzzy — skip if form field is blank
  if (application.bottlerNameAddress?.trim()) {
    const expectedRaw = application.bottlerNameAddress;
    const actualRaw = extracted.bottlerNameAddress;
    const expected = normalizeWhitespace(expectedRaw);
    const actual =
      typeof actualRaw === "string" ? normalizeWhitespace(actualRaw) : "";

    if (!actualRaw || actual === "") {
      checks.push({
        field: "bottlerNameAddress",
        status: "missing",
        expected: expectedRaw,
        notes: "Not clearly found on label",
      });
    } else {
      pushFuzzyCheck(checks, "bottlerNameAddress", expected, actual, 80);
    }
  }

  // Country of origin (imports): fuzzy — skip if form field is blank
  if (application.countryOfOrigin?.trim()) {
    const expectedRaw = application.countryOfOrigin;
    const actualRaw = extracted.countryOfOrigin;
    const expected = normalizeWhitespace(expectedRaw);
    const actual =
      typeof actualRaw === "string" ? normalizeWhitespace(actualRaw) : "";

    if (!actualRaw || actual === "") {
      checks.push({
        field: "countryOfOrigin",
        status: "missing",
        expected: expectedRaw,
        notes: "Not clearly found on label",
      });
    } else {
      pushFuzzyCheck(checks, "countryOfOrigin", expected, actual, 90);
    }
  }

  // Government warning: unified check covering text, all-caps header, and bold header.
  const expectedWarning = normalizeWhitespace(application.governmentWarning);
  const actualWarning = extracted.governmentWarningText
    ? normalizeWhitespace(extracted.governmentWarningText)
    : undefined;

  if (!actualWarning) {
    checks.push({
      field: "governmentWarning",
      status: "missing",
      expected: expectedWarning,
      notes:
        "Government warning not detected on this image. Per 27 CFR § 16.21, all alcohol labels must display the complete warning statement with 'GOVERNMENT WARNING:' in all caps and bold.",
      noteHref: "https://www.ecfr.gov/current/title-27/chapter-I/subchapter-A/part-16",
    });
  } else {
    const expectedNormalized = normalizeForLooseMatch(expectedWarning);
    const actualNormalized = normalizeForLooseMatch(actualWarning);
    const textMatches = expectedNormalized === actualNormalized;
    const capsOk = extracted.governmentWarningHeaderIsAllCaps !== false;
    const boldOk = extracted.governmentWarningHeaderIsBold !== false;

    const issues: string[] = [];
    if (!textMatches) issues.push("Warning text does not match word-for-word");
    if (!capsOk) issues.push("'GOVERNMENT WARNING' header is not in all caps");
    if (!boldOk) issues.push("'GOVERNMENT WARNING' header is not bold");

    const allGood = textMatches && capsOk && boldOk;

    checks.push({
      field: "governmentWarning",
      status: allGood ? "match" : "mismatch",
      expected: expectedWarning,
      actual: actualWarning,
      notes: allGood
        ? undefined
        : issues.join(". ") + ". Per 27 CFR § 16.21.",
      noteHref: allGood
        ? undefined
        : "https://www.ecfr.gov/current/title-27/chapter-I/subchapter-A/part-16",
    });
  }

  return checks;
};

export const STANDARD_GOVERNMENT_WARNING = `GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.`;
