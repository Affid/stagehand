import type { FC } from "react";
import { Composition } from "remotion";
import { Recap, type RecapProps } from "./b/Outro";
import { PromoB, type PromoBProps } from "./b/PromoB";
import { B_TOTAL_FRAMES } from "./b/timeline";
import { FPS } from "./motion";
import { Promo, type PromoProps } from "./Promo";
import { TOTAL_FRAMES } from "./timeline";

/** Frames each page holds in the listing loop. */
const LISTING_HOLD = 3 * FPS;

export const Root: FC = () => (
  <>
    <Composition
      id="Promo"
      component={Promo}
      durationInFrames={TOTAL_FRAMES}
      fps={FPS}
      width={1920}
      height={1080}
      defaultProps={{ music: "sampled" } satisfies PromoProps}
    />
    <Composition
      id="PromoB"
      component={PromoB}
      durationInFrames={B_TOTAL_FRAMES}
      fps={FPS}
      width={1920}
      height={1080}
      defaultProps={{ music: "none" } satisfies PromoBProps}
    />
    {/* The real pages on a silent loop, for the companion's foundryvtt.com
        page (a GIF): cut B's recap, three seconds a look. */}
    <Composition
      id="ListingLoop"
      component={Recap}
      durationInFrames={LISTING_HOLD * 4}
      fps={FPS}
      width={1920}
      height={1080}
      defaultProps={{ hold: LISTING_HOLD, loop: true } satisfies RecapProps}
    />
  </>
);
