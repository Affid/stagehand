// Dev aid for the Android app (phase 4): native UI on the emulator, found
// with uiautomator and tapped with adb (system pickers and dialogs aren't
// in a WebView). Used by scripts/dev/android-app.ts.
import { execFileSync } from "node:child_process";

const ADB =
  process.env.ML_ADB ?? "/mnt/c/Users/fagot/Android/Sdk/platform-tools/adb.exe";

export function adb(...args: string[]): string {
  return execFileSync(ADB, args, { maxBuffer: 64 * 1024 * 1024 }).toString();
}

/** adb with `input` on its stdin (adb shell passes it on). */
export function adbWithInput(input: string, ...args: string[]): string {
  return execFileSync(ADB, args, { input, maxBuffer: 1024 * 1024 }).toString();
}

interface Node {
  readonly text: string;
  readonly desc: string;
  readonly id: string;
  readonly bounds: [number, number, number, number];
}

/** The screen's view tree, as uiautomator dumps it. */
export function nodes(): Node[] {
  try {
    adb("shell", "uiautomator", "dump", "/sdcard/ml-ui.xml");
  } catch (error: unknown) {
    // uiautomator sometimes exits 137 after writing the dump.
    const stdout = (error as { stdout?: Buffer | string }).stdout;
    const out = stdout === undefined ? "" : stdout.toString();
    if (!out.includes("dumped")) throw error;
  }
  const xml = adb("shell", "cat", "/sdcard/ml-ui.xml");
  return [...xml.matchAll(/<node [^>]*>/g)].map((m) => {
    const attr = (name: string): string =>
      new RegExp(`${name}="([^"]*)"`).exec(m[0])?.[1] ?? "";
    const b = /\[(\d+),(\d+)\]\[(\d+),(\d+)\]/.exec(attr("bounds")) ?? [];
    return {
      text: attr("text"),
      desc: attr("content-desc"),
      id: attr("resource-id"),
      bounds: [Number(b[1]), Number(b[2]), Number(b[3]), Number(b[4])],
    };
  });
}

/** Waits for a view whose text or description matches, then taps it. */
export async function tapNative(
  match: RegExp,
  timeoutMs = 15_000,
): Promise<string> {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    const hit = nodes().find((n) => match.test(n.text) || match.test(n.desc));
    if (hit) {
      const [l, t, r, b] = hit.bounds;
      adb("shell", "input", "tap", String((l + r) >> 1), String((t + b) >> 1));
      return hit.text || hit.desc;
    }
    await new Promise((res) => setTimeout(res, 500));
  }
  throw new Error(`No ${String(match)} on screen`);
}

/** Whether a view with this text is on screen now. */
export function onScreen(match: RegExp): boolean {
  return nodes().some((n) => match.test(n.text) || match.test(n.desc));
}

/** The server WebView's top-left on screen, in device pixels. */
export function webViewOrigin(): [number, number] {
  const views = nodes().filter(
    (n) => n.id === "" && n.bounds[3] - n.bounds[1] > 500,
  );
  const web = views.find((n) => n.bounds[1] > 0) ?? views[0];
  return web ? [web.bounds[0], web.bounds[1]] : [0, 0];
}
