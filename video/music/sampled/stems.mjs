// Renders one stereo stem per instrument from a score with sampled
// instruments: spessasynth_core (a SoundFont synthesizer in plain JavaScript)
// playing GeneralUser GS, offline. Its own reverb and chorus are switched
// off; the shared mix adds the same reverb the synth version gets.

import { SoundBankLoader, SpessaSynthProcessor } from "spessasynth_core";
import { createStereo, SAMPLE_RATE } from "../dsp/buffers.mjs";
import { riseAt } from "../dsp/shapes.mjs";
import { synthStems } from "../synth/stems.mjs";
import { readSoundFont } from "./soundfont.mjs";

const DRUM_CHANNEL = 9;
const BLOCK = 128;
// Pad notes with an attack this long are a written swell; the sampled pad
// cannot be told how slowly to open, so the swell is shaped after rendering.
const SWELL_ATTACK_SECONDS = 0.8;

/** Note-ons and note-offs in sample time; a note ends before its own repeat. */
function eventsFor(notes, patch) {
  const key = (note) => patch.drumKey ?? note.midi;
  return notes
    .flatMap((note, index) => {
      const repeat = notes
        .slice(index + 1)
        .find((later) => key(later) === key(note) && later.start > note.start);
      const wanted = note.start + Math.max(note.seconds, patch.minSeconds ?? 0);
      const end = Math.min(wanted, repeat ? repeat.start - 0.005 : Infinity);
      const velocity = Math.max(1, Math.min(127, Math.round(note.vel * 127)));
      return [
        { at: Math.round(note.start * SAMPLE_RATE), key: key(note), velocity },
        { at: Math.round(end * SAMPLE_RATE), key: key(note), velocity: 0 },
      ];
    })
    .sort((a, b) => a.at - b.at || a.velocity - b.velocity);
}

async function createSynth(soundBank, patch) {
  const synth = new SpessaSynthProcessor(SAMPLE_RATE, {
    effectsEnabled: false,
    eventsEnabled: false,
  });
  synth.soundBankManager.addSoundBank(soundBank, "main");
  await synth.ready;
  synth.setSystemParameter("autoAllocateVoices", true);
  const channel = patch.drumKey === undefined ? 0 : DRUM_CHANNEL;
  if (patch.program !== undefined) synth.programChange(channel, patch.program);
  if (patch.kit !== undefined) synth.programChange(channel, patch.kit);
  return { synth, channel };
}

async function renderPatch(soundBank, patch, notes, seconds) {
  const { synth, channel } = await createSynth(soundBank, patch);
  const events = eventsFor(notes, patch);
  const total = Math.round(seconds * SAMPLE_RATE);
  const left = new Float32Array(total);
  const right = new Float32Array(total);
  let next = 0;
  for (let position = 0; position < total;) {
    for (; next < events.length && events[next].at <= position; next += 1) {
      const { key, velocity } = events[next];
      if (velocity > 0) synth.noteOn(channel, key, velocity);
      else synth.noteOff(channel, key);
    }
    // Stop each block at the next event so notes start on their exact sample.
    const untilEvent =
      next < events.length ? events[next].at - position : BLOCK;
    const count = Math.min(BLOCK, untilEvent, total - position);
    synth.process(left, right, position, count);
    position += count;
  }
  return { left: Float64Array.from(left), right: Float64Array.from(right) };
}

function shapeSwell(stem, notes) {
  for (const note of notes) {
    const from = Math.round(note.start * SAMPLE_RATE);
    const to = Math.min(
      stem.left.length,
      from + Math.round(note.attack * SAMPLE_RATE),
    );
    for (let i = from; i < to; i += 1) {
      const gain = riseAt((i - from) / SAMPLE_RATE, note.attack);
      stem.left[i] *= gain;
      stem.right[i] *= gain;
    }
  }
  return stem;
}

function sum(a, b, seconds) {
  const out = createStereo(seconds);
  for (let i = 0; i < out.left.length; i += 1) {
    out.left[i] = a.left[i] + b.left[i];
    out.right[i] = a.right[i] + b.right[i];
  }
  return out;
}

async function sampledStem(soundBank, inst, patch, own, seconds) {
  const isSwell = (note) =>
    inst === "pad" && (note.attack ?? 0) >= SWELL_ATTACK_SECONDS;
  const steady = await renderPatch(
    soundBank,
    patch,
    own.filter((note) => !isSwell(note)),
    seconds,
  );
  const swellNotes = own.filter(isSwell);
  if (swellNotes.length === 0) return steady;
  const swell = shapeSwell(
    await renderPatch(soundBank, patch, swellNotes, seconds),
    swellNotes,
  );
  return sum(steady, swell, seconds);
}

export async function sampledStems(notes, seconds, patches) {
  const soundBank = SoundBankLoader.fromArrayBuffer(readSoundFont());
  const stems = {};
  for (const [inst, patch] of Object.entries(patches)) {
    const own = notes.filter((note) => note.inst === inst);
    if (own.length === 0) continue;
    stems[inst] =
      patch.engine === "synth"
        ? synthStems(own, seconds)[inst]
        : await sampledStem(soundBank, inst, patch, own, seconds);
  }
  return stems;
}
