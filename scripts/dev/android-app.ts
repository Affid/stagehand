// Dev aid for the Android app (docs/ANDROID-APP-PLAN.md, phase 4): drives
// the debug app's WebViews with Playwright's Android support, through the
// adb server on 127.0.0.1:5037 (Windows' adb, reached from WSL). The app
// must be installed and started; the local Foundry running.
// Usage: node scripts/dev/android-app.ts <step>
//   add:    on the home screen, add the emulator's address of the server
//   open:   tap the server on the home screen (Setup, or Foundry's login)
//   login:  admin login inside the server WebView, then Setup
//   shot:   a screenshot of what the app shows, as <name>.png
//   pages:  the WebViews' pages
import { _android, type AndroidDevice, type Page } from "@playwright/test";
import { loadFoundryEnv } from "../foundry/env.ts";

const PKG = process.env.ML_APP_PKG ?? "io.github.affid.stagehand.debug";
/** The local Foundry as the emulator reaches it. */
const SERVER = process.env.ML_APP_SERVER ?? "http://10.0.2.2:30000";
const OUT = "test-results/screens";
const HOME = "https://appassets.androidplatform.net/home.html";

async function connect(): Promise<{ device: AndroidDevice; pages: Page[] }> {
  const [device] = await _android.devices({ port: 5037 });
  if (!device) throw new Error("No Android device on adb");
  const webView = await device.webView({ pkg: PKG });
  const first = await webView.page();
  return { device, pages: first.context().pages() };
}

function pageAt(pages: Page[], start: string): Page {
  const found = pages.find((p) => p.url().startsWith(start));
  if (!found)
    throw new Error(
      `No page at ${start}: ${pages.map((p) => p.url()).join(", ")}`,
    );
  return found;
}

async function add(pages: Page[]): Promise<void> {
  const home = pageAt(pages, HOME);
  await home.getByLabel("Server address").fill(SERVER);
  await home.getByRole("button", { name: "Add", exact: true }).click();
  await home
    .getByRole("link", { name: `Open ${new URL(SERVER).host}` })
    .waitFor();
  console.log("added", SERVER);
}

async function open(pages: Page[]): Promise<void> {
  const home = pageAt(pages, HOME);
  // The app takes the navigation over (native opens the server WebView).
  await home
    .getByRole("link", { name: `Open ${new URL(SERVER).host}` })
    .click({ noWaitAfter: true });
  console.log("opened", SERVER);
}

async function login(pages: Page[]): Promise<void> {
  const env = loadFoundryEnv();
  const server = pageAt(pages, SERVER);
  const status = await server.evaluate(async (password) => {
    const body = new URLSearchParams({
      action: "adminAuth",
      adminPassword: password,
    });
    return (await fetch("/auth", { method: "POST", body })).status;
  }, env.adminPassword);
  await server.goto(`${SERVER}/setup`);
  await server
    .locator("#ml-shell-root .mls-top, #ml-shell-root .mlp-top")
    .first()
    .waitFor();
  console.log(`login ${String(status)}, Setup is ours`);
}

async function shot(device: AndroidDevice, name: string): Promise<void> {
  await device.screenshot({ path: `${OUT}/${name}.png` });
  console.log(`${OUT}/${name}.png`);
}

const step = process.argv[2];
const { device, pages } = await connect();
try {
  if (step === "add") await add(pages);
  else if (step === "open") await open(pages);
  else if (step === "login") await login(pages);
  else if (step === "shot")
    await shot(device, process.argv[3] ?? "android-app");
  else if (step === "pages")
    pages.forEach((p) => {
      console.log(p.url());
    });
  else throw new Error(`Unknown step ${String(step)}`);
} finally {
  await device.close();
}
