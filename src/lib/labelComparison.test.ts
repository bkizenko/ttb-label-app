import { describe, it, expect } from "vitest";
import {
  normalizeForComparison,
  similarityScore,
  compareLabelData,
  STANDARD_GOVERNMENT_WARNING,
  type ApplicationLabelData,
  type ExtractedLabelData,
} from "./labelComparison";

describe("normalizeForComparison", () => {
  it("returns empty string for undefined", () => {
    expect(normalizeForComparison(undefined)).toBe("");
  });

  it("returns empty string for empty string", () => {
    expect(normalizeForComparison("")).toBe("");
  });

  it("lowercases and removes punctuation", () => {
    expect(normalizeForComparison("STONE'S THROW")).toBe("stones throw");
  });

  it("collapses and trims whitespace", () => {
    expect(normalizeForComparison("  750   mL  ")).toBe("750 ml");
  });

  it("strips punctuation only, keeps letters and digits", () => {
    // . and / removed so "Alc./Vol." → "alcvol"
    expect(normalizeForComparison("45% Alc./Vol. (90 Proof)")).toBe(
      "45 alcvol 90 proof",
    );
  });
});

describe("similarityScore", () => {
  it("returns 100 for identical normalized strings", () => {
    expect(similarityScore("STONE'S THROW", "Stone's Throw")).toBe(100);
    // "750 mL" vs "750mL" differ by one space after normalization so ~83%
    expect(similarityScore("750 mL", "750 mL")).toBe(100);
  });

  it("returns 100 for exact same string", () => {
    expect(similarityScore("Jack Daniels", "Jack Daniels")).toBe(100);
  });

  it("returns high score for minor formatting differences", () => {
    const score = similarityScore(
      "45% Alc./Vol. (90 Proof)",
      "45 % Alc/Vol (90 Proof)",
    );
    expect(score).toBeGreaterThanOrEqual(85);
  });

  it("returns low score for different brands", () => {
    const score = similarityScore("Jack Daniels", "Jim Beam");
    expect(score).toBeLessThan(70);
  });

  it("returns low score for different alcohol content", () => {
    const score = similarityScore("45% Alc./Vol.", "40% Alc./Vol.");
    expect(score).toBeLessThan(100);
  });
});

const baseApplication: ApplicationLabelData = {
  brandName: "Stone's Throw",
  classType: "Bourbon Whiskey",
  alcoholContent: "45% Alc./Vol. (90 Proof)",
  netContents: "750 mL",
  bottlerNameAddress: "Bottled by Stone's Throw Distillery, Louisville, KY",
  countryOfOrigin: "United States",
  governmentWarning: STANDARD_GOVERNMENT_WARNING,
};

