// Native UI on an Android device, for the on-device suite (Android plan,
// phase 5): adb (Windows' adb.exe, reached from WSL) and uiautomator, for
// what isn't in a WebView: system pickers, the app's dialogs, taps that
// must be real (outside links). Every adb call names the device.
import { execFileSync } from "node:child_process";

const ADB =
  process.env.ML_ADB ?? "/mnt/c/Users/fagot/Android/Sdk/platform-tools/adb.exe";

/** The device every call goes to: ML_ANDROID_SERIAL, else the only one. */
function serial(): string {
  if (process.env.ML_ANDROID_SERIAL) return process.env.ML_ANDROID_SERIAL;
  const lines = execFileSync(ADB, ["devices"])
    .toString()
    .split(/\r?\n/)
    .slice(1)
    .map((l) => l.trim().split(/\s+/))
    .filter(([, state]) => state === "device")
    .map(([id]) => id ?? "");
  if (lines.length !== 1)
    throw new Error(
      `Set ML_ANDROID_SERIAL: adb sees ${String(lines.length)} devices (${lines.join(", ")})`,
    );
  const [only = ""] = lines;
  process.env.ML_ANDROID_SERIAL = only;
  return only;
}

export const deviceSerial = serial;

export function adb(...args: string[]): string {
  return execFileSync(ADB, ["-s", serial(), ...args], {
    maxBuffer: 64 * 1024 * 1024,
  }).toString();
}

/** adb with `input` on its stdin (adb shell passes it on). */
export function adbWithInput(input: string, ...args: string[]): string {
  return execFileSync(ADB, ["-s", serial(), ...args], {
    input,
    maxBuffer: 1024 * 1024,
  }).toString();
}

interface ViewNode {
  readonly text: string;
  readonly desc: string;
  readonly id: string;
  readonly bounds: readonly [number, number, number, number];
}

/** The screen's view tree, as uiautomator dumps it. */
export function nodes(): ViewNode[] {
  try {
    adb("shell", "uiautomator", "dump", "/sdcard/ml-ui.xml");
  } catch (error: unknown) {
    // uiautomator sometimes exits 137 after writing the dump.
    const stdout =
      error instanceof Error && "stdout" in error ? error.stdout : undefined;
    const out =
      typeof stdout === "string" || Buffer.isBuffer(stdout)
        ? stdout.toString()
        : "";
    if (!out.includes("dumped")) throw error;
  }
  const xml = adb("shell", "cat", "/sdcard/ml-ui.xml");
  return [...xml.matchAll(/<node [^>]*>/g)].flatMap((m): ViewNode[] => {
    const attr = (name: string): string =>
      new RegExp(`${name}="([^"]*)"`).exec(m[0])?.[1] ?? "";
    const b = /\[(\d+),(\d+)\]\[(\d+),(\d+)\]/.exec(attr("bounds"));
    // A view without bounds can't be tapped: left out.
    if (!b) return [];
    return [
      {
        text: attr("text"),
        desc: attr("content-desc"),
        id: attr("resource-id"),
        bounds: [Number(b[1]), Number(b[2]), Number(b[3]), Number(b[4])],
      },
    ];
  });
}

export const sleep = (ms: number) =>
  new Promise<void>((r) => {
    setTimeout(r, ms);
  });

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
    await sleep(500);
  }
  throw new Error(`No ${String(match)} on screen`);
}

/** Until a view whose text or description matches is on screen. */
export async function waitNative(
  match: RegExp,
  timeoutMs = 15_000,
): Promise<void> {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    if (onScreen(match)) return;
    await sleep(500);
  }
  throw new Error(`No ${String(match)} on screen`);
}

/** Whether a view with this text or description is on screen now. */
export function onScreen(match: RegExp): boolean {
  return nodes().some((n) => match.test(n.text) || match.test(n.desc));
}

/** The app's visible WebView's top-left on screen, in device pixels. */
export function webViewOrigin(): readonly [number, number] {
  const tall = nodes().filter(
    (n) => n.id === "" && n.bounds[3] - n.bounds[1] > 500,
  );
  const web = tall.find((n) => n.bounds[1] > 0) ?? tall[0];
  return web ? [web.bounds[0], web.bounds[1]] : [0, 0];
}

/** The app in front: its package's activity has the focus. */
export function focused(): string {
  return (
    /mCurrentFocus=Window\{\S+ \S+ ([^/}\s]+)/.exec(
      adb("shell", "dumpsys", "window"),
    )?.[1] ?? ""
  );
}
