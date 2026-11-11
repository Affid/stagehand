// @vitest-environment happy-dom
// A server without the companion module (issue 1): the Library says so and
// offers Foundry's install; a world's setup steps start with it.
import {
  COMPANION_ID,
  COMPANION_INSTALL_TASK,
} from "@stagehand/shared/companion";
import { act, cleanup, fireEvent } from "@testing-library/preact";
import { afterEach, describe, expect, test } from "vitest";
import type { SetupState } from "../../src/messages.ts";
import { el, pkg, renderUi, setupState } from "./harness.tsx";

afterEach(cleanup);

const base = setupState();

/** The sample server with the companion taken out, or in another version. */
function server(version?: string): Partial<SetupState> {
  const others = (base.setup?.modules ?? []).filter(
    (m) => m.id !== COMPANION_ID,
  );
  const modules = version
    ? [...others, pkg(COMPANION_ID, { version })]
    : others;
  return { setup: base.setup ? { ...base.setup, modules } : undefined };
}

const library = (data: Partial<SetupState>) =>
  renderUi("shell", { data, state: { route: { kind: "library" } } });

const world = (data: Partial<SetupState>) =>
  renderUi("shell", {
    data,
    state: { route: { kind: "world", worldId: "w1" } },
  });

const INSTALL = { action: "installCompanion" };

describe("the Library on a server without the companion", () => {
  test("no band while the companion is installed", () => {
    const { container } = library({});
    expect(container.querySelector(".sts-companion-band")).toBe(null);
  });

  test("says it is missing and installs it through Foundry", () => {
    const r = library(server());
    const band = el(r.container, ".sts-companion-band");
    expect(band.textContent).toContain(
      "Stagehand's companion module isn't installed on this server",
    );
    fireEvent.click(r.getByRole("button", { name: "Install" }));
    expect(r.page.foundryAction).toHaveBeenCalledExactlyOnceWith(INSTALL);
  });

  test("while Foundry installs it, the button waits", () => {
    const r = library(server());
    void act(() => {
      r.emit({
        type: "PROGRESS",
        payload: {
          action: "installPackage",
          id: COMPANION_INSTALL_TASK,
          packageId: COMPANION_ID,
          step: "start",
        },
      });
    });
    const button = r.getByRole("button", { name: "Installing…" });
    expect(button).toHaveProperty("disabled", true);
    void act(() => {
      r.emit({
        type: "PROGRESS",
        payload: {
          action: "installPackage",
          id: COMPANION_INSTALL_TASK,
          step: "complete",
        },
      });
    });
    expect(r.getByRole("button", { name: "Install" })).toHaveProperty(
      "disabled",
      false,
    );
  });

  test("an older companion is offered Foundry's update", () => {
    const r = library(server("0.0.1"));
    expect(el(r.container, ".sts-companion-band").textContent).toContain(
      "Stagehand's companion module is out of date",
    );
    fireEvent.click(r.getByRole("button", { name: "Update" }));
    expect(r.page.foundryAction).toHaveBeenCalledExactlyOnceWith(INSTALL);
  });

  test("a read-only browser is told, without the button", () => {
    const r = library({ ...server(), adminVerified: false });
    expect(el(r.container, ".sts-companion-band").textContent).toContain(
      "isn't installed",
    );
    expect(r.queryByRole("button", { name: "Install" })).toBe(null);
  });
});

describe("a world on a server without the companion", () => {
  test("its setup starts with installing the companion, not a launch", () => {
    const r = world(server());
    const steps = [...el(r.container, ".stw-empty ol").children].map(
      (li) => li.textContent,
    );
    expect(steps[0]).toBe("Install Stagehand's companion module.");
    expect(steps).toHaveLength(4);
    expect(r.queryByRole("button", { name: "Launch to set it up" })).toBe(null);
    fireEvent.click(r.getByRole("button", { name: "Install the companion" }));
    expect(r.page.foundryAction).toHaveBeenCalledExactlyOnceWith(INSTALL);
  });

  test("with the companion installed, the steps start at the launch", () => {
    const r = world({});
    expect(el(r.container, ".stw-empty ol").children).toHaveLength(3);
    expect(r.getByRole("button", { name: "Launch to set it up" })).toBeTruthy();
  });
});
