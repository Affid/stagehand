// Where the ball lands, and when: one landing per thing the video points
// at, on the beat. Frames are the whole video's; positions are video pixels.
import { HEADS } from "../sort-layout";
import { K } from "../theme";
import {
  DIALOG,
  DIALOG_AT,
  DIALOG_SCALE,
  FLIP,
  ROWS,
  SWITCH,
  WAIT_IN,
} from "./Change";
import { CLICK, HEROES, PICKED, RAIL_AT, RAIL_SCALE } from "./Features";
import { LAND } from "./Sort";
import { B_SCENES } from "./timeline";

export interface Landing {
  readonly frame: number;
  readonly x: number;
  readonly y: number;
}

/** A stretch of the video the ball bounces through, then leaves. */
export type Run = readonly Landing[];

const at = (frame: number, x: number, y: number): Landing => ({ frame, x, y });

const INTRO: Run = [
  at(-14, 150, 760),
  at(0, 520, 700),
  at(15, 980, 640),
  at(30, 1420, 700),
  at(45, 1700, 560),
  at(60, 960, 330),
];

const sort = B_SCENES.sort.from;
const library = B_SCENES.library.from;
const SORT: Run = [
  at(sort - 8, 960, 330),
  ...HEADS.slice(0, 8).map((head, i) =>
    at(sort + (LAND[i] ?? 0), (head.board.x + 150) * K, head.board.y * K - 8),
  ),
  at(library, 1080, 250),
  ...HEROES.map((hero, i) =>
    at(library + hero.at, hero.x + 250 + i * 70, hero.y - 14),
  ),
];

const world = B_SCENES.world.from;
/** The three worlds in the rail: a hop on each, the last one the pick. */
const RAIL_STEP = 66 * RAIL_SCALE;
const WORLD: Run = [
  at(world - 6, 700, 200),
  at(world + 4, PICKED.x, PICKED.y - 2 * RAIL_STEP - 40),
  at(world + 15, PICKED.x, PICKED.y - RAIL_STEP - 40),
  at(world + CLICK, PICKED.x, PICKED.y - 40),
  at(world + 60, RAIL_AT.left + 1100, 250),
  at(world + 90, 1500, 560),
];

const queue = B_SCENES.queue.from;
const review = B_SCENES.review.from;
const row = (index: number, x: number): Landing => {
  const r = ROWS[index];
  const top = r ? DIALOG_AT.top + (r.rect[1] - DIALOG[1]) * DIALOG_SCALE : 0;
  return at(review + (r?.at ?? 0), x, top - 8);
};
const CHANGE: Run = [
  at(queue - 6, 1500, 560),
  at(queue + FLIP, SWITCH.x, SWITCH.y - 26),
  at(queue + WAIT_IN, 960, 742),
  at(review + 15, 960, DIALOG_AT.top - 6),
  row(0, 620),
  row(1, 520),
  row(2, 640),
  at(review + 105, 1452, 880),
  at(review + 120, 2100, 500),
];

const lockup = B_SCENES.lockup.from;
/** The pulley wheel in the mark: the ball drops in and becomes it. */
const LOCKUP: Run = [at(lockup - 14, 1500, -80), at(lockup, 960, 262)];

export const RUNS: readonly Run[] = [INTRO, SORT, WORLD, CHANGE, LOCKUP];
