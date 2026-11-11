// The measuring and encoding that ffmpeg does for us: EBU R128 loudness and
// true peak, AAC copies for easy listening, spectrogram pictures.

import { spawnSync } from "node:child_process";

function run(command, args) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error)
    throw new Error(`${command} could not start: ${result.error.message}`);
  if (result.status !== 0)
    throw new Error(`${command} failed:\n${result.stderr.slice(-2000)}`);
  return result;
}

function numberAfter(text, label) {
  const match = new RegExp(`${label}\\s*(-?[\\d.]+|-inf)`).exec(text);
  if (!match) throw new Error(`ffmpeg's loudness summary has no "${label}"`);
  return match[1] === "-inf" ? -Infinity : Number(match[1]);
}

/** Integrated loudness (LUFS), loudness range (LU) and true peak (dBFS). */
export function measureLoudness(path) {
  const args = [
    "-hide_banner",
    "-nostats",
    "-i",
    path,
    "-af",
    "ebur128=peak=true",
    "-f",
    "null",
    "-",
  ];
  const { stderr } = run("ffmpeg", args);
  const summary = stderr.slice(stderr.lastIndexOf("Summary:"));
  return {
    integrated: numberAfter(summary, "I:"),
    range: numberAfter(summary, "LRA:"),
    truePeak: numberAfter(summary, "Peak:"),
  };
}

export function probe(path) {
  const args = [
    "-v",
    "error",
    "-show_entries",
    "stream=sample_rate,channels,codec_name,duration",
    "-of",
    "json",
    path,
  ];
  return JSON.parse(run("ffprobe", args).stdout).streams[0];
}

export function encodeAac(wavPath, m4aPath) {
  run("ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-i",
    wavPath,
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    m4aPath,
  ]);
}

export function spectrogram(wavPath, pngPath) {
  const picture = "showspectrumpic=s=1600x600:legend=1";
  run("ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-i",
    wavPath,
    "-lavfi",
    picture,
    pngPath,
  ]);
}
