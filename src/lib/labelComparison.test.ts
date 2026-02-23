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
  governmentWarning: STANDARD_GOVERNMENT_WARNING,
};

describe("compareLabelData", () => {
  it("reports match when brand differs only by casing/punctuation (STONE'S THROW vs Stone's Throw)", () => {
    const extracted: ExtractedLabelData = {
      brandName: "STONE'S THROW",
      classType: "Bourbon Whiskey",
      alcoholContent: "45% Alc./Vol. (90 Proof)",
      netContents: "750 mL",
      governmentWarningText: STANDARD_GOVERNMENT_WARNING,
      hasGovernmentWarningHeaderExact: true,
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
      governmentWarningText: STANDARD_GOVERNMENT_WARNING,
      hasGovernmentWarningHeaderExact: true,
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
      governmentWarningText: STANDARD_GOVERNMENT_WARNING,
      hasGovernmentWarningHeaderExact: true,
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
      governmentWarningText: STANDARD_GOVERNMENT_WARNING,
      hasGovernmentWarningHeaderExact: true,
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
      governmentWarningText: STANDARD_GOVERNMENT_WARNING,
      hasGovernmentWarningHeaderExact: true,
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
      governmentWarningText: STANDARD_GOVERNMENT_WARNING,
      hasGovernmentWarningHeaderExact: true,
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
      governmentWarningText: STANDARD_GOVERNMENT_WARNING,
      hasGovernmentWarningHeaderExact: true,
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
      governmentWarningText: STANDARD_GOVERNMENT_WARNING,
      hasGovernmentWarningHeaderExact: true,
    };
    const checks = compareLabelData(baseApplication, extracted);
    const alcCheck = checks.find((c) => c.field === "alcoholContent");
    expect(alcCheck?.status).toBe("mismatch");
  });

  it("government warning requires exact/word-for-word match (no fuzzy)", () => {
    const wrongWarning =
      "Government Warning: (1) According to the Surgeon General...";
    const extracted: ExtractedLabelData = {
      brandName: baseApplication.brandName,
      classType: baseApplication.classType,
      alcoholContent: baseApplication.alcoholContent,
      netContents: baseApplication.netContents,
      governmentWarningText: wrongWarning,
      hasGovernmentWarningHeaderExact: false,
    };
    const checks = compareLabelData(baseApplication, extracted);
    const warningCheck = checks.find((c) => c.field === "governmentWarning");
    const headerCheck = checks.find(
      (c) => c.field === "governmentWarningHeader",
    );
    expect(warningCheck?.status).toBe("mismatch");
    expect(headerCheck?.status).toBe("mismatch");
  });

  it("reports missing when a field is not on the label", () => {
    const extracted: ExtractedLabelData = {
      brandName: baseApplication.brandName,
      classType: baseApplication.classType,
      alcoholContent: baseApplication.alcoholContent,
      // netContents omitted
      governmentWarningText: STANDARD_GOVERNMENT_WARNING,
      hasGovernmentWarningHeaderExact: true,
    };
    const checks = compareLabelData(baseApplication, extracted);
    const netCheck = checks.find((c) => c.field === "netContents");
    expect(netCheck?.status).toBe("missing");
  });

  it("includes notes when match is high but not perfect (e.g. minor typo)", () => {
    const extracted: ExtractedLabelData = {
      brandName: "Stone's Thow", // typo: Thow vs Throw
      classType: baseApplication.classType,
      alcoholContent: baseApplication.alcoholContent,
      netContents: baseApplication.netContents,
      governmentWarningText: STANDARD_GOVERNMENT_WARNING,
      hasGovernmentWarningHeaderExact: true,
    };
    const checks = compareLabelData(baseApplication, extracted);
    const brandCheck = checks.find((c) => c.field === "brandName");
    expect(brandCheck?.status).toBe("match");
    expect(brandCheck?.notes).toBeDefined();
    expect(brandCheck!.notes).toContain("% match");
  });
});
