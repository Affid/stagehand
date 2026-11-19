// A loop made to be a GIF, for the companion's foundryvtt.com page: the real
// Setup pages walked through by a pointer (script.ts), played by SceneGif.
import type { FC } from "react";
import { EndCard } from "./cards";
import { SceneGif } from "./SceneGif";
import { SCENES } from "./script";

export { LISTING } from "./SceneGif";
export { LISTING_FRAMES } from "./script";

export const ListingGif: FC = () => (
  <SceneGif scenes={SCENES} end={<EndCard />} />
);
