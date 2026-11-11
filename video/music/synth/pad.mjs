// A warm pad: three slightly detuned voices per note, spread across the
// stereo field. Each voice is a sawtooth built from its harmonics (so nothing
// aliases) with the upper ones rolled off, a slow attack and release, and a
// slow, shallow swell so held chords do not sit perfectly still.

import { SAMPLE_RATE } from "../dsp/buffers.mjs";
import { createNoise, fallAt, riseAt } from "../dsp/shapes.mjs";
import { hzOf } from "../score/pitch.mjs";

const VOICES = [
  { cents: -7, pan: -0.65 },
  { cents: 0, pan: 0 },
  { cents: 7, pan: 0.65 },
];
const DEFAULT_ATTACK_SECONDS = 0.5;
const RELEASE_SECONDS = 0.9;
const ROLLOFF_HZ = 1300;
const TOP_HARMONIC_HZ = 5000;
const MAX_HARMONICS = 16;
const SWELL_HZ = 0.21;
const SWELL_DEPTH = 0.1;

function harmonicsFor(hz, random) {
  const list = [];
  for (let n = 1; n <= MAX_HARMONICS && n * hz < TOP_HARMONIC_HZ; n += 1) {
    const amp = 1 / n / (1 + ((n * hz) / ROLLOFF_HZ) ** 2);
    // Random start phases keep the summed wave from peaking like a raw saw.
    list.push({ n, amp, phase: random() * Math.PI });
  }
  return list;
}

function voiceSamples(note, voice, random) {
  const hz = hzOf(note.midi) * 2 ** (voice.cents / 1200);
  const attack = note.attack ?? DEFAULT_ATTACK_SECONDS;
  const total = note.seconds + RELEASE_SECONDS;
  const out = new Float64Array(Math.round(total * SAMPLE_RATE));
  for (const { n, amp, phase } of harmonicsFor(hz, random)) {
    const step = (2 * Math.PI * hz * n) / SAMPLE_RATE;
    for (let i = 0; i < out.length; i += 1)
      out[i] += amp * Math.sin(step * i + phase);
  }
  const swellPhase = random() * Math.PI;
  for (let i = 0; i < out.length; i += 1) {
    const time = i / SAMPLE_RATE;
    const swell =
      1 +
      SWELL_DEPTH *
        Math.sin(2 * Math.PI * SWELL_HZ * (note.start + time) + swellPhase);
    out[i] *=
      note.vel *
      swell *
      riseAt(time, attack) *
      fallAt(time, note.seconds, RELEASE_SECONDS);
  }
  return out;
}

export function pad(note) {
  const random = createNoise(note.midi * 31337 + Math.round(note.start * 1000));
  return VOICES.map((voice) => ({
    samples: voiceSamples(note, voice, random),
    pan: voice.pan,
  }));
}
