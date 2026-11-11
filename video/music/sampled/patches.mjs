// Which SoundFont preset plays each instrument, per cut. General MIDI
// programs are numbered from 0; drums are a key on a drum kit (kit 0 is
// "Standard 1"). minSeconds lets struck instruments ring instead of being
// cut at the written note length. { engine: 'synth' } marks a sound the
// SoundFont has no good match for, rendered by the synth engine instead.

export const PATCHES_A = {
  piano: { program: 0 },
  mallet: { program: 12, minSeconds: 0.5 },
  bell: { program: 8, minSeconds: 1 },
  pad: { program: 89 },
  bass: { program: 32 },
  kick: { drumKey: 36 },
  shaker: { drumKey: 82 },
};

// Kit choices were made by measuring each kit's kick, clap and hi-hat: the
// Standard 1 kick peaks within 5 ms and is 30 dB down by 136 ms (the
// tightest in the bank); the Electronic kit's closed hi-hat is the shortest
// natural-sounding one (83 ms).
export const PATCHES_B = {
  piano: { program: 0 },
  pluck: { program: 45, minSeconds: 0.3 },
  mallet: { program: 12, minSeconds: 0.5 },
  bell: { program: 8, minSeconds: 1 },
  pad: { program: 89 },
  bounce: { program: 33 },
  punch: { drumKey: 36, kit: 0 },
  clap: { drumKey: 39, kit: 0 },
  hat: { drumKey: 42, kit: 24 },
  click: { drumKey: 37, kit: 0 },
  riser: { engine: "synth" },
};
