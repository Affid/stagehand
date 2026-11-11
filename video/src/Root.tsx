import type { FC } from "react";
import { Composition } from "remotion";
import { FPS } from "./motion";
import { Promo, type PromoProps } from "./Promo";
import { TOTAL_FRAMES } from "./timeline";

export const Root: FC = () => (
  <Composition
    id="Promo"
    component={Promo}
    durationInFrames={TOTAL_FRAMES}
    fps={FPS}
    width={1920}
    height={1080}
    defaultProps={{ music: "sampled" } satisfies PromoProps}
  />
);
