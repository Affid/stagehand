import { describe, expect, test, vi } from "vitest";
import { runCheck } from "../../src/page/package-check.ts";
import { runInstall } from "../../src/page/package-install.ts";
import { watchProgress } from "../../src/page/progress.ts";
import type { PageToUi } from "../../src/page-protocol.ts";

/** A Setup whose check found these manifests, with Foundry's backup and install. */
async function setup(
  ids: readonly string[],
  install: (o: { id: string; manifest: string }) => Promise<unknown>,
  backup: (p: { id: string }) => Promise<boolean | undefined> = () =>
    Promise.resolve(true),
) {
  const modules = new Map(
    ids.map((id) => [
      id,
      { id, title: `T ${id}`, manifest: `https://x/${id}.json` },
    ]),
  );
  const game = {
    modules,
    systems: new Map(),
    checkPackage: vi.fn(({ id }: { id: string }) =>
      Promise.resolve({
        isUpgrade: true,
        availability: 1,
        manifest: `https://github.com/example-author/foundry-packages/releases/latest/download/${id}/module.json`,
        remote: { id, version: "2.0.0" },
      }),
    ),
    installPackage: vi.fn(install),
    createBackup: vi.fn(backup),
  };
  const page = { game } as unknown as Parameters<typeof runInstall>[0];
  await runCheck(
    page,
    ids.map((id) => ({ type: "module" as const, id })),
    { requestId: "c", post: () => undefined, stopped: () => false },
  );
  return { page, game };
}

const items = (posted: PageToUi[]) =>
  posted.flatMap((m) =>
    m.type === "PACKAGE_INSTALL" && m.payload.kind === "item"
      ? [`${m.payload.id}:${m.payload.state}`]
      : [],
  );

describe("installing the ticked updates", () => {
  test("backups first, then each install in the order asked, from the check's manifest", async () => {
    const { page, game } = await setup(["lib", "a"], () => Promise.resolve({}));
    const posted: PageToUi[] = [];
    await runInstall(
      page,
      {
        requestId: "i1",
        items: [
          { type: "module", id: "lib" },
          { type: "module", id: "a" },
        ],
        backup: true,
      },
      (m) => posted.push(m),
    );
    expect(items(posted)).toEqual([
      "lib:backup",
      "lib:backedUp",
      "a:backup",
      "a:backedUp",
      "lib:installing",
      "lib:done",
      "a:installing",
      "a:done",
    ]);
    expect(game.installPackage).toHaveBeenNthCalledWith(1, {
      type: "module",
      id: "lib",
      manifest:
        "https://github.com/example-author/foundry-packages/releases/latest/download/lib/module.json",
      notify: false,
      dependencies: false,
    });
    expect(game.createBackup).toHaveBeenCalledWith(
      { type: "module", id: "lib", title: "T lib" },
      { note: "Before updating to 2.0.0 (Stagehand)" },
    );
    expect(posted.at(-1)).toMatchObject({
      type: "PACKAGE_INSTALL",
      payload: { kind: "done" },
    });
  });

  test("a refused download fails that package with its code; the others go on", async () => {
    const { page } = await setup(["pat", "a"], ({ id }) =>
      id === "pat"
        ? Promise.reject(
            new Error(
              "An unexpected error occurred when downloading file https://patreon.example/key=SECRET/p.zip: Forbidden",
            ),
          )
        : Promise.resolve({}),
    );
    const posted: PageToUi[] = [];
    await runInstall(
      page,
      {
        requestId: "i2",
        items: [
          { type: "module", id: "pat" },
          { type: "module", id: "a" },
        ],
        backup: false,
      },
      (m) => posted.push(m),
    );
    expect(items(posted)).toEqual([
      "pat:installing",
      "pat:failed",
      "a:installing",
      "a:done",
    ]);
    const failed = posted.find(
      (m) =>
        m.type === "PACKAGE_INSTALL" &&
        m.payload.kind === "item" &&
        m.payload.state === "failed",
    );
    expect(failed?.payload).toMatchObject({ errorCode: 403 });
    expect(JSON.stringify(failed)).not.toContain("SECRET");
  });

  test("Foundry 13's lost download (its zip missing) says so, without the server's paths", async () => {
    const { page } = await setup(["pat"], () =>
      Promise.reject(
        new Error(
          "ENOENT: no such file or directory, stat '/home/gm/foundrydata/Data/modules/pat.zip'",
        ),
      ),
    );
    const posted: PageToUi[] = [];
    await runInstall(
      page,
      {
        requestId: "i7",
        items: [{ type: "module", id: "pat" }],
        backup: false,
      },
      (m) => posted.push(m),
    );
    const failed = posted.find(
      (m) =>
        m.type === "PACKAGE_INSTALL" &&
        m.payload.kind === "item" &&
        m.payload.state === "failed",
    );
    expect(failed?.payload).toMatchObject({
      error:
        "The download didn't arrive: its server may have refused it (a membership may have ended), or it was cut off.",
    });
    expect(failed?.payload).not.toHaveProperty("errorCode");
    expect(JSON.stringify(failed)).not.toContain("/home/");
  });

  test("after a reload (no manifest kept here) it checks the package again first", async () => {
    const { page, game } = await setup([], () => Promise.resolve({}));
    const modules = game.modules as Map<string, object>;
    modules.set("fresh", {
      id: "fresh",
      title: "T fresh",
      manifest: "https://x/fresh.json",
    });
    const posted: PageToUi[] = [];
    await runInstall(
      page,
      {
        requestId: "i3",
        items: [{ type: "module", id: "fresh" }],
        backup: false,
      },
      (m) => posted.push(m),
    );
    expect(game.checkPackage).toHaveBeenCalledWith({
      type: "module",
      id: "fresh",
    });
    expect(items(posted)).toEqual(["fresh:installing", "fresh:done"]);
    expect(game.installPackage).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "fresh",
        manifest:
          "https://github.com/example-author/foundry-packages/releases/latest/download/fresh/module.json",
      }),
    );
  });

  test("Foundry 13's answer: the manifest to install from is the remote one's", async () => {
    const { page, game } = await setup([], () => Promise.resolve({}));
    const modules = game.modules as Map<string, object>;
    modules.set("old", { id: "old", title: "T old", manifest: "https://x/o" });
    // Foundry 13 has no manifest beside remote (Setup#updateCheck reads remote's).
    game.checkPackage.mockResolvedValueOnce({
      isUpgrade: true,
      availability: 1,
      remote: {
        id: "old",
        version: "2.0.0",
        manifest:
          "https://github.com/example-author/foundry-packages/releases/latest/download/old/module.json",
      },
    } as never);
    const posted: PageToUi[] = [];
    await runInstall(
      page,
      {
        requestId: "i6",
        items: [{ type: "module", id: "old" }],
        backup: false,
      },
      (m) => posted.push(m),
    );
    expect(items(posted)).toEqual(["old:installing", "old:done"]);
    expect(game.installPackage).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "old",
        manifest:
          "https://github.com/example-author/foundry-packages/releases/latest/download/old/module.json",
      }),
    );
  });

  test("a package that has no update when checked again isn't installed", async () => {
    const { page, game } = await setup([], () => Promise.resolve({}));
    game.checkPackage.mockResolvedValueOnce({
      isUpgrade: false,
      remote: { id: "same", version: "1.0.0" },
    } as never);
    const posted: PageToUi[] = [];
    await runInstall(
      page,
      {
        requestId: "i5",
        items: [{ type: "module", id: "same" }],
        backup: false,
      },
      (m) => posted.push(m),
    );
    expect(items(posted)).toEqual(["same:failed"]);
    expect(game.installPackage).not.toHaveBeenCalled();
  });

  test("a backup that fails keeps that package as it is", async () => {
    const { page, game } = await setup(
      ["a", "b"],
      () => Promise.resolve({}),
      ({ id }) => Promise.resolve(id !== "a"),
    );
    const posted: PageToUi[] = [];
    await runInstall(
      page,
      {
        requestId: "i4",
        items: [
          { type: "module", id: "a" },
          { type: "module", id: "b" },
        ],
        backup: true,
      },
      (m) => posted.push(m),
    );
    expect(items(posted)).toEqual([
      "a:backup",
      "a:failed",
      "b:backup",
      "b:backedUp",
      "b:installing",
      "b:done",
    ]);
    expect(game.installPackage).toHaveBeenCalledTimes(1);
  });
});

