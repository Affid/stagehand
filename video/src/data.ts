// What the capture wrote (video/capture/capture.ts): where every piece of
// both pages sits, in the captured page's CSS pixels.
import { staticFile } from "remotion";
import raw from "../public/capture/capture.json";

export type Rect = readonly [x: number, y: number, w: number, h: number];

export interface Piece {
  readonly id: string;
  readonly rect: Rect;
  readonly group?: number;
}

interface Capture {
  readonly stock: {
    readonly chrome: Readonly<Record<"title" | "list", Rect>>;
    readonly cards: readonly Piece[];
  };
  readonly library: {
    readonly chrome: Readonly<
      Record<"title" | "list" | "byWorldTab" | "main" | "rail", Rect>
    >;
    readonly cards: readonly Piece[];
    readonly folders: readonly Piece[];
    readonly labels: readonly {
      readonly name: string;
      readonly color: string;
    }[];
  };
  readonly walk: {
    readonly noted: Readonly<Record<"card" | "note" | "tags", Rect>>;
    readonly byWorld: { readonly table: Rect; readonly columns: Rect[] };
    readonly world: Readonly<Record<"railItem" | "card" | "toggle", Rect>>;
    readonly queued: Readonly<Record<"waits" | "launch", Rect>>;
    readonly review: Readonly<
      Record<"dialog" | "apply" | "verdict" | "turnsOn" | "backup", Rect>
    >;
  };
}

export const capture = raw as unknown as Capture;

export const shot = (name: string): string => staticFile(`capture/${name}`);

export const SHOTS = {
  stock: shot("stock/page.png"),
  library: shot("sh/library.png"),
  byWorld: shot("sh/by-world.png"),
  world: shot("sh/world.png"),
  queued: shot("sh/world-queued.png"),
  review: shot("sh/review.png"),
} as const;

export const centre = (r: Rect): { x: number; y: number } => ({
  x: r[0] + r[2] / 2,
  y: r[1] + r[3] / 2,
});
