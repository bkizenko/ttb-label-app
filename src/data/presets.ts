import type { ApplicationLabelData } from "@/lib/labelComparison";
import { STANDARD_GOVERNMENT_WARNING } from "@/lib/labelComparison";

export interface DemoPreset {
  id: string;
  label: string;
  description: string;
  applicationData: ApplicationLabelData;
  /** Path under /demo/ for the test image (e.g. "daou-cabernet.png") */
  imagePath: string;
}

/** DAOU Cabernet Sauvignon — Wine (Domestic) */
const DAOU_PRESET: DemoPreset = {
  id: "daou",
  label: "DAOU Cabernet Sauvignon (Wine — Domestic)",
  description: "Wine, domestic",
  imagePath: "daou-cabernet.png",
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

/** Absolut Citron — Distilled Spirits (Import) */
const ABSOLUT_PRESET: DemoPreset = {
  id: "absolut",
  label: "Absolut Citron (Vodka — Import)",
  description: "Distilled spirits, import",
  imagePath: "absolut-citron.png",
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

export const DEMO_PRESETS: DemoPreset[] = [DAOU_PRESET, ABSOLUT_PRESET];

export function getPresetById(id: string): DemoPreset | undefined {
  return DEMO_PRESETS.find((p) => p.id === id);
}
