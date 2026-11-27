// @vitest-environment happy-dom
// The Library's Updates tab (updates plan, phase 2): our own check, its
// progress, and what it found in sections, before anything installs.
import type { PackageCheck } from "@stagehand/shared/updates/check";
import { act, cleanup, fireEvent } from "@testing-library/preact";
import { afterEach, describe, expect, test } from "vitest";
import type { SetupState } from "../../src/messages.ts";
import type { PageToUi } from "../../src/page-protocol.ts";
import { el, pkg, renderUi, setupState } from "./harness.tsx";

afterEach(cleanup);

const NOW = Date.now();
const base = setupState();

const check = (id: string, over: Partial<PackageCheck>): PackageCheck => ({
  id,
  type: "module",
  state: "update",
  version: "1.1.0",
  availability: 1,
  compatibility: { minimum: "13", verified: "14.369" },
  checkedAt: NOW,
  ...over,
});

/** The sample server, a locked module added, and a check from a minute ago. */
function checked(
  results: PackageCheck[],
  checkedAt: number | null = NOW - 60_000,
): Partial<SetupState> {
  const setup = base.setup;
  if (!setup) throw new Error("sample setup");
  return {
    setup: {
      ...setup,
      modules: [...setup.modules, pkg("held", { locked: true })],
    },
    updatesCheck: { checkedAt, results, refused: {} },
  };
}

const RESULTS = [
  check("a", {}),
  check("b", {
    state: "core",
    version: "2.0.0",
    availability: 8,
    compatibility: { minimum: "14.372" },
  }),
  check("c", { state: "denied", version: undefined, errorCode: 403 }),
  check("lib", { state: "error", version: undefined, error: "timeout" }),
  check("stagehand", { state: "current", version: "1.0.0" }),
];

function updatesTab(data: Partial<SetupState>) {
  const r = renderUi("shell", { data, state: { route: { kind: "library" } } });
  fireEvent.click(r.getByRole("tab", { name: /^Updates/ }));
  return r;
}

const section = (root: ParentNode, name: string) =>
  [...root.querySelectorAll<HTMLElement>(".spu-sec")].find((s) =>
    s.querySelector(".spu-sh")?.textContent.startsWith(name),
  );

describe("the Updates tab", () => {
  test("its count is the updates the owner can act on", () => {
    const r = renderUi("shell", {
      data: checked(RESULTS),
      state: { route: { kind: "library" } },
    });
    expect(r.getByRole("tab", { name: /^Updates/ }).textContent).toBe(
      "Updates 1",
    );
  });

  test("what the check found, in sections, each with its reason", () => {
    const r = updatesTab(checked(RESULTS));
    expect(r.page.packageCheck).not.toHaveBeenCalled();
    const ready = section(r.container, "Ready");
    expect(ready?.textContent).toContain("Title a");
    expect(ready?.textContent).toContain("1.0.0");
    expect(ready?.textContent).toContain("1.1.0");
    expect(ready?.textContent).toContain("verified for 14.369");
    const blocked = section(r.container, "Can't update here");
    expect(blocked?.textContent).toContain(
      "Needs Foundry 14.372 or newer; you have 14.369.",
    );
    const noaccess = section(r.container, "Not available to you");
    expect(noaccess?.textContent).toContain("refused access (403)");
    const failed = section(r.container, "Couldn't check");
    expect(failed?.textContent).toContain("Title lib");
    // A current package has no row; a locked one is named at the foot.
    expect(r.container.textContent).not.toContain("Title stagehand");
    expect(el(r.container, ".spu-locked").textContent).toContain("Title held");
  });

  test("a row's action is a button that checks that package again", () => {
    const r = updatesTab(checked(RESULTS));
    const noaccess = section(r.container, "Not available to you");
    if (!noaccess) throw new Error("no section");
    fireEvent.click(el(noaccess, "button.spu-act"));
    expect(r.page.packageCheck).toHaveBeenCalledWith({
      op: "one",
      type: "module",
      id: "c",
    });
    expect(el(noaccess, ".spu-side").textContent).toBe("Checking…");
  });

  test("Check again checks the whole library, with progress and Stop", () => {
    const r = updatesTab(checked(RESULTS));
    fireEvent.click(el(r.container, ".spu-head button"));
    expect(r.page.packageCheck).toHaveBeenCalledWith({ op: "all" });
    const tick: PageToUi = {
      type: "PACKAGE_CHECK",
      payload: {
        requestId: "check-1",
        kind: "tick",
        done: 1,
        total: 3,
        current: "a",
      },
    };
    void act(() => {
      r.emit(tick);
    });
    expect(el(r.container, ".spu-head").textContent).toContain(
      "Checking 1 of 3",
    );
    expect(el(r.container, ".spu-head").textContent).toContain("Title a");
    fireEvent.click(r.getByRole("button", { name: "Stop" }));
    expect(r.page.stopPackageCheck).toHaveBeenCalledWith("check-1");
  });

  test("never checked, or over an hour ago: opening the tab checks", () => {
    const never = updatesTab(checked([], null));
    expect(never.page.packageCheck).toHaveBeenCalledWith({ op: "all" });
    cleanup();
    const old = updatesTab(checked(RESULTS, NOW - 2 * 60 * 60 * 1000));
    expect(old.page.packageCheck).toHaveBeenCalledWith({ op: "all" });
  });

  test("everything up to date", () => {
    const r = updatesTab(
      checked([check("a", { state: "current", version: "1.0.0" })]),
    );
    expect(el(r.container, ".spu-head").textContent).toContain(
      "Everything is up to date",
    );
    expect(el(r.container, ".spu-empty").textContent).toContain(
      "Nothing to update",
    );
  });
});

