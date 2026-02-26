import type { ApplicationLabelData } from "@/lib/labelComparison";
import { STANDARD_GOVERNMENT_WARNING } from "@/lib/labelComparison";

export interface DemoPreset {
  id: string;
  label: string;
  description: string;
  applicationData: ApplicationLabelData;
  /** Path under /demo/ (e.g. "wine images/IMG_9944.HEIC") */
  imagePath: string;
}

/** DAOU Cabernet Sauvignon — Wine (Domestic) */
const DAOU_PRESET: DemoPreset = {
  id: "daou",
  label: "DAOU Cabernet Sauvignon (Wine — Domestic)",
  description: "Wine, domestic",
  imagePath: "wine images/IMG_9944.HEIC",
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
  imagePath: "stone's throw/Gemini_Generated_Image_m7k6thm7k6thm7k6.png",
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
  imagePath: "vodka images/IMG_9937.jpg",
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
  imagePath: "old tom distillery test images/ChatGPT Image Feb 25, 2026, 03_00_25 PM.png",
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
  DAOU_PRESET,
  STONES_THROW_PRESET,
  ABSOLUT_PRESET,
  OLD_TOM_PRESET,
];

export function getPresetById(id: string): DemoPreset | undefined {
  return DEMO_PRESETS.find((p) => p.id === id);
}
