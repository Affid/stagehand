// The companion's second foundryvtt.com GIF: the library view inside a
// world (world-script.ts), played as the first one is.
import type { FC } from "react";
import { WorldEndCard } from "./cards";
import { SceneGif } from "./SceneGif";
import { WORLD_SCENES } from "./world-script";

export { WORLD_FRAMES } from "./world-script";

export const WorldGif: FC = () => (
  <SceneGif scenes={WORLD_SCENES} end={<WorldEndCard />} />
);
