import { describe, expect, test, vi } from "vitest";
import {
  type LibraryFileDeps,
  readLibraryFile,
  writeLibraryFile,
} from "../../src/page/library-file.ts";

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

function deps(over: Partial<LibraryFileDeps> = {}) {
  const fetch = vi.fn<LibraryFileDeps["fetch"]>(() =>
    Promise.resolve(json({ status: "success" })),
  );
  const createDirectory = vi.fn<LibraryFileDeps["createDirectory"]>(() =>
    Promise.resolve("ok"),
  );
  return {
    fetch,
    createDirectory,
    route: (path: string) => `/prefix/${path}`,
    socketReady: () => true,
    sleep: () => Promise.resolve(),
    ...over,
  } satisfies LibraryFileDeps;
}

describe("reading the library file", () => {
  test("fetches it fresh from the server's Data folder", async () => {
    const d = deps({
      fetch: vi.fn(() => Promise.resolve(new Response('{"a":1}'))),
    });
    expect(await readLibraryFile(d)).toEqual({ text: '{"a":1}' });
    expect(d.fetch).toHaveBeenCalledWith("/prefix/stagehand/library.json", {
      cache: "no-store",
      credentials: "same-origin",
    });
  });

  test("a missing file is not an error", async () => {
    const d = deps({
      fetch: vi.fn(() =>
        Promise.resolve(new Response("nope", { status: 404 })),
      ),
    });
    expect(await readLibraryFile(d)).toEqual({ missing: true });
  });

  test("another HTTP failure is an error", async () => {
    const d = deps({
      fetch: vi.fn(() => Promise.resolve(new Response("", { status: 500 }))),
    });
    expect(await readLibraryFile(d)).toEqual({
      error: "Foundry answered HTTP 500.",
    });
  });

  test("a network failure is an error", async () => {
    const d = deps({
      fetch: vi.fn(() => Promise.reject(new Error("offline"))),
    });
    expect(await readLibraryFile(d)).toEqual({ error: "offline" });
  });

  test("refuses an oversized file by its length header", async () => {
    const big = new Response("x", {
      headers: { "content-length": "999999999" },
    });
    const d = deps({ fetch: vi.fn(() => Promise.resolve(big)) });
    expect(await readLibraryFile(d)).toEqual({
      error: "The library file on the server is too big.",
    });
  });
});

describe("writing the library file", () => {
  test("uploads it as Foundry's file picker does", async () => {
    const fetch = vi.fn<LibraryFileDeps["fetch"]>(() =>
      Promise.resolve(json({ status: "success" })),
    );
    const d = deps({ fetch });
    expect(await writeLibraryFile(d, '{"b":2}')).toEqual({});
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(url).toBe("/prefix/upload");
    expect(init?.method).toBe("POST");
    const form = init?.body as FormData;
    expect(form.get("source")).toBe("data");
    expect(form.get("target")).toBe("stagehand");
    const file = form.get("upload") as File;
    expect(file.name).toBe("library.json");
    expect(await file.text()).toBe('{"b":2}');
    expect(d.createDirectory).not.toHaveBeenCalled();
  });

  test("creates the folder once Foundry says it is missing, then retries", async () => {
    const answers = [
      json({ error: "Target directory /data/Data/stagehand does not exist." }),
      json({ status: "success" }),
    ];
    const d = deps({
      fetch: vi.fn(() => Promise.resolve(answers.shift() ?? json({}))),
    });
    expect(await writeLibraryFile(d, "{}")).toEqual({});
    expect(d.createDirectory).toHaveBeenCalledWith("stagehand");
    expect(d.fetch).toHaveBeenCalledTimes(2);
  });

  test("a folder another device just created counts as created", async () => {
    const answers = [
      json({ error: "Target directory x does not exist." }),
      json({ status: "success" }),
    ];
    const d = deps({
      fetch: vi.fn(() => Promise.resolve(answers.shift() ?? json({}))),
      createDirectory: vi.fn(() =>
        Promise.reject(new Error("EEXIST: file already exists, mkdir 'x'")),
      ),
    });
    expect(await writeLibraryFile(d, "{}")).toEqual({});
  });

  test("waits for Foundry's socket before creating the folder", async () => {
    const ready = [false, false, true];
    const sleep = vi.fn(() => Promise.resolve());
    const answers = [
      json({ error: "Target directory x does not exist." }),
      json({ status: "success" }),
    ];
    const d = deps({
      fetch: vi.fn(() => Promise.resolve(answers.shift() ?? json({}))),
      socketReady: () => ready.shift() ?? true,
      sleep,
    });
    expect(await writeLibraryFile(d, "{}")).toEqual({});
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  test("gives up when the socket never comes", async () => {
    const answers = [json({ error: "Target directory x does not exist." })];
    const d = deps({
      fetch: vi.fn(() => Promise.resolve(answers.shift() ?? json({}))),
      socketReady: () => false,
    });
    expect(await writeLibraryFile(d, "{}")).toEqual({
      error: "Foundry's connection is not ready.",
    });
    expect(d.createDirectory).not.toHaveBeenCalled();
  });

  test("passes on Foundry's refusal", async () => {
    const d = deps({
      fetch: vi.fn(() =>
        Promise.resolve(json({ error: "User [] does not have permission." })),
      ),
    });
    expect(await writeLibraryFile(d, "{}")).toEqual({
      error: "User [] does not have permission.",
    });
  });

  test("a folder that cannot be created is an error", async () => {
    const d = deps({
      fetch: vi.fn(() =>
        Promise.resolve(json({ error: "Target directory x does not exist." })),
      ),
      createDirectory: vi.fn(() => Promise.reject(new Error("EACCES"))),
    });
    expect(await writeLibraryFile(d, "{}")).toEqual({ error: "EACCES" });
  });

  test("an answer that is not Foundry's is an error", async () => {
    const d = deps({
      fetch: vi.fn(() =>
        Promise.resolve(new Response("<html>", { status: 502 })),
      ),
    });
    expect(await writeLibraryFile(d, "{}")).toEqual({
      error: "Foundry answered HTTP 502.",
    });
  });
});
