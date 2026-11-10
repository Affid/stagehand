// @vitest-environment happy-dom
// Foundry 13 (docs/FOUNDRY-13-PLAN.md): the quirks, the adapter, and the
// page actions that behave differently there. Deleted with compat/v13/.
import { afterEach, describe, expect, test, vi } from "vitest";
import { parseCoreVersion } from "@stagehand/shared/version";
import { BUNDLED_CONFIG } from "../../../src/adapters/config.ts";
import { allowsChanges, selectAdapter } from "../../../src/adapters/select.ts";
import { closeRefusedWorld, quirksFor } from "../../../src/compat/quirks.ts";
import { runFoundryAction } from "../../../src/page/actions.ts";

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

const V13 = { generation: 13, build: 351 };
const SINCE = 1_700_000_000_000;

describe("Foundry 13's adapter", () => {
  test("13.351 is supported, and may change things, without certificates", () => {
    const choice = selectAdapter(BUNDLED_CONFIG, parseCoreVersion("13.351"));
    expect(choice.status).toBe("supported");
    expect(allowsChanges(choice)).toBe(true);
    expect(choice.status !== "safe-mode" && choice.adapter.flags).toMatchObject(
      { editWorld: true, certificates: false },
    );
  });

  test("a newer 13 build borrows it as untested", () => {
    const choice = selectAdapter(BUNDLED_CONFIG, parseCoreVersion("13.400"));
    expect(choice.status).toBe("untested-build");
  });

  test("14 keeps its own adapter", () => {
    const choice = selectAdapter(BUNDLED_CONFIG, parseCoreVersion("14.370"));
    expect(choice.status !== "safe-mode" && choice.adapter.id).toBe("v14");
  });
});

describe("quirks by generation", () => {
  test("14, and anything unknown, behaves as 14", () => {
    for (const generation of [14, 15, undefined]) {
      const q = quirksFor(generation);
      expect(q.menuShutdown).toBe(true);
      expect(q.quitAtOnce).toBeNull();
      expect(q.editModuleIcon).toBe(".fa-edit");
      expect(q.createWorldWindow).toBeNull();
      expect(q.missingSettings).toEqual([]);
    }
  });

  test("13 has its own", () => {
    const q = quirksFor(13);
    expect(q.menuShutdown).toBe(false);
    expect(q.quitAtOnce).toBeTypeOf("function");
    expect(q.editModuleIcon).toBe(".fa-pen-to-square");
    expect(q.createWorldWindow).toBe("world-config");
    expect(q.missingSettings).toEqual(["adminUsername", "unixSocket"]);
  });

  test("14 trusts createBackup's answer", async () => {
    const q = quirksFor(14);
    expect(await q.backupFinished({}, true, "w", SINCE)).toBe(true);
    expect(await q.backupFinished({}, undefined, "w", SINCE)).toBe(false);
  });

  test("13 looks for a backup of the world started since it asked", async () => {
    const q = quirksFor(13);
    const listing = (ids: string[]) => ({
      listBackups: () =>
        Promise.resolve({ world: { w: ids.map((id) => ({ id })) } }),
    });
    const fresh = `world.w.2026-11-10.${String(SINCE + 5)}`;
    const old = `world.w.2026-11-09.${String(SINCE - 5)}`;
    expect(
      await q.backupFinished(listing([old, fresh]), undefined, "w", SINCE),
    ).toBe(true);
    expect(await q.backupFinished(listing([old]), undefined, "w", SINCE)).toBe(
      false,
    );
    expect(await q.backupFinished(listing([]), undefined, "other", SINCE)).toBe(
      false,
    );
    expect(await q.backupFinished({}, undefined, "w", SINCE)).toBe(false);
  });
});

describe("closing a running world through 13's join page", () => {
  const closeWorldByJoin =
    closeRefusedWorld ?? (() => Promise.reject(new Error("no 13 close")));
  const answer =
    (body: string, status = 200) =>
    (_body: string): Promise<Response> =>
      Promise.resolve(new Response(body, { status }));

  test("sends the admin password and reads Foundry's answer", async () => {
    const post = vi.fn(answer('{"status":"success"}'));
    expect(await closeWorldByJoin(post, "pw")).toBe("closing");
    expect(JSON.parse(post.mock.calls[0]?.[0] ?? "{}")).toEqual({
      action: "shutdown",
      adminPassword: "pw",
    });
    expect(await closeWorldByJoin(answer("Wrong password."), undefined)).toBe(
      "password",
    );
    expect(await closeWorldByJoin(answer("<html></html>"), undefined)).toBe(
      "failed",
    );
    expect(await closeWorldByJoin(answer("", 500), undefined)).toBe("failed");
  });
});

