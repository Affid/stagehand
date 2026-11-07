// Dev aid for the Android spike (docs/ANDROID-SPIKE.md): drives the spike
// app's WebView with Playwright's Android support, through the adb server on
// 127.0.0.1:5037 (Windows' adb, reached from WSL by mirrored networking;
// plain connectOverCDP fails on a WebView: no browser contexts). The probe
// in the app reports to logcat (tag MLSPIKE); this script only moves the
// page.
// Usage: node scripts/dev/android-spike.ts <login|game>
//   login: admin login on the app's Foundry origin, then Setup.
//   game:  the test world with the companion on, launched and joined as the
//          Gamemaster in the app, then shut down again.
import { _android, type AndroidDevice, type Page } from "@playwright/test";
import {
  createAdminClient,
  launchWorld,
  loginAsAdmin,
  shutdownWorld,
} from "../foundry/admin.ts";
import { loadFoundryEnv } from "../foundry/env.ts";
import { resetWorldModules } from "../foundry/reset-world.ts";
import { TEST_WORLD } from "../foundry/world.ts";

const PKG = "dev.modulelibrary.spike";
const OUT = "test-results/screens";
const env = loadFoundryEnv();
const step = process.argv[2];

async function appPage(): Promise<{ device: AndroidDevice; page: Page }> {
  const [device] = await _android.devices({ port: 5037 });
  if (!device) throw new Error("No Android device on adb");
  const webView = await device.webView({ pkg: PKG });
  return { device, page: await webView.page() };
}

/** Admin login inside the WebView, so its cookie is the app's. */
async function login(page: Page): Promise<void> {
  const origin = new URL(page.url()).origin;
  const status = await page.evaluate(async (password) => {
    const body = new URLSearchParams({
      action: "adminAuth",
      adminPassword: password,
    });
    const r = await fetch("/auth", { method: "POST", body });
    return r.status;
  }, env.adminPassword);
  await page.goto(`${origin}/setup`);
  await page.waitForLoadState("load");
  await page.screenshot({ path: `${OUT}/android-setup.png` });
  console.log(
    `login ${String(status)}, now at ${new URL(page.url()).pathname}`,
  );
}

/** Foundry's join form hides its Join button at phone width: submit it. */
async function join(page: Page, origin: string, user: string): Promise<void> {
  await page.goto(`${origin}/join`);
  const form = page.locator("#join-game-form");
  await form.locator('select[name="userId"]').selectOption({ label: user });
  await form.evaluate((f: HTMLFormElement) => {
    f.requestSubmit(f.querySelector<HTMLButtonElement>('button[name="join"]'));
  });
  await page.waitForURL(/\/game$/, { timeout: 60_000 });
}

async function game(page: Page): Promise<void> {
  const origin = new URL(page.url()).origin;
  await resetWorldModules(env);
  const api = await createAdminClient(env.url);
  try {
    await loginAsAdmin(api, env.adminPassword, `${env.dataDir}/Config`);
    await launchWorld(api, TEST_WORLD.id);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message.slice(0, 160)));
    page.on("console", (m) => {
      if (/module.library|companion/i.test(m.text()))
        errors.push(`console ${m.type()}: ${m.text().slice(0, 160)}`);
    });
    await join(page, origin, "Gamemaster");
    const state = await page
      .waitForFunction(
        () => {
          const g = (window as unknown as { game?: { ready?: boolean } }).game;
          return g?.ready ? true : null;
        },
        null,
        { timeout: 90_000 },
      )
      .then(() => "ready")
      .catch(() => "not ready after 90 s");
    const companion = await page.evaluate(
      () =>
        (
          window as unknown as {
            game?: {
              modules?: { get(id: string): { active?: boolean } | undefined };
            };
          }
        ).game?.modules?.get("module-library")?.active ?? "unknown",
    );
    console.log(`game ${state}; companion active: ${String(companion)}`);
    console.log(
      await page.evaluate(() => {
        const g = (
          window as unknown as {
            game: { user: { role: number; name: string } };
          }
        ).game;
        window.postMessage(
          {
            ns: "module-library",
            v: 1,
            from: "module",
            type: "PROBE_TEST",
            payload: {},
          },
          location.origin,
        );
        return `user ${g.user.name} role ${String(g.user.role)}`;
      }),
    );
    console.log(`page errors: ${errors.slice(0, 5).join(" | ") || "none"}`);
    await page.waitForTimeout(8000);
    await page.screenshot({ path: `${OUT}/android-game.png` });
    console.log(`joined, now at ${new URL(page.url()).pathname}`);
  } finally {
    await shutdownWorld(api, env.adminPassword);
    await api.dispose();
    await page.goto(`${origin}/setup`).catch(() => undefined);
  }
}

const { device, page } = await appPage();
try {
  if (step === "login") await login(page);
  else if (step === "game") await game(page);
  else console.error("Usage: node scripts/dev/android-spike.ts <login|game>");
} finally {
  await device.close();
}
