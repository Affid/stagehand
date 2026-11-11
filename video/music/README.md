# Promo music

The 41-second music track for the Stagehand promo video, written and rendered
entirely in code. Nobody involved in making it could listen to it: it was
checked by measurement and by reading spectrograms, not by ear. Choose between
the versions by listening.

## The piece

- Original composition, written as note data in `score/` (no samples of, or
  quotations from, existing music). D major, 120 BPM, 4/4, so one beat is
  0.5 s and every cue in the film falls on a beat.
- `node print-score.mjs` prints every note with its time, for proof-reading.

| Time (s)  | Film                  | Music                                                                                                   |
| --------- | --------------------- | ------------------------------------------------------------------------------------------------------- |
| 0.0-2.0   | Cluttered page, still | Dsus2 pad over a low D, two piano notes (A4, E5)                                                        |
| 2.0       | Pieces lift off       | Gadd9: piano D5+A5, a bell, bass G                                                                      |
| 3.0-6.5   | Cards sort themselves | Mallet run over Asus4: eighths, then sixteenths, then a sextuplet sweep up to D6 at 6.5                 |
| 7.0-8.0   | Everything settles    | D major chord landing (piano, pad, bass, mallet, bell, soft kick)                                       |
| 8.0-16.0  | Folders, Tags, Notes  | Theme on piano over D, Bm7, Gmaj7, Asus4-A; mallet ostinato in eighths; bell accents at 8.0, 10.5, 13.0 |
| 16.0-22.0 | By world              | Theme a third higher over Gmaj7, D/F#, Em7-A7sus4; same pulse                                           |
| 22.0-28.0 | Queue a change        | Thin: pad, bass, a few mallet and piano notes over Bm7, G, Em9; one high mallet note and bell at 24.5   |
| 28.0-34.0 | Review before launch  | A9sus4 held over A, quiet mallet pulse; a pad swell that peaks at 29.5 with a rolled piano chord        |
| 34.0-41.0 | End card              | A-C# pickup, D major at 34.5, theme at half speed, last note at 38.5, tail, silence                     |

## Versions

All three read the same `score.mjs` and go through the same mix, reverb and
mastering (`mix.mjs`, `finish.mjs`); only the instruments differ.

- **synth** (`music-synth.wav`): every sample computed in plain Node, no
  dependencies.
  - Mallet: modal synthesis, three decaying sine partials at marimba-bar
    ratios (1, 3.93, 9.7) plus a few milliseconds of filtered noise.
  - Bell: the same with glockenspiel-like ratios (1, 2.76, 5.4).
  - Piano: additive, up to 24 partials stretched by string stiffness, two
    strings 1.4 cents apart, two-stage decay, a filtered-noise hammer thump.
  - Pad: three voices detuned by 7 cents, each a band-limited sawtooth built
    from at most 16 harmonics with the top rolled off, slow attack and release.
  - Bass: sine plus second and third harmonics. Kick: a sine dropping from
    95 to 48 Hz. Shaker: band-passed noise bursts.
- **sampled** (`music-sampled.wav`): the same notes played by
  [spessasynth_core](https://github.com/spessasus/spessasynth_core) 4.4.10
  (Apache-2.0, pure JavaScript, rendered offline) with the GeneralUser GS
  SoundFont. Presets: Grand Piano (0), Marimba (12), Celeste (8), Warm Pad
  (89), Acoustic Bass (32), and from the Standard 1 drum kit the kick (key 36)
  and shaker (key 82). The synthesizer's own reverb and chorus are off.
- **simple** (`music-simple.wav`): the synth engine with only piano, pad and
  bass. The sorting run (3.0-6.5 s) and all bell accents are absent from it.

Shared by all: each instrument's stem is scaled to a fixed RMS level
(`MIX` in `mix.mjs`) so both engines are balanced alike; reverb is an
eight-line feedback delay network (Householder feedback, 1.7 s decay, damped
above 4.2 kHz, fed through all-pass diffusers, sends high-passed at 180 Hz);
mastering is a 28 Hz high-pass, a 10.5 kHz low-pass, a 20 ms fade-in, a fade
to digital silence from 39.9 to 40.9 s, a 5 ms look-ahead limiter at -4 dBFS,
and gain set so ffmpeg's EBU R128 meter reads -20 LUFS. Output is 48 kHz
stereo 16-bit WAV with triangular dither, plus an AAC 192k `.m4a` copy.

## Re-rendering

```bash
cd video/music
node render.mjs synth simple      # needs only Node and ffmpeg
npm install                       # once, for the sampled version
npm run fetch-soundfont           # once: downloads the SoundFont into .cache/
node render.mjs sampled
node render.mjs                   # all three
node check.mjs                    # measurements, and spectrograms in out/
```

Files are written to `video/public/audio/`. The synth renders are
deterministic (seeded noise). After changing notes, edit `score/*.mjs` and run
`node render.mjs`.

## SoundFont

- GeneralUser GS v2.0.3 by S. Christian Collins, from
  <https://github.com/mrbumpy409/GeneralUser-GS> (`GeneralUser-GS.sf2`,
  32,319,396 bytes; licence in `documentation/LICENSE.txt`, saved next to the
  SoundFont in `.cache/generaluser-gs/`).
- Its licence (v2.0) says: "You may use GeneralUser GS without restriction for
  your own music creation, private or commercial", and that the contained
  samples "allow full use in music production, including the ability to make
  profit from musical recordings". The author adds that he "cannot be 100%
  sure where all of the samples originated", though none came from commercial
  libraries as far as he knows, and asks not to hot-link his download files.
- The SoundFont is not committed: `.cache/` is git-ignored.

## What is not known, and what will sound synthetic

- Nothing here has been heard. Loudness, peaks, silence, timing and the
  spectrum were measured; whether it is pleasant was not.
- synth: the piano is the weakest part. It has no soundboard, no sympathetic
  resonance and identical character on every note, so expect an electric-piano
  or music-box quality rather than a real piano. The mallet and bell should
  pass as a soft marimba and glockenspiel. The pad is a plain synth pad. The
  top end is deliberately dark (little above 5 kHz apart from the shaker).
- sampled: real recordings, but a 32 MB General MIDI set: the piano is
  recognisably a GM piano, and repeated mallet notes use the same sample each
  time, which can sound mechanical. The Warm Pad opens slowly by itself, so
  the quick pad entries at 0.0, 7.0 and 34.5 s are softer than in the synth
  version (the piano and bass carry those moments).
- Both: velocities are fixed per phrase with no human timing, so the playing
  is exactly on the grid.
- The chord landings (7.0, 34.5 and 38.0 s) measure 3-5 dB above the groove in
  plain RMS; much of that is low D in the bass.
