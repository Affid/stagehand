// What a listing GIF's scene is: a captured page (or the phones, or the
// closing card), its caption, the rings it draws and where the pointer
// clicks. Shared by both GIFs' scripts (script.ts, world-script.ts).
import { sec } from "../motion";
import type { Box } from "./parts";

/** Which part of a captured page the picture shows, and how big. */
export interface View {
  readonly scale: number;
  readonly x: number;
  readonly y: number;
}

export interface Ring {
  readonly box: Box;
  readonly at: number;
}

export interface Scene {
  /** A captured page, the phones, or the closing card. */
  readonly kind: "page" | "phones" | "end";
  readonly src?: string;
  readonly view?: View;
  readonly lead: string;
  readonly rest: string;
  readonly frames: number;
  readonly rings?: readonly Ring[];
  /** Where the pointer clicks, in page pixels, and when. */
  readonly click?: Ring;
}

/** The whole page at the picture's width (960 of 1280). */
export const WHOLE: View = { scale: 0.75, x: 0, y: 0 };

export const page = (
  src: string,
  lead: string,
  rest: string,
  seconds: number,
  more: Partial<Scene> = {},
): Scene => ({
  kind: "page",
  src,
  view: WHOLE,
  lead,
  rest,
  frames: sec(seconds),
  ...more,
});

export const framesOf = (scenes: readonly Scene[]): number =>
  scenes.reduce((n, s) => n + s.frames, 0);
