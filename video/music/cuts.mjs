// The two cuts of the film and everything that differs between them: which
// score, how long, the balance, the loudness target, the output names.
// Cut A (calm, 41 s) is the default everywhere; cut B (upbeat, 30 s) is
// asked for by name.

import * as scoreA from "./score.mjs";
import * as scoreB from "./score-b.mjs";
import { PATCHES_A, PATCHES_B } from "./sampled/patches.mjs";

const D_MAJOR = [2, 4, 6, 7, 9, 11, 1];

/** level: whole-track stem RMS in dB (relative); send: share sent to the reverb. */
const MIX_A = {
  piano: { level: -27, send: 0.3 },
  mallet: { level: -29.5, send: 0.28 },
  pad: { level: -30, send: 0.35 },
  bass: { level: -32, send: 0.05 },
  bell: { level: -43, send: 0.45 },
  kick: { level: -40, send: 0.05 },
  shaker: { level: -50, send: 0.2 },
};

const MIX_B = {
  pluck: { level: -30, send: 0.25 },
  piano: { level: -29, send: 0.25 },
  mallet: { level: -32, send: 0.25 },
  pad: { level: -33, send: 0.35 },
  bounce: { level: -28, send: 0.03 },
  punch: { level: -28, send: 0.03 },
  clap: { level: -38, send: 0.2 },
  hat: { level: -47, send: 0.1 },
  click: { level: -52, send: 0.3 },
  bell: { level: -43, send: 0.4 },
  riser: { level: -44, send: 0.3 },
};

export const CUTS = {
  a: {
    id: "a",
    filePrefix: "music",
    score: { ...scoreA, KEY_PITCH_CLASSES: D_MAJOR, HIT_TIMES: [] },
    seconds: scoreA.DURATION_SECONDS,
    mix: MIX_A,
    patches: PATCHES_A,
    reverbSeconds: 1.7,
    topHz: 10500,
    // The reverb is faded out over the last second so the file ends in true
    // silence; by then the tail is already far down.
    fadeOutFrom: 39.9,
    fadeOutSeconds: 1.0,
    loudness: { targetLufs: -20, truePeakLimitDb: -3, sampleCeilingDb: -4 },
    versions: {
      synth: { engine: "synth", notes: scoreA.NOTES },
      simple: {
        engine: "synth",
        notes: scoreA.notesFor(scoreA.SIMPLE_INSTRUMENTS),
      },
      sampled: { engine: "sampled", notes: scoreA.NOTES },
    },
  },
  b: {
    id: "b",
    filePrefix: "music-b",
    score: scoreB,
    seconds: scoreB.DURATION_SECONDS,
    mix: MIX_B,
    patches: PATCHES_B,
    // A shorter room and a little more top than cut A: tighter and brighter.
    reverbSeconds: 1.2,
    topHz: 13000,
    fadeOutFrom: 32.9,
    fadeOutSeconds: 1.0,
    loudness: { targetLufs: -18, truePeakLimitDb: -2, sampleCeilingDb: -3 },
    versions: {
      synth: { engine: "synth", notes: scoreB.NOTES },
      sampled: { engine: "sampled", notes: scoreB.NOTES },
    },
  },
};

/** Reads "[cut] [version...]" from the command line; cut A when none is named. */
export function parseCutArgs(args) {
  const cut = CUTS[args[0]?.toLowerCase()] ?? CUTS.a;
  const rest = CUTS[args[0]?.toLowerCase()] ? args.slice(1) : args;
  const names = rest.length > 0 ? rest : Object.keys(cut.versions);
  const unknown = names.filter((name) => !(name in cut.versions));
  if (unknown.length > 0) {
    throw new Error(
      `Cut ${cut.id} has no version ${unknown.join(", ")}; it has ${Object.keys(cut.versions).join(", ")}.`,
    );
  }
  return { cut, names };
}
