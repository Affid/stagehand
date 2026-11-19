// @vitest-environment happy-dom
// Module Management's take-over: who gets the library view, reading the
// library file, and keeping Foundry's own save from writing our view as an
// empty module list (docs/IN-WORLD-LIBRARY-PLAN.md, "Keeping Foundry's save
// safe").
import { emptyLibrary, type Library } from "@stagehand/shared/library/schema";
import { serializeSyncFile } from "@stagehand/shared/library/sync-file";
import { describe, expect, it, vi } from "vitest";
import { guardSave } from "../src/manage/guard.ts";
import { readWorldLibrary } from "../src/manage/library.ts";
import { takesOver } from "../src/manage/take-over.ts";

const fileText = (library: Library): string =>
  serializeSyncFile(
    { side: { library, sorted: [] }, id: "f1", history: [] },
    "2026-11-19T10:00:00.000Z",
  );

const respond = (status: number, body = ""): Response =>
  new Response(status === 404 ? null : body, { status });

describe("readWorldLibrary", () => {
  const route = (path: string) => `/prefix/${path}`;

  it("reads the library file from the server's Data folder", async () => {
    // Arrange
    const library = { ...emptyLibrary("x"), folders: [] };
    const fetch = vi.fn(() => Promise.resolve(respond(200, fileText(library))));

    // Act
    const read = await readWorldLibrary({ fetch, route, log: vi.fn() });

    // Assert
    expect(fetch).toHaveBeenCalledWith(
      "/prefix/stagehand/library.json",
      expect.objectContaining({ cache: "no-store" }),
    );
    expect(read?.schemaVersion).toBe(library.schemaVersion);
  });

  it("has no library when the file is missing, and says nothing", async () => {
    const log = vi.fn();
    const fetch = vi.fn(() => Promise.resolve(respond(404)));

    const read = await readWorldLibrary({ fetch, route, log });

    expect(read).toBeUndefined();
    expect(log).not.toHaveBeenCalled();
  });

  it("has no library when the file is not a library, and logs why", async () => {
    const log = vi.fn();
    const fetch = vi.fn(() => Promise.resolve(respond(200, '{"x":1}')));

    const read = await readWorldLibrary({ fetch, route, log });

    expect(read).toBeUndefined();
    expect(log).toHaveBeenCalledWith(expect.stringContaining("invalid"));
  });

  it("stops reading a file past the size cap, even without its length", async () => {
    const log = vi.fn();
    const chunk = new TextEncoder().encode("x".repeat(64));
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(chunk);
      },
    });
    const fetch = vi.fn(() => Promise.resolve(new Response(body)));

    const read = await readWorldLibrary({ fetch, route, log, maxChars: 1000 });

    expect(read).toBeUndefined();
    expect(log).toHaveBeenCalledWith(expect.stringContaining("too big"));
  });

  it("has no library when the server refuses or the request fails", async () => {
    const log = vi.fn();
    const refused = vi.fn(() => Promise.resolve(respond(403)));
    const failed = vi.fn(() => Promise.reject(new Error("offline")));

    const a = await readWorldLibrary({ fetch: refused, route, log });
    const b = await readWorldLibrary({ fetch: failed, route, log });

    expect(a).toBeUndefined();
    expect(b).toBeUndefined();
    expect(log).toHaveBeenCalledTimes(2);
  });
});

describe("takesOver", () => {
  const base = {
    isGM: true,
    settingOn: true,
    generation: 14,
    hasLibrary: true,
    hasContent: true,
  };

  it("takes over for a Gamemaster with a library and the setting on", () => {
    expect(takesOver(base)).toBe(true);
  });

  it.each([
    ["a player", { isGM: false }],
    ["the setting off", { settingOn: false }],
    ["no library", { hasLibrary: false }],
    ["a window without its content part", { hasContent: false }],
    ["Foundry 12", { generation: 12 }],
    ["Foundry 15", { generation: 15 }],
  ])("leaves Foundry's window alone with %s", (_why, change) => {
    expect(takesOver({ ...base, ...change })).toBe(false);
  });
});

function fakeWindow() {
  const form = document.createElement("form");
  const handler = vi.fn();
  const foundrySubmit = vi.fn((e: Event) => {
    e.preventDefault();
    void handler();
  });
  form.addEventListener("submit", foundrySubmit);
  const app = { options: { form: { handler, closeOnSubmit: true } } };
  document.body.append(form);
  return { app, form, handler, foundrySubmit };
}

describe("guardSave", () => {
  it("stops Foundry's handler on a submit and opens our review instead", () => {
    // Arrange
    const w = fakeWindow();
    const review = vi.fn();
    guardSave(w.app, w.form, { review, active: () => true });

    // Act
    w.form.dispatchEvent(new Event("submit", { cancelable: true }));

    // Assert
    expect(w.foundrySubmit).not.toHaveBeenCalled();
    expect(review).toHaveBeenCalledTimes(1);
  });

  it("sends a save from code (app.submit) to our review", async () => {
    const w = fakeWindow();
    const review = vi.fn();
    guardSave(w.app, w.form, { review, active: () => true });

    await w.app.options.form.handler();

    expect(w.handler).not.toHaveBeenCalled();
    expect(review).toHaveBeenCalledTimes(1);
  });

  it("guards a window once, however often Foundry draws it", () => {
    const w = fakeWindow();
    const review = vi.fn();
    guardSave(w.app, w.form, { review, active: () => true });
    guardSave(w.app, w.form, { review, active: () => true });

    w.form.dispatchEvent(new Event("submit", { cancelable: true }));

    expect(review).toHaveBeenCalledTimes(1);
  });

  it("lets Foundry save while the window shows Foundry's own list", async () => {
    // Arrange: our view isn't in the window (not loaded, or the setting off)
    const w = fakeWindow();
    const review = vi.fn();
    guardSave(w.app, w.form, { review, active: () => false });

    // Act
    w.form.dispatchEvent(new Event("submit", { cancelable: true }));
    await w.app.options.form.handler();

    // Assert
    expect(review).not.toHaveBeenCalled();
    expect(w.foundrySubmit).toHaveBeenCalledTimes(1);
    expect(w.handler).toHaveBeenCalledTimes(2);
  });

  it("still stops submits when the handler can't be replaced", () => {
    const w = fakeWindow();
    Object.freeze(w.app.options.form);
    const review = vi.fn();

    const replaced = guardSave(w.app, w.form, { review, active: () => true });
    w.form.dispatchEvent(new Event("submit", { cancelable: true }));

    expect(replaced).toBe(false);
    expect(w.foundrySubmit).not.toHaveBeenCalled();
    expect(review).toHaveBeenCalledTimes(1);
  });
});
