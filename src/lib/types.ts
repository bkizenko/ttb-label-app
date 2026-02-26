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
  brandName: "",
  classType: "",
  alcoholContent: "",
  netContents: "",
  bottlerNameAddress: "",
  countryOfOrigin: "",
  governmentWarning: STANDARD_GOVERNMENT_WARNING,
};
