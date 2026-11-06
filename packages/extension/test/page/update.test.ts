// Foundry's own update from the new Setup page (package 7): the check and
// the download go to Foundry's /update route as its update screen posts
// them; the download's ticks reach our progress; a snapshot first stops the
// update when it fails; the release's download link never crosses.
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  parseUpdateReply,
  parseUpdateRequest,
  type UpdateRequest,
} from "../../src/page-update.ts";
import {
  releaseOf,
  runUpdate,
  STALL_MS,
  UPDATING,
} from "../../src/page/update.ts";

type Listener = (data: Record<string, unknown>) => void;

const RELEASE = {
  build: 371,
  generation: 14,
  channel: "stable",
  suffix: "Stable 13",
  node_version: 24,
  time: 1_794_001_549_723,
  notes: "<h2>Bug Fixes</h2><ul><li>Fixed it.</li></ul>",
  download: "https://r2.foundryvtt.com/secret-signed-link.zip",
  flags: {},
};

function foundry() {
  const listeners = new Set<Listener>();
  const onProgress = vi.fn();
  const toggleLock = vi.fn();
  const game = {
    i18n: { localize: (k: string) => `L:${k}` },
    createSnapshot: vi.fn(() => Promise.resolve()),
    _addProgressListener: vi.fn((fn: Listener) => listeners.add(fn)),
    _removeProgressListener: vi.fn((fn: Listener) => listeners.delete(fn)),
  };
  const tick = (data: Record<string, unknown>): void => {
    listeners.forEach((fn) => {
      fn(data);
    });
  };
  const page = {
    game,
    ui: { setupPackages: { onProgress, toggleLock } },
    foundry: { utils: { getRoute: (p: string) => `/prefix/${p}` } },
  } as unknown as Parameters<typeof runUpdate>[0];
  return { page, game, tick, listeners, onProgress, toggleLock };
}

