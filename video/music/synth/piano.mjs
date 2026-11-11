// A soft piano by additive synthesis. Each partial is tuned slightly sharp of
// the harmonic series (string stiffness), sounded twice a hair apart (two
// strings beating), and dies in two stages: a quick drop, then a long ring.
// Higher partials are weaker and shorter, more so for a soft touch.

import { SAMPLE_RATE } from "../dsp/buffers.mjs";
import { createNoise, fallAt, onePole, riseAt } from "../dsp/shapes.mjs";
import { hzOf } from "../score/pitch.mjs";

const MAX_PARTIALS = 24;
const STRING_DETUNE_CENTS = 0.7;
const ATTACK_SECONDS = 0.004;
const DAMPER_SECONDS = 0.14;
const TAIL_SECONDS = 0.7;
// The hammer strikes about an eighth of the way along, which thins every
// eighth partial; the floor keeps those from vanishing entirely.
const STRIKE_POINT = 1 / 8;

function partialsFor(hz, vel) {
  const stiffness = 0.0003 * (hz / 261.6) ** 1.4;
  const topHz = 3500 + 3500 * vel;
  const rolloff = 1.5 + (1 - vel) * 0.9;
  const baseDecay = Math.min(4, Math.max(0.35, 1.7 * (261.6 / hz) ** 0.7));
  const list = [];
  for (let n = 1; n <= MAX_PARTIALS; n += 1) {
    const partialHz = n * hz * Math.sqrt(1 + stiffness * n * n);
    if (partialHz > topHz) break;
    const comb = 0.25 + 0.75 * Math.abs(Math.sin(Math.PI * n * STRIKE_POINT));
    list.push({
      hz: partialHz,
      amp: comb / n ** rolloff,
      decay: baseDecay / (1 + 0.35 * (n - 1)),
    });
  }
  return list;
}

function addPartial(out, partial, detune) {
  const step = (2 * Math.PI * partial.hz * detune) / SAMPLE_RATE;
  for (let i = 0; i < out.length; i += 1) {
    const time = i / SAMPLE_RATE;
    const envelope =
      0.7 * Math.exp(-time / partial.decay) +
      0.3 * Math.exp(-time / (3 * partial.decay));
    out[i] += 0.5 * partial.amp * envelope * Math.sin(step * i);
  }
}

/** The dull knock of the hammer and key, under the note's first moments. */
function addHammerThump(out, note) {
  const noise = createNoise(note.midi * 104729 + Math.round(note.start * 1000));
  const smoothing = onePole(700, SAMPLE_RATE);
  const count = Math.min(out.length, Math.round(0.03 * SAMPLE_RATE));
  let low = 0;
  for (let i = 0; i < count; i += 1) {
    low += smoothing * (noise() - low);
    out[i] += 0.12 * low * Math.exp(-i / (0.008 * SAMPLE_RATE));
  }
}

export function piano(note) {
  const hz = hzOf(note.midi);
  const total = note.seconds + TAIL_SECONDS;
  const out = new Float64Array(Math.round(total * SAMPLE_RATE));
  const detune = 2 ** (STRING_DETUNE_CENTS / 1200);
  for (const partial of partialsFor(hz, note.vel)) {
    addPartial(out, partial, detune);
    addPartial(out, partial, 1 / detune);
  }
  addHammerThump(out, note);
  for (let i = 0; i < out.length; i += 1) {
    const time = i / SAMPLE_RATE;
    const damper =
      time < note.seconds
        ? 1
        : Math.exp(-(time - note.seconds) / DAMPER_SECONDS);
    out[i] *=
      note.vel *
      riseAt(time, ATTACK_SECONDS) *
      damper *
      fallAt(time, total - 0.05, 0.05);
  }
  // Melody a touch right of centre, low chord notes a touch left.
  return [
    { samples: out, pan: Math.max(-0.3, Math.min(0.3, (note.midi - 69) / 50)) },
  ];
}
