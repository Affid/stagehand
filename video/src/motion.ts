// Timing helpers: seconds to frames, eased progress, springs, keyframes.
import { Easing, interpolate, spring } from "remotion";

export const FPS = 30;
export const sec = (seconds: number): number => Math.round(seconds * FPS);

const CLAMP = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
} as const;
const SMOOTH = Easing.inOut(Easing.cubic);

export const lerp = (a: number, b: number, t: number): number =>
  a + (b - a) * t;

/** 0 to 1 between two frames, eased in and out. */
export const ease = (frame: number, from: number, to: number): number =>
  interpolate(frame, [from, to], [0, 1], { ...CLAMP, easing: SMOOTH });

/** 0 to 1 from `start`, landing with a small overshoot. */
export const pop = (frame: number, start: number, damping = 13): number =>
  spring({
    frame: frame - start,
    fps: FPS,
    config: { damping, stiffness: 130, mass: 0.7 },
  });

/** 0 to 1 from `start`, settling without overshoot. */
export const glide = (frame: number, start: number, frames = 30): number =>
  spring({
    frame: frame - start,
    fps: FPS,
    config: { damping: 200 },
    durationInFrames: frames,
  });

export type Key = readonly [frame: number, value: number];

/** A value that moves through keyframes, eased between each pair. */
export const track = (frame: number, keys: readonly Key[]): number =>
  interpolate(
    frame,
    keys.map((k) => k[0]),
    keys.map((k) => k[1]),
    { ...CLAMP, easing: SMOOTH },
  );

/** 1 at `at`, falling to 0 over `frames` on each side. */
export const pulse = (frame: number, at: number, frames: number): number =>
  Math.max(0, 1 - Math.abs(frame - at) / frames);
