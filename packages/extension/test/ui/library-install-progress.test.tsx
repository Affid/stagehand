// @vitest-environment happy-dom
// Updates plan, phase 1 (docs/UPDATES-PLAN.md): Foundry's install progress,
// which our page already receives, shows where the owner looks: the card's
// update chip, the panel, the rail's Library line; worlds wait for it.
import { act, cleanup, fireEvent } from "@testing-library/preact";
import { afterEach, describe, expect, test } from "vitest";
import type { PageToUi } from "../../src/page-protocol.ts";
import { el, renderUi } from "./harness.tsx";

afterEach(cleanup);

const URL_A = "https://example.com/a/module.json";

const install = (packageId: string, over: object = {}): PageToUi => ({
  type: "PROGRESS",
  payload: {
    action: "installPackage",
    id: `https://example.com/${packageId}/manifest.json`,
    packageId,
    type: "module",
    ...over,
  },
});

const library = () =>
  renderUi("shell", {
    state: {
      route: { kind: "library" },
      updates: { module: { a: "1.1.0" }, system: { dnd5e: "5.2" } },
    },
    answers: () => undefined,
  });

const card = (root: ParentNode, id: string) =>
  el(root, `.stl-card[data-module="${id}"]`);

describe("a module's update, while Foundry installs it", () => {
  test("its chip shows the download's percentage, then that it installs", () => {
    const r = library();
    void act(() => {
      r.emit(install("a", { id: URL_A, step: "download", pct: 45 }));
    });
    const chip = el(card(r.container, "a"), ".spu-chip");
    expect(chip.textContent).toBe("45%");
    expect(chip.getAttribute("aria-label")).toBe("Updating Title a: 45%");
    expect(card(r.container, "a").querySelector("button.stw-upd")).toBe(null);
    void act(() => {
      r.emit(install("a", { id: URL_A, step: "install" }));
    });
    expect(el(card(r.container, "a"), ".spu-chip").textContent).toBe(
      "installing",
    );
    void act(() => {
      r.emit(install("a", { id: URL_A, step: "complete" }));
    });
    expect(card(r.container, "a").querySelector(".spu-chip")).toBe(null);
  });

  test("a module without a mark shows its progress too (Foundry's Update All found it)", () => {
    const r = library();
    void act(() => {
      r.emit(install("b", { step: "download", pct: 10 }));
    });
    expect(el(card(r.container, "b"), ".spu-chip").textContent).toBe("10%");
  });

  test("the rail's Library line says what is updating", () => {
    const r = library();
    const line = () => el(r.container, ".sts-lib > span").textContent;
    expect(line()).toContain("2 updates");
    void act(() => {
      r.emit(install("a", { step: "download", pct: 5 }));
    });
    expect(line()).toBe("Updating Title a…");
    void act(() => {
      r.emit(install("b", { step: "download", pct: 5 }));
    });
    expect(line()).toBe("Updating 2 packages…");
  });

  test("a package that isn't installed yet is installing, not updating", () => {
    const r = library();
    const line = () => el(r.container, ".sts-lib > span").textContent;
    void act(() => {
      r.emit(install("new-mod", { step: "download", pct: 5 }));
    });
    expect(line()).toBe("Installing new-mod…");
    void act(() => {
      r.emit(install("a", { step: "download", pct: 5 }));
    });
    expect(line()).toBe("Installing 2 packages…");
  });

  test("the panel's Update box shows the progress", () => {
    const r = library();
    fireEvent.click(el(card(r.container, "a"), "button.t"));
    fireEvent.click(r.getByRole("tab", { name: "Package" }));
    void act(() => {
      r.emit(install("a", { step: "download", pct: 30 }));
    });
    expect(el(r.container, ".sts-panel .spu-box").textContent).toContain(
      "Downloading 30%",
    );
  });
});

describe("a module in our run of updates (phase 3)", () => {
  test("its chip says backup while it is backed up, then waiting", () => {
    const r = library();
    const run = (state: "backup" | "backedUp") => {
      r.store.set((s) => ({
        install: {
          ...s.install,
          running: {
            requestId: "i1",
            ids: ["a"],
            backup: true,
            states: { a: state },
            versions: { a: { from: "1.0.0", to: "1.1.0" } },
            errors: {},
          },
        },
      }));
    };
    void act(() => {
      run("backup");
    });
    expect(el(card(r.container, "a"), ".spu-chip").textContent).toBe("backup");
    void act(() => {
      run("backedUp");
    });
    expect(el(card(r.container, "a"), ".spu-chip").textContent).toBe("waiting");
  });
});

describe("a system's update, while Foundry installs it", () => {
  test("its chip on the Systems tab shows the progress", () => {
    const r = library();
    fireEvent.click(r.getByRole("tab", { name: /^Systems/ }));
    void act(() => {
      r.emit(install("dnd5e", { type: "system", step: "download", pct: 70 }));
    });
    const sys = el(r.container, '.stl-card[data-system="dnd5e"]');
    expect(el(sys, ".spu-chip").textContent).toBe("70%");
  });
});

describe("worlds wait for an install", () => {
  test("Launch is off with the reason while Foundry installs", () => {
    const r = renderUi("shell", {
      state: { route: { kind: "world", worldId: "w1" } },
    });
    const launch = () =>
      r.getAllByRole("button", { name: /^Launch/ })[0] as HTMLButtonElement;
    expect(launch().disabled).toBe(false);
    void act(() => {
      r.emit(install("a", { step: "download", pct: 5 }));
    });
    expect(launch().disabled).toBe(true);
    expect(
      r.container.textContent +
        (launch().closest("[title]")?.getAttribute("title") ?? ""),
    ).toContain("Wait for the updates to finish");
  });
});