describe("page actions on Foundry 13", () => {
  const world = { id: "strahd", type: "world", title: "Strahd" };

  function setup13() {
    document.body.innerHTML = `<div id="setup-packages">
      <button data-action="worldCreate"></button>
      <ol id="worlds-list"><li class="package world" data-package-id="strahd">
        <a data-action="worldLaunch"></a></li></ol></div>`;
    const seen: string[] = [];
    document.addEventListener("click", (e) => {
      const action = (e.target as HTMLElement).dataset.action;
      if (action) seen.push(action);
    });
    return seen;
  }

  test("Back up first launches once 13 lists the new backup", async () => {
    const seen = setup13();
    vi.spyOn(Date, "now").mockReturnValue(SINCE);
    const page = {
      game: {
        release: V13,
        worlds: { values: () => [].values(), get: () => world },
        createBackup: vi.fn(() => Promise.resolve(undefined)),
        listBackups: () =>
          Promise.resolve({
            world: { strahd: [{ id: `world.strahd.d.${String(SINCE + 1)}` }] },
          }),
      },
    };
    expect(
      await runFoundryAction(document, page, {
        action: "backupLaunch",
        worldId: "strahd",
      }),
    ).toBeUndefined();
    expect(seen).toEqual(["worldLaunch"]);
  });

  test("a backup 13 doesn't list stops the launch", async () => {
    const seen = setup13();
    const page = {
      game: {
        release: V13,
        worlds: { values: () => [].values(), get: () => world },
        createBackup: () => Promise.resolve(undefined),
        listBackups: () => Promise.resolve({ world: {} }),
      },
    };
    expect(
      await runFoundryAction(document, page, {
        action: "backupLaunch",
        worldId: "strahd",
      }),
    ).toMatch(/not launched/);
    expect(seen).toEqual([]);
  });

  /** Foundry 13: /quit answers or not; then its status route answers or not. */
  function server(quit: "answers" | "gone", afterwards: "down" | "up") {
    return vi.fn((url: string) => {
      if (url === "/quit")
        return quit === "answers"
          ? Promise.resolve(Response.json({ status: "failed" }))
          : Promise.reject(new TypeError("Failed to fetch"));
      return afterwards === "down"
        ? Promise.reject(new TypeError("Failed to fetch"))
        : Promise.resolve(Response.json({ active: false }));
    });
  }

  test("quit stops 13 at once and tells our page once it's down", async () => {
    const fetch = server("answers", "down");
    vi.stubGlobal("fetch", fetch);
    const stopped = vi.fn();
    expect(
      await runFoundryAction(
        document,
        { game: { release: V13 } },
        { action: "quit" },
        stopped,
      ),
    ).toBeUndefined();
    expect(fetch).toHaveBeenCalledWith("/quit", { method: "POST" });
    expect(stopped).toHaveBeenCalledTimes(1);
  });

  test("13 gone before it answers still counts, once its status is gone too", async () => {
    vi.stubGlobal("fetch", server("gone", "down"));
    const stopped = vi.fn();
    await runFoundryAction(
      document,
      { game: { release: V13 } },
      { action: "quit" },
      stopped,
    );
    expect(stopped).toHaveBeenCalledTimes(1);
  });

  test("a quit that failed while Foundry still answers is not a stop", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", server("gone", "up"));
    const stopped = vi.fn();
    const done = runFoundryAction(
      document,
      { game: { release: V13 } },
      { action: "quit" },
      stopped,
    );
    await vi.advanceTimersByTimeAsync(15_000);
    expect(await done).toBe("Foundry did not stop");
    expect(stopped).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  test("Create World brings 13's world window into view", async () => {
    const seen = setup13();
    const setPosition = vi.fn();
    const instances = new Map([
      [
        "world-config",
        { rendered: true, position: { width: 600 }, setPosition },
      ],
    ]);
    const page = {
      game: { release: V13 },
      foundry: { applications: { instances } },
    };
    expect(
      await runFoundryAction(document, page, { action: "createWorld" }),
    ).toBeUndefined();
    expect(seen).toEqual(["worldCreate"]);
    await vi.waitFor(() => {
      expect(setPosition).toHaveBeenCalled();
    });
  });

  test("Edit module finds 13's menu item by its own icon", async () => {
    document.body.innerHTML = `<div id="setup-packages"><section data-package-type="module">
      <li class="package" data-package-id="m"></li></section></div>`;
    document
      .querySelector("li.package")
      ?.addEventListener("contextmenu", () => {
        document.body.insertAdjacentHTML(
          "beforeend",
          `<nav id="context-menu"><li class="context-item"><i class="fa-solid fa-pen-to-square"></i>Edit</li></nav>`,
        );
      });
    const clicked = vi.fn();
    document.addEventListener("click", (e) => {
      if ((e.target as HTMLElement).closest(".context-item")) clicked();
    });
    const page = {
      game: { release: V13 },
      foundry: { applications: { instances: new Map() } },
    } as never;
    expect(
      await runFoundryAction(document, page, {
        action: "editPackage",
        packageType: "module",
        id: "m",
      }),
    ).toBeUndefined();
    expect(clicked).toHaveBeenCalledTimes(1);
  });
});
