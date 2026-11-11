// Where the camera rests at the end of each scene, so the next one can pick
// it up from there.
import { capture, centre } from "../data";
import type { Camera } from "../parts/Stage";

const table = centre(capture.walk.byWorld.table);
const waits = centre(capture.walk.queued.waits);

export const BY_WORLD_END: Camera = { x: table.x + 40, y: 400, scale: 1.75 };
export const QUEUE_END: Camera = {
  x: waits.x + 90,
  y: waits.y + 50,
  scale: 1.8,
};
