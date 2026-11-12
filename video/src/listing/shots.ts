// What video/capture/listing.ts wrote for the listing GIF: the screens, and
// where each piece sits on them, in the captured page's CSS pixels.
import { staticFile } from "remotion";
import raw from "../../public/capture/listing.json";
import type { Box } from "./parts";

interface ListingCapture {
  readonly library: Readonly<
    Record<
      "folder" | "select" | "tag" | "title" | "panel" | "note" | "worlds",
      Box
    >
  >;
  readonly world: Readonly<
    Record<
      | "railItem"
      | "onButton"
      | "allButton"
      | "toggle"
      | "waits"
      | "launch"
      | "verdict"
      | "apply",
      Box
    >
  >;
  readonly game: Readonly<Record<"notice", Box>>;
}

export const at = raw as unknown as ListingCapture;

const listing = (name: string): string =>
  staticFile(`capture/listing/${name}.png`);

export const SCREENS = {
  library: listing("library"),
  tags: listing("library-tags"),
  panel: listing("module-panel"),
  world: listing("world"),
  worldOn: listing("world-on"),
  queued: listing("world-queued"),
  review: listing("review"),
  inWorld: listing("in-world"),
  backups: listing("backups"),
  update: listing("update"),
  config: listing("config"),
} as const;

export const PHONES = [
  staticFile("capture/phone/worlds.png"),
  staticFile("capture/phone/library.png"),
  staticFile("capture/phone/world.png"),
] as const;