describe("updating the ticked packages (phase 3)", () => {
  const SYS = check("dnd5e", { type: "system", version: "5.2" });
  const LIB = check("lib", {});
  const A = check("a", {});

  const ev = (payload: object): PageToUi =>
    ({
      type: "PACKAGE_INSTALL",
      payload: { requestId: "install-1", ...payload },
    }) as PageToUi;

  test("Ready starts ticked; Update installs the ticked ones, systems first, after a backup", () => {
    const r = updatesTab(checked([A, LIB, SYS]));
    expect(el(r.container, ".spu-foot").textContent).toContain(
      "3 packages ticked",
    );
    fireEvent.click(r.getByRole("checkbox", { name: "Update Title lib" }));
    expect(el(r.container, ".spu-foot").textContent).toContain(
      "2 packages ticked",
    );
    fireEvent.click(r.getByRole("button", { name: "Update 2" }));
    expect(r.page.packageInstall).toHaveBeenCalledWith(
      [
        { type: "system", id: "dnd5e" },
        { type: "module", id: "a" },
      ],
      true,
    );
  });

  test("while it runs: each row's state, the foot's progress, the rail, and worlds wait", () => {
    const r = updatesTab(checked([A, SYS]));
    fireEvent.click(r.getByRole("checkbox", { name: "Back up first" }));
    fireEvent.click(r.getByRole("button", { name: "Update 2" }));
    expect(r.page.packageInstall).toHaveBeenCalledWith(
      expect.anything(),
      false,
    );
    void act(() => {
      r.emit(ev({ kind: "item", id: "dnd5e", state: "done" }));
      r.emit(ev({ kind: "item", id: "a", state: "installing" }));
      r.emit({
        type: "PROGRESS",
        payload: {
          action: "installPackage",
          id: "https://x/a.json",
          packageId: "a",
          type: "module",
          step: "download",
          pct: 40,
        },
      });
    });
    expect(el(r.container, '.spu-row[data-id="a"] .spu-side').textContent).toBe(
      "Downloading 40%",
    );
    expect(
      el(r.container, '.spu-row[data-id="dnd5e"] .spu-side').textContent,
    ).toBe("Updated");
    expect(el(r.container, ".spu-foot").textContent).toContain(
      "Updating 2 of 2 · 70%",
    );
    expect(el(r.container, ".sts-lib > span").textContent).toBe(
      "Updating 2 of 2…",
    );
    expect(
      r.getByRole("tab", { name: /^Updates/ }).querySelector(".fa-spinner"),
    ).toBe(null);
  });

  test("the end: a summary, what was updated first, and a refused download remembered", async () => {
    const r = updatesTab(checked([A, LIB]));
    fireEvent.click(r.getByRole("button", { name: "Update 2" }));
    void act(() => {
      r.emit(ev({ kind: "item", id: "lib", state: "done" }));
      r.emit(
        ev({
          kind: "item",
          id: "a",
          state: "failed",
          errorCode: 403,
          error: "Forbidden",
        }),
      );
      r.emit(ev({ kind: "done" }));
    });
    expect(el(r.container, ".spu-sum").textContent).toContain(
      "1 package updated · 1 failed.",
    );
    expect(el(r.container, ".spu-sec.updated").textContent).toContain(
      "Title lib",
    );
    await Promise.resolve();
    expect(r.send).toHaveBeenCalledWith({
      kind: "update-refused",
      id: "a",
      version: "1.1.0",
    });
  });
});
