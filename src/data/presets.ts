import type { ApplicationLabelData } from "@/lib/labelComparison";
import { STANDARD_GOVERNMENT_WARNING } from "@/lib/labelComparison";

export interface DemoPreset {
  id: string;
  label: string;
  description: string;
  applicationData: ApplicationLabelData;
  /** Paths under /demo/ — exactly 3 images per preset */
  imagePaths: [string, string, string];
}

/** DAOU Cabernet Sauvignon — Wine (Domestic) */
const DAOU_PRESET: DemoPreset = {
  id: "daou",
  label: "DAOU Cabernet Sauvignon (Wine — Domestic)",
  description: "Wine, domestic",
  imagePaths: [
    "wine images/IMG_9944.jpg",
    "wine images/IMG_9945.jpg",
    "wine images/IMG_9946.jpg",
  ],
  applicationData: {
    brandName: "DAOU",
    classType: "Cabernet Sauvignon",
    alcoholContent: "ALC. 14.5% BY VOL.",
    netContents: "750ML",
    bottlerNameAddress: "BOTTLED BY DAOU VINEYARDS, SONOMA, CA",
    countryOfOrigin: "",
    governmentWarning: STANDARD_GOVERNMENT_WARNING,
  },
};

/** Stone's Throw IPA — Beer (Domestic) */
const STONES_THROW_PRESET: DemoPreset = {
  id: "stones-throw",
  label: "Stone's Throw IPA (Beer — Domestic)",
  description: "Beer, domestic",
  imagePaths: [
    "stone's throw/Gemini_Generated_Image_m7k6thm7k6thm7k6.jpg",
    "stone's throw/Gemini_Generated_Image_dmzayfdmzayfdmza.jpg",
    "stone's throw/Gemini_Generated_Image_zq0e3zq0e3zq0e3z.jpg",
  ],
  applicationData: {
    brandName: "STONE'S THROW",
    classType: "India Pale Ale",
    alcoholContent: "6.5% Alc./Vol.",
    netContents: "12 FL OZ",
    bottlerNameAddress: "Stone's Throw Brewing Co, Portland, OR",
    countryOfOrigin: "USA",
    governmentWarning: STANDARD_GOVERNMENT_WARNING,
  },
};

/** Absolut Citron — Distilled Spirits (Import) */
const ABSOLUT_PRESET: DemoPreset = {
  id: "absolut",
  label: "Absolut Citron (Vodka — Import)",
  description: "Distilled spirits, import",
  imagePaths: [
    "vodka images/IMG_9937.jpg",
    "vodka images/IMG_9936.HEIC",
    "vodka images/IMG_9935.HEIC",
  ],
  applicationData: {
    brandName: "ABSOLUT CITRON",
    classType: "Lemon Flavored Vodka",
    alcoholContent: "40% ALC./VOL. (80 PROOF)",
    netContents: "750 ML",
    bottlerNameAddress: "IMPORTED BY ABSOLUT SPIRITS CO., NEW YORK, NY",
    countryOfOrigin: "Sweden",
    governmentWarning: STANDARD_GOVERNMENT_WARNING,
  },
};

/** Old Tom Distillery — Bourbon (Domestic) */
const OLD_TOM_PRESET: DemoPreset = {
  id: "old-tom",
  label: "Old Tom Distillery (Bourbon — Domestic)",
  description: "Bourbon whiskey, domestic",
  imagePaths: [
    "old tom distillery test images/ChatGPT Image Feb 25, 2026, 03_00_25 PM.jpg",
    "old tom distillery test images/ChatGPT Image Feb 25, 2026, 03_05_35 PM.jpg",
    "old tom distillery test images/ChatGPT Image Feb 25, 2026, 03_07_36 PM.jpg",
  ],
  applicationData: {
    brandName: "OLD TOM DISTILLERY",
    classType: "Kentucky Straight Bourbon Whiskey",
    alcoholContent: "45% Alc./Vol. (90 Proof)",
    netContents: "750 mL",
    bottlerNameAddress: "Bottled by Old Tom Distillery, Louisville, KY",
    countryOfOrigin: "United States",
    governmentWarning: STANDARD_GOVERNMENT_WARNING,
  },
};

export const DEMO_PRESETS: DemoPreset[] = [
  ABSOLUT_PRESET,
  DAOU_PRESET,
  STONES_THROW_PRESET,
  OLD_TOM_PRESET,
];

export function getPresetById(id: string): DemoPreset | undefined {
  return DEMO_PRESETS.find((p) => p.id === id);
}
