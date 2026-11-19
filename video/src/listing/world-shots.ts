// What video/capture/listing-in-world.ts wrote for the in-world GIF: the
// screens, and where each piece sits on them, in the page's CSS pixels.
import { staticFile } from "remotion";
import raw from "../../public/capture/listing-world.json";
import type { Box } from "./parts";

interface WorldCapture {
  readonly settings: Readonly<Record<"manage", Box>>;
  readonly view: Readonly<
    Record<
      | "head"
      | "title"
      | "note"
      | "tag"
      | "preset"
      | "packageTab"
      | "needs"
      | "toggle"
      | "pending"
      | "save",
      Box
    >
  >;
  readonly after: Readonly<
    Record<"dialog" | "added" | "saveReload" | "card", Box>
  >;
}

export const atWorld = raw as unknown as WorldCapture;

const shot = (name: string): string =>
  staticFile(`capture/listing-world/${name}.png`);

export const WORLD_SCREENS = {
  settings: shot("settings"),
  cards: shot("cards"),
  panel: shot("panel"),
  package: shot("package"),
  changed: shot("changed"),
  review: shot("review"),
  after: shot("after"),
} as const;