function answer(body: unknown, redirected = false): Response {
  return {
    redirected,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

const req = (over: Partial<UpdateRequest> = {}): UpdateRequest => ({
  requestId: "r1",
  op: "check",
  channel: "stable",
  force: false,
  snapshot: false,
  ...over,
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("checking for an update", () => {
  test("posts updateCheck to Foundry's /update route with the channel", async () => {
    const fetch = vi.fn(() => Promise.resolve(answer(RELEASE)));
    vi.stubGlobal("fetch", fetch);
    const { page } = foundry();
    const r = await runUpdate(page, req({ force: true }));
    expect(fetch).toHaveBeenCalledWith("/prefix/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "updateCheck",
        updateChannel: "stable",
        forceUpdate: true,
      }),
    });
    expect(r.release).toMatchObject({ version: "14.371", manual: false });
  });

  test("the download link never crosses to the UI", async () => {
    vi.stubGlobal("fetch", () => Promise.resolve(answer(RELEASE)));
    const r = await runUpdate(foundry().page, req());
    expect(JSON.stringify(r)).not.toContain("secret-signed-link");
    expect(parseUpdateReply({ requestId: "r1", ...r })).toBeTruthy();
  });

  test("nothing newer: Foundry's info key", async () => {
    vi.stubGlobal("fetch", () =>
      Promise.resolve(answer({ info: "SETUP.UpdateNotAvailable" })),
    );
    expect(await runUpdate(foundry().page, req())).toEqual({
      info: "SETUP.UpdateNotAvailable",
    });
  });

  test("Foundry's error is localized; a sign-in redirect is an error", async () => {
    vi.stubGlobal("fetch", () =>
      Promise.resolve(answer({ error: "SETUP.UpdateCheckFailed" })),
    );
    expect((await runUpdate(foundry().page, req())).error).toBe(
      "L:SETUP.UpdateCheckFailed",
    );
    vi.stubGlobal("fetch", () => Promise.resolve(answer({}, true)));
    expect((await runUpdate(foundry().page, req())).error).toContain("sign in");
  });

  test("a release to install by hand, as ReleaseData#requiresManualInstall", () => {
    const flags = { requires_full_reinstall: true };
    expect(releaseOf({ ...RELEASE, flags })?.manual).toBe(true);
    expect(releaseOf({ ...RELEASE, generation: "x" })).toBeUndefined();
  });
});

type Tick = Record<string, unknown>;
const dl = (step: string, more: Tick = {}): Tick => ({
  action: "updateDownload",
  id: "updateCore",
  step,
  ...more,
});

/** Foundry's /update route: the check answers RELEASE; a download ticks. */
function server(f: ReturnType<typeof foundry>, ticks: readonly Tick[]) {
  const fetch = vi.fn((_url: string, init: { body: string }) => {
    const { action } = JSON.parse(init.body) as { action: string };
    if (action === "updateDownload")
      queueMicrotask(() => {
        ticks.forEach((t) => {
          f.tick(t);
        });
      });
    return Promise.resolve(answer(action === "updateCheck" ? RELEASE : {}));
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

const downloads = (fetch: ReturnType<typeof server>): number =>
  fetch.mock.calls.filter((c) => c[1].body.includes("updateDownload")).length;

const install = (over: Partial<UpdateRequest> = {}) =>
  req({ op: "download", version: "14.371", ...over });

describe("installing an update", () => {
  test("posts updateDownload, forwards its ticks, locks Setup, ends on complete", async () => {
    const f = foundry();
    server(f, [
      dl("download", { pct: 40 }),
      { action: "installPackage", id: "x", step: "complete" },
      dl("complete", { pct: 100 }),
    ]);
    await runUpdate(f.page, req());
    const r = await runUpdate(f.page, install());
    expect(r).toEqual({ installed: true });
    expect(f.onProgress).toHaveBeenCalledTimes(2);
    expect(f.toggleLock).toHaveBeenNthCalledWith(1, true, {
      message: UPDATING,
    });
    expect(f.toggleLock).toHaveBeenLastCalledWith(false);
    expect(f.listeners.size).toBe(0);
  });

  test("Foundry's error tick fails it", async () => {
    const f = foundry();
    server(f, [dl("error", { error: "Disk full" })]);
    await runUpdate(f.page, req());
    expect(await runUpdate(f.page, install())).toEqual({ error: "Disk full" });
  });

  test("only the release the page showed: another version needs a new check", async () => {
    const f = foundry();
    const fetch = server(f, [dl("complete")]);
    await runUpdate(f.page, req());
    expect(
      (await runUpdate(f.page, install({ version: "14.380" }))).error,
    ).toContain("again");
    expect(downloads(fetch)).toBe(0);
  });

  test("one update at a time", async () => {
    const f = foundry();
    const fetch = server(f, []);
    await runUpdate(f.page, req());
    const first = runUpdate(f.page, install());
    await Promise.resolve();
    expect((await runUpdate(f.page, install())).error).toContain("already");
    f.tick(dl("complete"));
    expect(await first).toEqual({ installed: true });
    expect(downloads(fetch)).toBe(1);
  });

  test("a download that stops ticking fails and gives the lock back", async () => {
    vi.useFakeTimers();
    try {
      const f = foundry();
      server(f, [dl("download", { pct: 10 })]);
      await runUpdate(f.page, req());
      const r = runUpdate(f.page, install());
      await vi.advanceTimersByTimeAsync(STALL_MS + 1000);
      expect((await r).error).toContain("stopped answering");
      expect(f.toggleLock).toHaveBeenLastCalledWith(false);
    } finally {
      vi.useRealTimers();
    }
  });

  test("a snapshot first, with its note; its error stops the update", async () => {
    const f = foundry();
    const fetch = server(f, [dl("complete")]);
    f.game.createSnapshot.mockImplementation(() => {
      f.tick({
        action: "createSnapshot",
        id: "s.1",
        step: "error",
        error: "No space",
      });
      return Promise.resolve();
    });
    await runUpdate(f.page, req());
    const r = await runUpdate(f.page, install({ snapshot: true }));
    expect(f.game.createSnapshot).toHaveBeenCalledWith({
      note: "Before updating to 14.371",
      dialog: false,
    });
    expect(r.error).toBe("No space Nothing was installed.");
    expect(downloads(fetch)).toBe(0);
  });

  test("one package's backup done is not the snapshot done (review)", async () => {
    const f = foundry();
    const fetch = server(f, [dl("complete")]);
    f.game.createSnapshot.mockImplementation(() => {
      f.tick({ action: "createBackup", id: "module.a", step: "complete" });
      f.tick({
        action: "createBackup",
        id: "module.b",
        step: "error",
        error: "Locked file",
      });
      return Promise.resolve();
    });
    await runUpdate(f.page, req());
    expect(
      (await runUpdate(f.page, install({ snapshot: true }))).error,
    ).toContain("Locked file");
    // Foundry's answer had an error and no tick at all: not taken either.
    f.game.createSnapshot.mockImplementation(() => Promise.resolve());
    expect(
      (await runUpdate(f.page, install({ snapshot: true }))).error,
    ).toContain("didn't confirm");
    expect(downloads(fetch)).toBe(0);
  });

  test("the snapshot's own complete tick lets the update go on", async () => {
    const f = foundry();
    const fetch = server(f, [dl("complete")]);
    f.game.createSnapshot.mockImplementation(() => {
      f.tick({ action: "createSnapshot", id: "s.1", step: "complete" });
      return Promise.resolve();
    });
    await runUpdate(f.page, req());
    expect(await runUpdate(f.page, install({ snapshot: true }))).toEqual({
      installed: true,
    });
    expect(downloads(fetch)).toBe(1);
  });

  test("an answer that isn't JSON says so, with its status", async () => {
    vi.stubGlobal("fetch", () =>
      Promise.resolve({
        redirected: false,
        status: 502,
        json: () => Promise.reject(new SyntaxError("Unexpected token <")),
      } as unknown as Response),
    );
    expect((await runUpdate(foundry().page, req())).error).toBe(
      "Foundry's update answer was not readable (HTTP 502)",
    );
  });
});

describe("UPDATE and UPDATE_DONE are checked", () => {
  test("a request needs a known op, a plain channel and booleans", () => {
    const ok = {
      requestId: "a1",
      op: "check",
      channel: "stable",
      force: false,
      snapshot: false,
    };
    expect(parseUpdateRequest(ok)).toEqual(ok);
    expect(parseUpdateRequest({ ...ok, op: "install" })).toBeUndefined();
    expect(parseUpdateRequest({ ...ok, channel: "../x" })).toBeUndefined();
    expect(parseUpdateRequest({ ...ok, force: "yes" })).toBeUndefined();
    // A download names the release the page showed (security review).
    expect(parseUpdateRequest({ ...ok, op: "download" })).toBeUndefined();
    // Only a download takes a snapshot first.
    expect(parseUpdateRequest({ ...ok, snapshot: true })).toBeUndefined();
    expect(
      parseUpdateRequest({ ...ok, op: "download", version: "14.371; rm" }),
    ).toBeUndefined();
  });

  test("a reply's release, info key and error are checked", () => {
    const release = releaseOf(RELEASE);
    expect(parseUpdateReply({ requestId: "a1", release })).toBeTruthy();
    expect(
      parseUpdateReply({
        requestId: "a1",
        release: { ...release, version: "<b>" },
      }),
    ).toBeUndefined();
    expect(
      parseUpdateReply({ requestId: "a1", info: "<script>" }),
    ).toBeUndefined();
    expect(
      parseUpdateReply({ requestId: "a1", installed: "yes" }),
    ).toBeUndefined();
    expect(
      parseUpdateReply({ requestId: "a1", error: "x".repeat(3000) }),
    ).toBeUndefined();
  });
});

describe("Foundry's compatibility preview", () => {
  const MODULE = {
    id: "a",
    title: "A",
    version: "2.0.0",
    availability: 2,
    compatibility: { minimum: "13", verified: "14.369", maximum: "" },
    relationships: { requires: [{ id: "lib", type: "module" }] },
    description: "<script>never crosses</script>",
    url: "https://foundryvtt.com/packages/a",
    changelog: "javascript:alert(1)",
  };

  test("needs the release Foundry checked; then posts it back and keeps the answer", async () => {
    const f = foundry();
    const fetch = vi.fn((_url: string, init: { body: string }) => {
      const body = JSON.parse(init.body) as { action: string };
      return Promise.resolve(
        answer(
          body.action === "updateCheck"
            ? RELEASE
            : { module: [MODULE, { id: "../bad" }], system: [], world: [] },
        ),
      );
    });
    vi.stubGlobal("fetch", fetch);
    const ask = req({ op: "preview", version: "14.371" });
    expect(
      (await runUpdate(f.page, req({ op: "preview", version: "14.999" })))
        .error,
    ).toContain("again");
    await runUpdate(f.page, req());
    const r = await runUpdate(f.page, ask);
    const posted = JSON.parse(fetch.mock.calls[1]![1].body) as Record<
      string,
      unknown
    >;
    expect(posted).toEqual({
      action: "previewCompatibility",
      release: RELEASE,
    });
    expect(r.preview?.module).toEqual([
      {
        id: "a",
        title: "A",
        version: "2.0.0",
        availability: 2,
        verified: "14.369",
        maximum: null,
        requires: ["lib"],
        url: "https://foundryvtt.com/packages/a",
      },
    ]);
    expect(JSON.stringify(r)).not.toContain("never crosses");
    // Asked once per release.
    await runUpdate(f.page, ask);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(parseUpdateReply({ requestId: "r1", ...r })).toBeTruthy();
  });

  test("a preview request names its release; a reply's entries are all checked", () => {
    const ok = {
      requestId: "a1",
      op: "preview",
      channel: "stable",
      force: false,
      snapshot: false,
    };
    expect(parseUpdateRequest(ok)).toBeUndefined();
    expect(parseUpdateRequest({ ...ok, version: "14.371" })).toBeTruthy();
    const bad = {
      system: [],
      world: [],
      module: [{ id: "a", availability: "1" }],
    };
    expect(parseUpdateReply({ requestId: "a1", preview: bad })).toBeUndefined();
  });
});