describe("Foundry 13's backups, which answer nothing", () => {
  /**
   * Foundry 13's createBackup resolves with nothing either way; its ticks,
   * through ui.setupPackages.onProgress, end in "complete" or "error".
   */
  async function setup13(fails: ReadonlySet<string>) {
    const sp: { onProgress?: (d: Record<string, unknown>) => unknown } = {
      onProgress: () => undefined,
    };
    const backup = ({ id }: { id: string }) => {
      sp.onProgress?.({
        action: "createBackup",
        id: `module.${id}.2026-11-27.1795749905134`,
        step: fails.has(id) ? "error" : "complete",
        pct: 100,
      });
      return Promise.resolve(undefined);
    };
    const s = await setup(["a", "b"], () => Promise.resolve({}), backup);
    const page = { ...s.page, ui: { setupPackages: sp } } as Parameters<
      typeof runInstall
    >[0] &
      Parameters<typeof watchProgress>[0];
    watchProgress(page, () => undefined);
    return { page, game: s.game };
  }

  test("a complete tick for the package: its backup was made", async () => {
    const { page, game } = await setup13(new Set());
    const posted: PageToUi[] = [];
    await runInstall(
      page,
      { requestId: "b1", items: [{ type: "module", id: "a" }], backup: true },
      (m) => posted.push(m),
    );
    expect(items(posted)).toEqual([
      "a:backup",
      "a:backedUp",
      "a:installing",
      "a:done",
    ]);
    expect(game.installPackage).toHaveBeenCalledTimes(1);
  });

  test("an error tick: that package stays as it is; the next one goes on", async () => {
    const { page, game } = await setup13(new Set(["a"]));
    const posted: PageToUi[] = [];
    await runInstall(
      page,
      {
        requestId: "b2",
        items: [
          { type: "module", id: "a" },
          { type: "module", id: "b" },
        ],
        backup: true,
      },
      (m) => posted.push(m),
    );
    expect(items(posted)).toEqual([
      "a:backup",
      "a:failed",
      "b:backup",
      "b:backedUp",
      "b:installing",
      "b:done",
    ]);
    expect(game.installPackage).toHaveBeenCalledTimes(1);
  });
});
