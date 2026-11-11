// The look: Stagehand's own colours and the typeface its page uses for text.
import { loadFont } from "@remotion/google-fonts/Signika";

export const { fontFamily } = loadFont("normal", {
  weights: ["400", "500", "600"],
  subsets: ["latin"],
});

export const COLOR = {
  bg: "#0c0b14",
  fg: "#efe9dd",
  dim: "#b5aec2",
  warm: "#ee9b3a",
} as const;

/** The captured page, in its own CSS pixels. */
export const PAGE = { width: 1280, height: 720 } as const;
/** Captured CSS pixels to video pixels (1280 x 720 fills 1920 x 1080). */
export const K = 1.5;