describe("compareLabelData", () => {
  it("reports match when brand differs only by casing/punctuation (STONE'S THROW vs Stone's Throw)", () => {
    const extracted: ExtractedLabelData = {
      brandName: "STONE'S THROW",
      classType: "Bourbon Whiskey",
      alcoholContent: "45% Alc./Vol. (90 Proof)",
      netContents: "750 mL",
      bottlerNameAddress: baseApplication.bottlerNameAddress,
      countryOfOrigin: baseApplication.countryOfOrigin,
      governmentWarningText: STANDARD_GOVERNMENT_WARNING,
    };
    const checks = compareLabelData(baseApplication, extracted);
    const brandCheck = checks.find((c) => c.field === "brandName");
    expect(brandCheck?.status).toBe("match");
    expect(brandCheck?.expected).toBe("Stone's Throw");
    expect(brandCheck?.actual).toBe("STONE'S THROW");
  });

  it("reports match for net contents with minor spacing (e.g. 750 mL vs 750 mL)", () => {
    const extracted: ExtractedLabelData = {
      brandName: "Stone's Throw",
      classType: "Bourbon Whiskey",
      alcoholContent: "45% Alc./Vol. (90 Proof)",
      netContents: "750 mL",
      bottlerNameAddress: baseApplication.bottlerNameAddress,
      countryOfOrigin: baseApplication.countryOfOrigin,
      governmentWarningText: STANDARD_GOVERNMENT_WARNING,
    };
    const checks = compareLabelData(baseApplication, extracted);
    const netCheck = checks.find((c) => c.field === "netContents");
    expect(netCheck?.status).toBe("match");
  });

  it("750 mL vs 750mL should match (numeric normalization)", () => {
    const extracted: ExtractedLabelData = {
      brandName: baseApplication.brandName,
      classType: baseApplication.classType,
      alcoholContent: baseApplication.alcoholContent,
      netContents: "750mL",
      bottlerNameAddress: baseApplication.bottlerNameAddress,
      countryOfOrigin: baseApplication.countryOfOrigin,
      governmentWarningText: STANDARD_GOVERNMENT_WARNING,
    };
    const checks = compareLabelData(baseApplication, extracted);
    expect(checks.find((c) => c.field === "netContents")?.status).toBe("match");
  });

  it("45% Alc./Vol. vs 45 % Alc/Vol should match (numeric normalization)", () => {
    const app: ApplicationLabelData = {
      ...baseApplication,
      alcoholContent: "45% Alc./Vol. (90 Proof)",
    };
    const extracted: ExtractedLabelData = {
      brandName: baseApplication.brandName,
      classType: baseApplication.classType,
      alcoholContent: "45 % Alc/Vol (90 Proof)",
      netContents: baseApplication.netContents,
      bottlerNameAddress: baseApplication.bottlerNameAddress,
      countryOfOrigin: baseApplication.countryOfOrigin,
      governmentWarningText: STANDARD_GOVERNMENT_WARNING,
    };
    const checks = compareLabelData(app, extracted);
    expect(checks.find((c) => c.field === "alcoholContent")?.status).toBe(
      "match",
    );
  });

  it("750 mL vs 700 mL should mismatch (different numbers)", () => {
    const app: ApplicationLabelData = {
      ...baseApplication,
      netContents: "750 mL",
    };
    const extracted: ExtractedLabelData = {
      brandName: baseApplication.brandName,
      classType: baseApplication.classType,
      alcoholContent: baseApplication.alcoholContent,
      netContents: "700 mL",
      bottlerNameAddress: baseApplication.bottlerNameAddress,
      countryOfOrigin: baseApplication.countryOfOrigin,
      governmentWarningText: STANDARD_GOVERNMENT_WARNING,
    };
    const checks = compareLabelData(app, extracted);
    expect(checks.find((c) => c.field === "netContents")?.status).toBe(
      "mismatch",
    );
  });

  it("reports match for OLD TOM DISTILLERY vs Old Tom Distillery", () => {
    const app: ApplicationLabelData = {
      ...baseApplication,
      brandName: "Old Tom Distillery",
    };
    const extracted: ExtractedLabelData = {
      brandName: "OLD TOM DISTILLERY",
      classType: baseApplication.classType,
      alcoholContent: baseApplication.alcoholContent,
      netContents: baseApplication.netContents,
      bottlerNameAddress: baseApplication.bottlerNameAddress,
      countryOfOrigin: baseApplication.countryOfOrigin,
      governmentWarningText: STANDARD_GOVERNMENT_WARNING,
    };
    const checks = compareLabelData(app, extracted);
    const brandCheck = checks.find((c) => c.field === "brandName");
    expect(brandCheck?.status).toBe("match");
  });

  it("reports mismatch for Jack Daniels vs Jim Beam", () => {
    const app: ApplicationLabelData = {
      ...baseApplication,
      brandName: "Jack Daniels",
    };
    const extracted: ExtractedLabelData = {
      brandName: "Jim Beam",
      classType: baseApplication.classType,
      alcoholContent: baseApplication.alcoholContent,
      netContents: baseApplication.netContents,
      bottlerNameAddress: baseApplication.bottlerNameAddress,
      countryOfOrigin: baseApplication.countryOfOrigin,
      governmentWarningText: STANDARD_GOVERNMENT_WARNING,
    };
    const checks = compareLabelData(app, extracted);
    const brandCheck = checks.find((c) => c.field === "brandName");
    expect(brandCheck?.status).toBe("mismatch");
  });

  it("reports mismatch for different alcohol content (45% vs 40%)", () => {
    const extracted: ExtractedLabelData = {
      brandName: baseApplication.brandName,
      classType: baseApplication.classType,
      alcoholContent: "40% Alc./Vol.",
      netContents: baseApplication.netContents,
      bottlerNameAddress: baseApplication.bottlerNameAddress,
      countryOfOrigin: baseApplication.countryOfOrigin,
      governmentWarningText: STANDARD_GOVERNMENT_WARNING,
    };
    const checks = compareLabelData(baseApplication, extracted);
    const alcCheck = checks.find((c) => c.field === "alcoholContent");
    expect(alcCheck?.status).toBe("mismatch");
  });

  it("government warning: missing text → status missing", () => {
    const extracted: ExtractedLabelData = {
      brandName: baseApplication.brandName,
      classType: baseApplication.classType,
      alcoholContent: baseApplication.alcoholContent,
      netContents: baseApplication.netContents,
      bottlerNameAddress: baseApplication.bottlerNameAddress,
      countryOfOrigin: baseApplication.countryOfOrigin,
      // governmentWarningText omitted → missing
    };
    const checks = compareLabelData(baseApplication, extracted);
    const warningCheck = checks.find((c) => c.field === "governmentWarning");
    expect(warningCheck?.status).toBe("missing");
  });

  it("government warning: different text → status mismatch", () => {
    const wrongWarning =
      "Government Warning: (1) According to the Surgeon General...";
    const extracted: ExtractedLabelData = {
      brandName: baseApplication.brandName,
      classType: baseApplication.classType,
      alcoholContent: baseApplication.alcoholContent,
      netContents: baseApplication.netContents,
      bottlerNameAddress: baseApplication.bottlerNameAddress,
      countryOfOrigin: baseApplication.countryOfOrigin,
      governmentWarningText: wrongWarning,
    };
    const checks = compareLabelData(baseApplication, extracted);
    const warningCheck = checks.find((c) => c.field === "governmentWarning");
    expect(warningCheck?.status).toBe("mismatch");
  });

  it("government warning: exact match → status match", () => {
    const extracted: ExtractedLabelData = {
      brandName: baseApplication.brandName,
      classType: baseApplication.classType,
      alcoholContent: baseApplication.alcoholContent,
      netContents: baseApplication.netContents,
      bottlerNameAddress: baseApplication.bottlerNameAddress,
      countryOfOrigin: baseApplication.countryOfOrigin,
      governmentWarningText: STANDARD_GOVERNMENT_WARNING,
    };
    const checks = compareLabelData(baseApplication, extracted);
    const warningCheck = checks.find((c) => c.field === "governmentWarning");
    expect(warningCheck?.status).toBe("match");
  });

  it("reports missing when a field is not on the label", () => {
    const extracted: ExtractedLabelData = {
      brandName: baseApplication.brandName,
      classType: baseApplication.classType,
      alcoholContent: baseApplication.alcoholContent,
      // netContents omitted
      bottlerNameAddress: baseApplication.bottlerNameAddress,
      countryOfOrigin: baseApplication.countryOfOrigin,
      governmentWarningText: STANDARD_GOVERNMENT_WARNING,
    };
    const checks = compareLabelData(baseApplication, extracted);
    const netCheck = checks.find((c) => c.field === "netContents");
    expect(netCheck?.status).toBe("missing");
  });

  it("partial class/type match via substring", () => {
    const result = compareLabelData(
      {
        brandName: "Test",
        classType: "Kentucky Straight Bourbon Whiskey",
        alcoholContent: "45%",
        netContents: "750 mL",
        bottlerNameAddress: "",
        countryOfOrigin: "",
        governmentWarning: STANDARD_GOVERNMENT_WARNING,
      },
      {
        brandName: "Test",
        classType: "Kentucky Straight",
        alcoholContent: "45%",
        netContents: "750 mL",
        governmentWarningText: STANDARD_GOVERNMENT_WARNING,
      },
    );

    const classCheck = result.find((c) => c.field === "classType");
    expect(classCheck?.status).toBe("match");
    expect(classCheck?.notes).toContain("Partial OCR");
  });

  it("includes notes when match is high but not perfect (e.g. minor typo)", () => {
    const extracted: ExtractedLabelData = {
      brandName: "Stone's Thow", // typo: Thow vs Throw
      classType: baseApplication.classType,
      alcoholContent: baseApplication.alcoholContent,
      netContents: baseApplication.netContents,
      bottlerNameAddress: baseApplication.bottlerNameAddress,
      countryOfOrigin: baseApplication.countryOfOrigin,
      governmentWarningText: STANDARD_GOVERNMENT_WARNING,
    };
    const checks = compareLabelData(baseApplication, extracted);
    const brandCheck = checks.find((c) => c.field === "brandName");
    expect(brandCheck?.status).toBe("match");
    expect(brandCheck?.notes).toBeDefined();
    expect(brandCheck!.notes).toContain("% match");
  });

  it("compares bottler/producer name & address with fuzzy matching", () => {
    const extracted: ExtractedLabelData = {
      ...baseApplication,
      governmentWarningText: STANDARD_GOVERNMENT_WARNING,
      bottlerNameAddress: "Bottled by Stones Throw Distillery, Louisville KY",
    };

    const checks = compareLabelData(baseApplication, extracted);
    expect(checks.find((c) => c.field === "bottlerNameAddress")?.status).toBe(
      "match",
    );
  });

  it("compares country of origin with high threshold", () => {
    const extracted: ExtractedLabelData = {
      ...baseApplication,
      governmentWarningText: STANDARD_GOVERNMENT_WARNING,
      countryOfOrigin: "United States",
    };

    const checks = compareLabelData(baseApplication, extracted);
    expect(checks.find((c) => c.field === "countryOfOrigin")?.status).toBe(
      "match",
    );
  });

  it("skips bottlerNameAddress check when form field is blank", () => {
    const appWithBlankBottler: ApplicationLabelData = {
      ...baseApplication,
      bottlerNameAddress: "",
    };
    const extracted: ExtractedLabelData = {
      ...baseApplication,
      governmentWarningText: STANDARD_GOVERNMENT_WARNING,
    };
    const checks = compareLabelData(appWithBlankBottler, extracted);
    expect(checks.find((c) => c.field === "bottlerNameAddress")).toBeUndefined();
  });

  it("skips countryOfOrigin check when form field is blank", () => {
    const appWithBlankCountry: ApplicationLabelData = {
      ...baseApplication,
      countryOfOrigin: "",
    };
    const extracted: ExtractedLabelData = {
      ...baseApplication,
      governmentWarningText: STANDARD_GOVERNMENT_WARNING,
    };
    const checks = compareLabelData(appWithBlankCountry, extracted);
    expect(checks.find((c) => c.field === "countryOfOrigin")).toBeUndefined();
  });

  it("rejects title-case 'Government Warning' header as not all-caps", () => {
    const extracted: ExtractedLabelData = {
      ...baseApplication,
      governmentWarningText: STANDARD_GOVERNMENT_WARNING,
      governmentWarningHeaderIsAllCaps: false,
      governmentWarningHeaderIsBold: true,
    };
    const checks = compareLabelData(baseApplication, extracted);
    const warningCheck = checks.find((c) => c.field === "governmentWarning");
    expect(warningCheck?.status).toBe("mismatch");
    expect(warningCheck?.notes).toContain("not in all caps");
  });

  it("rejects non-bold government warning header", () => {
    const extracted: ExtractedLabelData = {
      ...baseApplication,
      governmentWarningText: STANDARD_GOVERNMENT_WARNING,
      governmentWarningHeaderIsAllCaps: true,
      governmentWarningHeaderIsBold: false,
    };
    const checks = compareLabelData(baseApplication, extracted);
    const warningCheck = checks.find((c) => c.field === "governmentWarning");
    expect(warningCheck?.status).toBe("mismatch");
    expect(warningCheck?.notes).toContain("not bold");
  });

  it("passes gov warning when text matches and header is all-caps and bold", () => {
    const extracted: ExtractedLabelData = {
      ...baseApplication,
      governmentWarningText: STANDARD_GOVERNMENT_WARNING,
      governmentWarningHeaderIsAllCaps: true,
      governmentWarningHeaderIsBold: true,
    };
    const checks = compareLabelData(baseApplication, extracted);
    const warningCheck = checks.find((c) => c.field === "governmentWarning");
    expect(warningCheck?.status).toBe("match");
  });
});
