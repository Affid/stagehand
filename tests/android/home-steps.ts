// The home screen's steps of the on-device suite (Android plan, phase 6):
// adding a server without typing http, a server's sheet (rename, a new
// address that keeps its library, Back closing it, removal).
import { expect, type Page } from "@playwright/test";
import { type App, HOME, PKG, SERVER } from "./app.ts";
import { adb } from "./native-ui.ts";

/** The address as typed on home: the protocol comes from the toggle. */
export const TYPED = SERVER.replace(/^https?:\/\//, "");

/** Whether the app is still the one on screen (Back didn't leave it). */
export function appInFront(): boolean {
  return adb("shell", "dumpsys", "activity", "activities")
    .split("\n")
    .some((l) => l.includes("ResumedActivity") && l.includes(PKG));
}

/** On home: Add a server, the address typed, Foundry found, Add and open. */
export async function addFromHome(app: App): Promise<void> {
  const home = await app.pageAt(HOME);
  await home.getByRole("button", { name: "Add a server" }).click();
  if (SERVER.startsWith("https:"))
    await home.getByRole("button", { name: "https" }).click();
  await home.getByLabel("Address").fill(TYPED);
  await expect(home.getByText(/^Foundry [\d.]+ answers at /)).toBeVisible({
    timeout: 15_000,
  });
  await app.shot("home-add");
  // Opened right after the add: native takes it as the tap's (no navigation
  // for Playwright to wait on).
  await home
    .getByRole("button", { name: "Add and open" })
    .click({ noWaitAfter: true });
}

/** The server's sheet from its card's ⋮. */
async function sheetOf(home: Page, label: string): Promise<void> {
  await home.getByRole("button", { name: `Edit or remove ${label}` }).click();
  await expect(home.getByRole("dialog")).toBeVisible();
}

async function readdress(home: Page, label: string, typed: string) {
  await sheetOf(home, label);
  await home.getByLabel("Address").fill(typed);
  await expect(home.locator(".sth-check:not(.sth-wait)")).toBeVisible({
    timeout: 15_000,
  });
}

/** Renamed; Back closes the sheet and stays in the app. */
export async function renameAndBack(app: App, home: Page): Promise<void> {
  await expect(home.getByText(/^Opened /)).toBeVisible();
  await app.shot("home");
  await sheetOf(home, TYPED);
  await home.getByLabel("Name").fill("Emulator host");
  await home.getByRole("button", { name: "Save" }).click();
  await expect(home.getByText("Emulator host")).toBeVisible();
  await sheetOf(home, "Emulator host");
  await app.shot("home-server");
  adb("shell", "input", "keyevent", "4");
  await expect(home.getByRole("dialog")).toHaveCount(0);
  expect(appInFront()).toBe(true);
}

/** A new address (nothing answers there), then the real one again. */
export async function moveAndBack(app: App, home: Page): Promise<void> {
  await readdress(home, "Emulator host", "127.0.0.1:30000");
  await expect(home.locator(".sth-check.sth-warn")).toBeVisible();
  await home.getByRole("button", { name: "Save" }).click();
  await expect(home.getByText("127.0.0.1:30000")).toBeVisible();
  await readdress(home, "Emulator host", TYPED);
  await expect(home.getByText(/^Foundry [\d.]+ answers at /)).toBeVisible();
  await app.shot("home-readdress");
  await home.getByRole("button", { name: "Save" }).click();
  await expect(home.getByText(TYPED)).toBeVisible();
}

/** Removed after asking: home is empty again. */
export async function removeFromHome(app: App, home: Page): Promise<void> {
  await sheetOf(home, "Emulator host");
  await home.getByRole("button", { name: "Remove this server…" }).click();
  await app.shot("home-remove");
  await home.getByRole("button", { name: "Remove", exact: true }).click();
  await expect(home.getByText("Your Foundry servers")).toBeVisible();
  await app.shot("home-empty");
}
