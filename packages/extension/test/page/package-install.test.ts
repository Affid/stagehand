import { describe, expect, test, vi } from "vitest";
import { runCheck } from "../../src/page/package-check.ts";
import { runInstall } from "../../src/page/package-install.ts";
import type { PageToUi } from "../../src/page-protocol.ts";

/** A Setup whose check found these manifests, with Foundry's backup and install. */
async function setup(
  ids: readonly string[],
  install: (o: { id: string; manifest: string }) => Promise<unknown>,
  backup: (p: { id: string }) => Promise<boolean> = () => Promise.resolve(true),
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
        manifest: `https://x/${id}/new.json`,
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
      "a:backup",
      "lib:installing",
      "lib:done",
      "a:installing",
      "a:done",
    ]);
    expect(game.installPackage).toHaveBeenNthCalledWith(1, {
      type: "module",
      id: "lib",
      manifest: "https://x/lib/new.json",
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
        manifest: "https://x/fresh/new.json",
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
      "b:installing",
      "b:done",
    ]);
    expect(game.installPackage).toHaveBeenCalledTimes(1);
  });
});
