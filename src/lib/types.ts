import {
  STANDARD_GOVERNMENT_WARNING,
  type ApplicationLabelData,
  type FieldCheck,
} from "@/lib/labelComparison";

export type VerificationResult =
  | {
      status: "success";
      fileName: string;
      checks: FieldCheck[];
      rawOcrText: string;
      durationMs: number;
    }
  | {
      status: "ocr_failed";
      fileName: string;
      fileIndex: number;
    };

export type Mode = "single" | "batch";

export const defaultApplicationData: ApplicationLabelData = {
  brandName: "STONE'S THROW",
  classType: "India Pale Ale",
  alcoholContent: "6.5% Alc./Vol.",
  netContents: "12 FL OZ",
  bottlerNameAddress: "Stone's Throw Brewing Co, Portland, OR",
  countryOfOrigin: "USA",
  governmentWarning: STANDARD_GOVERNMENT_WARNING,
};
