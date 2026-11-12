// A loop made to be a GIF, for the companion's foundryvtt.com page: the real
// Setup pages, cut hard from one to the next, with a pointer walking the
// flow (script.ts). Only small things move (the pointer, a ring, the
// caption), so most frames cost a GIF almost nothing.
import type { FC } from "react";
import { AbsoluteFill, Img, useCurrentFrame } from "remotion";
import { sec, track } from "../motion";
import { COLOR } from "../theme";
import { EndCard, Phones } from "./cards";
import {
  Caption,
  ClickRing,
  Cursor,
  Mark,
  type Box,
  type Point,
} from "./parts";
import { type Scene, SCENES, type View, WHOLE } from "./script";

export { LISTING_FRAMES } from "./script";

export const LISTING = { width: 960, height: 600, bar: 60 } as const;
const PICTURE = LISTING.height - LISTING.bar;
/** Where the pointer waits when the scene before it clicked nothing. */
const REST: Point = { x: 720, y: 420 };

const toPicture = (v: View, p: Point): Point => ({
  x: (p.x - v.x) * v.scale,
  y: (p.y - v.y) * v.scale,
});

const centreOf = (v: View, b: Box): Point =>
  toPicture(v, { x: b[0] + b[2] / 2, y: b[1] + b[3] / 2 });

const boxIn = (v: View, b: Box): Box => {
  const p = toPicture(v, { x: b[0], y: b[1] });
  return [p.x, p.y, b[2] * v.scale, b[3] * v.scale];
};

interface Playing {
  readonly scene: Scene;
  readonly local: number;
  readonly before: Scene;
}

/** The scene playing at `frame`, the frame within it, and the one before. */
const sceneAt = (frame: number): Playing => {
  let start = 0;
  for (const [i, scene] of SCENES.entries()) {
    if (frame < start + scene.frames) {
      const before = SCENES[(i + SCENES.length - 1) % SCENES.length]!;
      return { scene, local: frame - start, before };
    }
    start += scene.frames;
  }
  const last = SCENES[SCENES.length - 1]!;
  return { scene: last, local: last.frames - 1, before: last };
};

/** It starts where the last click was, then travels to this scene's. */
const pointer = (scene: Scene, before: Scene, local: number): Point => {
  const click = scene.click!;
  const from = before.click
    ? centreOf(before.view ?? WHOLE, before.click.box)
    : REST;
  const to = centreOf(scene.view ?? WHOLE, click.box);
  const leave = Math.max(0, click.at - sec(1));
  const arrive = click.at - sec(0.15);
  const along = (a: number, b: number): number =>
    track(local, [
      [leave, a],
      [arrive, b],
    ]);
  return { x: along(from.x, to.x), y: along(from.y, to.y) };
};

const Page: FC<Playing> = ({ scene, local, before }) => {
  const v = scene.view ?? WHOLE;
  const click = scene.click;
  const at = click ? pointer(scene, before, local) : null;
  const pressed = click && local >= click.at && local < click.at + 4;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        height: PICTURE,
        overflow: "hidden",
      }}
    >
      <Img
        src={scene.src!}
        style={{
          position: "absolute",
          left: -v.x * v.scale,
          top: -v.y * v.scale,
          width: 1280 * v.scale,
          maxWidth: "none",
        }}
      />
      {(scene.rings ?? []).map((r) => (
        <Mark key={r.at} box={boxIn(v, r.box)} frame={local} on={r.at} />
      ))}
      {click && at && <ClickRing at={at} frame={local} on={click.at} />}
      {at && <Cursor at={at} press={pressed ? 1 : 0} />}
    </div>
  );
};

export const ListingGif: FC = () => {
  const playing = sceneAt(useCurrentFrame());
  const { scene } = playing;
  if (scene.kind === "end") return <EndCard />;
  return (
    <AbsoluteFill style={{ background: COLOR.bg }}>
      {scene.kind === "phones" ? (
        <Phones height={PICTURE} />
      ) : (
        <Page {...playing} />
      )}
      <Caption lead={scene.lead} rest={scene.rest} height={LISTING.bar} />
    </AbsoluteFill>
  );
};
