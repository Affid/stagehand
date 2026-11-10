// The app on a device, for the on-device suite (Android plan, phase 5):
// installed fresh, its WebView pages found through Playwright's Android
// support (Windows' adb server on 127.0.0.1:5037), screenshots per device
// and theme. A connection doesn't see WebView pages that appear after it
// was made (seen on the emulator), so pages are looked for again on a new
// connection; a page kept across navigations keeps its connection.
import { copyFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { _android, type AndroidDevice, type Page } from "@playwright/test";
import { adb, adbWithInput, deviceSerial, sleep } from "./native-ui.ts";

const ROOT = join(import.meta.dirname, "..", "..");
export const PKG = "io.github.affid.stagehand.debug";
const ACTIVITY = `${PKG}/dev.modulelibrary.app.MainActivity`;
const APK = join(
  ROOT,
  "packages/android/app/build/outputs/apk/debug/app-debug.apk",
);
/** Where Windows' adb reads the APK: the same folder seen from WSL and from Windows. */
const APK_DIR = process.env.ML_APK_DIR ?? "/mnt/c/Users/fagot/ml-apk";
const APK_WIN =
  process.env.ML_APK_WIN ?? "C:\\Users\\fagot\\ml-apk\\app-debug.apk";

/** The local Foundry as the device reaches it (the emulator: the host). */
export const SERVER = process.env.ML_APP_SERVER ?? "http://10.0.2.2:30000";
export const HOME = "https://appassets.androidplatform.net/home.html";
export const SCREENS = join(ROOT, "test-results/screens/android");

/** The debug app with no data, past the WebView notice, started. */
export function installFresh(): void {
  copyFileSync(APK, join(APK_DIR, "app-debug.apk"));
  adb("install", "-r", APK_WIN);
  adb("shell", "pm", "clear", PKG);
  // An old WebView gets the app's notice once per version (phase 4 checks
  // it by hand); the suite starts past it: a debug build lets run-as write
  // the app's setting. The version is only digits and dots.
  const version =
    /Current WebView package \(name, version\): \([^,]+, ([\w.-]+)\)/.exec(
      adb("shell", "dumpsys", "webviewupdate"),
    )?.[1];
  if (version) {
    const prefs = `<?xml version='1.0' encoding='utf-8' standalone='yes' ?><map><string name="webviewWarnedFor">${version}</string></map>`;
    adb("shell", "run-as", PKG, "mkdir", "-p", "shared_prefs");
    adbWithInput(
      prefs,
      "shell",
      "run-as",
      PKG,
      "sh",
      "-c",
      "'cat > shared_prefs/app.xml'",
    );
  }
  start();
}

export function start(): void {
  adb("shell", "am", "start", "-n", ACTIVITY);
}

export function stop(): void {
  adb("shell", "am", "force-stop", PKG);
}

/** A short name for the device, for screenshot folders. */
export const deviceName = (): string =>
  deviceSerial().replace(/[^\w.-]+/g, "_");

export class App {
  private device: AndroidDevice | undefined;

  /** The adb device, connected again whenever pages are looked for anew. */
  async connect(): Promise<AndroidDevice> {
    if (this.device) return this.device;
    const all = await _android.devices({ port: 5037 });
    const wanted = deviceSerial();
    const found = all.find((d) => d.serial() === wanted);
    if (!found) throw new Error(`Playwright doesn't see ${wanted}`);
    await Promise.all(all.filter((d) => d !== found).map((d) => d.close()));
    this.device = found;
    return found;
  }

  /** The app's WebView page whose address starts with `start`. */
  async pageAt(start: string, timeoutMs = 30_000): Promise<Page> {
    const end = Date.now() + timeoutMs;
    while (Date.now() < end) {
      const found = await this.findPage(start, end - Date.now());
      if (found) return found;
      await this.close();
      await sleep(1_000);
    }
    throw new Error(`No app page at ${start}`);
  }

  /** The page on this connection, if there; none if the app's WebView isn't up yet. */
  private async findPage(
    start: string,
    timeoutMs: number,
  ): Promise<Page | undefined> {
    const device = await this.connect();
    try {
      const view = await device.webView(
        { pkg: PKG },
        { timeout: Math.max(1_000, timeoutMs) },
      );
      const first = await view.page();
      return first
        .context()
        .pages()
        .find((p) => p.url().startsWith(start));
    } catch {
      return undefined;
    }
  }

  /** A screenshot of the whole screen, by device and theme. */
  async shot(name: string, theme = "dark"): Promise<void> {
    const dir = join(SCREENS, deviceName(), theme);
    mkdirSync(dir, { recursive: true });
    const device = await this.connect();
    await device.screenshot({ path: join(dir, `${name}.png`) });
  }

  async close(): Promise<void> {
    const device = this.device;
    this.device = undefined;
    await device?.close();
  }
}
