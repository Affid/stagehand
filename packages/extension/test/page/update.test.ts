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
import { releaseOf, runUpdate, UPDATING } from "../../src/page/update.ts";

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

describe("installing an update", () => {
  test("posts updateDownload, forwards its ticks, locks Setup, ends on complete", async () => {
    const f = foundry();
    vi.stubGlobal("fetch", () => {
      queueMicrotask(() => {
        f.tick({
          action: "updateDownload",
          id: "updateCore",
          step: "download",
          pct: 40,
        });
        f.tick({ action: "installPackage", id: "x", step: "complete" });
        f.tick({
          action: "updateDownload",
          id: "updateCore",
          step: "complete",
          pct: 100,
        });
      });
      return Promise.resolve(answer({}));
    });
    const r = await runUpdate(f.page, req({ op: "download" }));
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
    vi.stubGlobal("fetch", () => {
      queueMicrotask(() => {
        f.tick({
          action: "updateDownload",
          id: "updateCore",
          step: "error",
          error: "Disk full",
        });
      });
      return Promise.resolve(answer({}));
    });
    expect(await runUpdate(f.page, req({ op: "download" }))).toEqual({
      error: "Disk full",
    });
  });

  test("a snapshot first, with its note; if it fails nothing is installed", async () => {
    const f = foundry();
    const fetch = vi.fn(() => Promise.resolve(answer({})));
    vi.stubGlobal("fetch", fetch);
    f.game.createSnapshot.mockImplementation(() => {
      f.tick({
        action: "createSnapshot",
        id: "snapshot.1",
        step: "error",
        error: "No space",
      });
      return Promise.resolve();
    });
    const r = await runUpdate(
      f.page,
      req({ op: "download", snapshot: true, version: "14.371" }),
    );
    expect(f.game.createSnapshot).toHaveBeenCalledWith({
      note: "Before updating to 14.371",
      dialog: false,
    });
    expect(r).toEqual({ error: "No space" });
    expect(fetch).not.toHaveBeenCalled();
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
