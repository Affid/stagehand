import { describe, expect, test, vi } from "vitest";
import {
  checkList,
  manifestFor,
  normalise,
  runCheck,
} from "../../src/page/package-check.ts";
import type { PageToUi } from "../../src/page-protocol.ts";

const NOW = 1_800_000_000_000;

describe("one package's check, as the Updates tab reads it", () => {
  const answer = (over: object) => ({
    isUpgrade: true,
    availability: 1,
    manifest: "https://example.com/a/module.json",
    remote: {
      id: "a",
      version: "1.1.0",
      compatibility: { minimum: "13", verified: "14" },
      relationships: {
        requires: [
          { id: "lib", type: "module", compatibility: { minimum: "1.1.0" } },
          { id: "dnd5e", type: "system" },
        ],
        systems: [
          { id: "dnd5e", type: "system", compatibility: { minimum: "5.2" } },
        ],
      },
    },
    ...over,
  });

  test("an update, with what its new version needs", () => {
    expect(normalise("module", "a", { answer: answer({}) }, NOW)).toEqual({
      id: "a",
      type: "module",
      state: "update",
      version: "1.1.0",
      availability: 1,
      compatibility: { minimum: "13", verified: "14" },
      requires: [{ id: "lib", minimum: "1.1.0" }],
      systems: [{ id: "dnd5e", minimum: "5.2" }],
      checkedAt: NOW,
    });
  });

  test("current, another Foundry, premium not owned", () => {
    expect(
      normalise("module", "a", { answer: answer({ isUpgrade: false }) }, NOW)
        .state,
    ).toBe("current");
    expect(
      normalise("module", "a", { answer: answer({ availability: 8 }) }, NOW)
        .state,
    ).toBe("core");
    expect(
      normalise("module", "a", { answer: answer({}), owned: false }, NOW).state,
    ).toBe("notOwned");
  });

  test("a refused manifest and other errors, with no URL in what is kept", () => {
    const refused = Object.assign(
      new Error(
        "[a] Access to module manifest at https://patreon.example/key=SECRET/module.json is forbidden",
      ),
      { errorCode: 403 },
    );
    expect(normalise("module", "a", { error: refused }, NOW)).toEqual({
      id: "a",
      type: "module",
      state: "denied",
      errorCode: 403,
      error: "Access to module manifest at its address is forbidden",
      checkedAt: NOW,
    });
    expect(
      normalise("module", "a", { error: new Error("timeout") }, NOW),
    ).toMatchObject({ state: "error", error: "timeout" });
  });
});

/** A Setup with installed modules a (with a manifest), b (locked), c (no manifest), and a system. */
function fakePage(
  check: (o: { type: string; id: string }) => Promise<unknown>,
) {
  const modules = new Map<string, object>([
    ["a", { id: "a", manifest: "https://x/a.json" }],
    ["b", { id: "b", manifest: "https://x/b.json", locked: true }],
    ["c", { id: "c", manifest: "" }],
    ["p", { id: "p", manifest: "https://x/p.json", protected: true }],
  ]);
  const systems = new Map<string, object>([
    ["dnd5e", { id: "dnd5e", manifest: "https://x/dnd5e.json" }],
  ]);
  return {
    game: {
      modules,
      systems,
      checkPackage: vi.fn(check),
      getPackages: vi.fn(({ type }: { type: string }) =>
        Promise.resolve(
          new Map(type === "module" ? [["p", { id: "p", owned: false }]] : []),
        ),
      ),
    },
  } as unknown as Parameters<typeof runCheck>[0];
}

describe("checking the library", () => {
  test("every unlocked package with a manifest, as Foundry's Update All picks them", () => {
    const page = fakePage(() => Promise.resolve({}));
    expect(checkList(page)).toEqual([
      { type: "module", id: "a" },
      { type: "module", id: "p" },
      { type: "system", id: "dnd5e" },
    ]);
  });

  test("five at a time, with progress, results and the end; the manifest stays here", async () => {
    let running = 0;
    let most = 0;
    const page = fakePage(async ({ id }) => {
      running++;
      most = Math.max(most, running);
      await new Promise((r) => setTimeout(r, 5));
      running--;
      return {
        isUpgrade: id === "a",
        availability: 1,
        manifest: `https://x/${id}/new.json`,
        remote: { id, version: "2.0.0" },
      };
    });
    const posted: PageToUi[] = [];
    const list = Array.from({ length: 12 }, (_, n) => ({
      type: "module" as const,
      id: n === 0 ? "a" : `m${String(n)}`,
    }));
    await runCheck(page, list, {
      requestId: "r1",
      post: (m) => posted.push(m),
      stopped: () => false,
      now: () => NOW,
    });
    expect(most).toBe(5);
    const kinds = posted.map((m) =>
      m.type === "PACKAGE_CHECK" ? m.payload.kind : "",
    );
    expect(kinds.filter((k) => k === "result")).toHaveLength(12);
    expect(kinds.at(-1)).toBe("done");
    expect(JSON.stringify(posted)).not.toContain("new.json");
    expect(manifestFor("module", "a")).toBe("https://x/a/new.json");
  });

  test("Stop: no new check starts, and the end says stopped", async () => {
    let stop = false;
    const page = fakePage(async () => {
      stop = true;
      await Promise.resolve();
      return { isUpgrade: false, remote: { id: "x", version: "1" } };
    });
    const posted: PageToUi[] = [];
    await runCheck(
      page,
      Array.from({ length: 20 }, (_, n) => ({
        type: "module" as const,
        id: `m${String(n)}`,
      })),
      {
        requestId: "r2",
        post: (m) => posted.push(m),
        stopped: () => stop,
        now: () => NOW,
      },
    );
    const results = posted.filter(
      (m) => m.type === "PACKAGE_CHECK" && m.payload.kind === "result",
    );
    expect(results.length).toBeLessThanOrEqual(5);
    expect(posted.at(-1)).toMatchObject({
      type: "PACKAGE_CHECK",
      payload: { kind: "done", stopped: true },
    });
  });

  test("premium content the license doesn't own is marked from Foundry's package list", async () => {
    const page = fakePage(({ id }) =>
      Promise.resolve({
        isUpgrade: true,
        availability: 1,
        remote: { id, version: "2.0.0" },
      }),
    );
    const posted: PageToUi[] = [];
    await runCheck(page, [{ type: "module", id: "p" }], {
      requestId: "r3",
      post: (m) => posted.push(m),
      stopped: () => false,
      now: () => NOW,
    });
    expect(posted).toContainEqual(
      expect.objectContaining({
        payload: expect.objectContaining({
          kind: "result",
          result: expect.objectContaining({ id: "p", state: "notOwned" }),
        }),
      }),
    );
  });
});
