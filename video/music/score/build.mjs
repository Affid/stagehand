// Small builders that turn the compact rows in the section files into note
// objects. A note is { inst, beat, dur, pitch, vel, attack? }: beats are
// quarter notes from the start of the film, vel is 0..1.

function note(inst, beat, dur, pitch, vel, extra = {}) {
  return { inst, beat, dur, pitch, vel, ...extra };
}

/** Rows of [beat, dur, pitch, vel]: a melodic line written out note by note. */
export function line(inst, rows) {
  return rows.map(([beat, dur, pitch, vel]) =>
    note(inst, beat, dur, pitch, vel),
  );
}

/** Rows of [beat, dur, 'D3 A3 F#4', vel, extra?]: every pitch sounds together. */
export function chords(inst, rows) {
  return rows.flatMap(([beat, dur, pitches, vel, extra]) =>
    pitches.split(" ").map((pitch) => note(inst, beat, dur, pitch, vel, extra)),
  );
}

/**
 * Evenly spaced notes from a pitch string; '-' is a rest. The velocity moves
 * in a straight line from vel to velEnd so a run can grow or fade.
 */
export function steps(
  inst,
  start,
  step,
  pitches,
  { vel, velEnd = vel, dur = step },
) {
  const names = pitches.split(" ");
  const last = Math.max(1, names.length - 1);
  return names.flatMap((pitch, index) => {
    if (pitch === "-") return [];
    const level = vel + ((velEnd - vel) * index) / last;
    return [
      note(inst, start + index * step, dur, pitch, Number(level.toFixed(3))),
    ];
  });
}

/** Unpitched hits (shaker, kick) at the given beats. */
export function hits(inst, beats, vel) {
  return beats.map((beat, index) =>
    note(inst, beat, 0.25, "C4", typeof vel === "function" ? vel(index) : vel),
  );
}

export function range(from, to, step) {
  const count = Math.round((to - from) / step);
  return Array.from({ length: count }, (_, index) => from + index * step);
}
