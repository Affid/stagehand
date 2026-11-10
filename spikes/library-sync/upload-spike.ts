// Spike: can Setup (admin session, no world running) keep a library file in
// the server's Data folder? Run against a private server only:
//   node spikes/library-sync/upload-spike.ts http://localhost:30014 ~/foundry/data-14spike/Config
import { chromium } from "@playwright/test";
import { loginAsAdmin } from "../../scripts/foundry/admin.ts";
import { readEnv } from "../../scripts/foundry/env.ts";

const [url = "http://localhost:30014", configDir = ""] = process.argv.slice(2);
const FOLDER = "stagehand-spike";
const NAME = "library.json";

interface Step {
  readonly step: string;
  readonly result: unknown;
}

async function main(): Promise<void> {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    baseURL: url,
    extraHTTPHeaders: { Origin: url },
  });
  await loginAsAdmin(
    context.request,
    readEnv("FOUNDRY_ADMIN_PASSWORD"),
    configDir.replace(/^~/, process.env.HOME ?? ""),
  );
  const page = await context.newPage();
  await page.goto(`${url}/setup`);
  await page.waitForFunction(() => "game" in globalThis);
  // Right after a server start the page's socket is not up yet; folder
  // creation goes through it (cold-start run, 2026-11-10).
  const started = Date.now();
  await page.waitForFunction(
    () =>
      (globalThis as { game?: { socket?: { connected?: boolean } } }).game
        ?.socket?.connected === true,
    undefined,
    { timeout: 30_000 },
  );
  console.log("socket connected after ms", Date.now() - started);

  const steps = await page.evaluate(
    async ({ folder, name }) => {
      const out: { step: string; result: unknown }[] = [];
      const upload = async (target: string, body: object) => {
        const form = new FormData();
        form.set("source", "data");
        form.set("target", target);
        form.set(
          "upload",
          new File([JSON.stringify(body)], name, { type: "application/json" }),
        );
        const response = await fetch("/upload", { method: "POST", body: form });
        return { status: response.status, body: await response.json() };
      };
      const read = async (path: string) => {
        const response = await fetch(`/${path}?t=${Date.now()}`, {
          credentials: "omit",
        });
        return {
          status: response.status,
          cache: response.headers.get("cache-control"),
          type: response.headers.get("content-type"),
          text: response.ok ? await response.text() : null,
        };
      };
      out.push({
        step: "upload to missing folder",
        result: await upload(folder, { n: 0 }),
      });
      const g = globalThis as unknown as {
        foundry?: {
          applications?: {
            apps?: { FilePicker?: { implementation?: unknown } };
          };
        };
        FilePicker?: unknown;
      };
      const picker = (g.foundry?.applications?.apps?.FilePicker
        ?.implementation ?? g.FilePicker) as
        | { createDirectory: (s: string, t: string) => Promise<unknown> }
        | undefined;
      out.push({ step: "FilePicker on Setup", result: Boolean(picker) });
      try {
        out.push({
          step: "create folder",
          result: await picker?.createDirectory("data", folder),
        });
      } catch (error) {
        out.push({ step: "create folder", result: String(error) });
      }
      try {
        out.push({
          step: "create folder again",
          result: await picker?.createDirectory("data", folder),
        });
      } catch (error) {
        out.push({ step: "create folder again", result: String(error) });
      }
      out.push({
        step: "first upload",
        result: await upload(folder, { n: 1 }),
      });
      out.push({
        step: "read, no cookies",
        result: await read(`${folder}/${name}`),
      });
      out.push({ step: "overwrite", result: await upload(folder, { n: 2 }) });
      out.push({
        step: "read after overwrite",
        result: await read(`${folder}/${name}`),
      });
      return out;
    },
    { folder: FOLDER, name: NAME },
  );
  steps.forEach((s: Step) => console.log(s.step, JSON.stringify(s.result)));

  const outsider = await chromium.launch();
  const anon = await outsider.newPage();
  const response = await anon.goto(`${url}/${FOLDER}/${NAME}`);
  console.log("logged-out browser", response?.status(), await response?.text());
  await outsider.close();
  await browser.close();
}

await main();
