// @vitest-environment happy-dom
import { cleanup, fireEvent } from "@testing-library/preact";
import { afterEach, describe, expect, test } from "vitest";
import { el, renderUi, setupState } from "./harness.tsx";

afterEach(cleanup);

function open(coreUpdate?: {
  hasUpdate: boolean;
  channel: string;
  version: string;
  canUpdate?: boolean;
  reachable?: boolean;
}) {
  const base = setupState();
  const r = renderUi("shell", {
    data: {
      setup: base.setup
        ? { ...base.setup, ...(coreUpdate ? { coreUpdate } : {}) }
        : undefined,
    },
  });
  return r;
}

/** The Version chip's menu leads to the Update page. */
function toUpdate(r: ReturnType<typeof open>, name: string): void {
  fireEvent.click(el(r.container, ".mlh-ver"));
  fireEvent.click(r.getByRole("button", { name }));
}

describe("the Update page", () => {
  test("the Version chip marks an update and opens the page", () => {
    const r = open({ hasUpdate: true, channel: "stable", version: "14.371" });
    const chip = el(r.container, ".mlh-ver");
    expect(chip.textContent).toContain("update");
    toUpdate(r, "See what's new…");
    expect(r.store.get().route).toEqual({ kind: "server", page: "update" });
    const pageEl = el(r.container, ".mlu-page");
    expect(pageEl.textContent).toContain("14.369");
    expect(pageEl.textContent).toContain("14.371 is available");
    const notes = r.getByRole("link", { name: /What's new in 14.371/ });
    expect(notes.getAttribute("href")).toBe(
      "https://foundryvtt.com/releases/14.371",
    );
    expect(notes.getAttribute("rel")).toBe("noopener noreferrer");
    expect(r.queryByRole("button", { name: "Update in Foundry…" })).toBe(null);
  });

  test("up to date says so, with the installed version's notes", () => {
    const r = open({ hasUpdate: false, channel: "stable", version: "" });
    expect(el(r.container, ".mlh-ver").textContent).not.toContain("update");
    toUpdate(r, "Update page");
    expect(el(r.container, ".mlu-page").textContent).toContain("Up to date");
    expect(
      r
        .getByRole("link", { name: /What's new in 14.369/ })
        .getAttribute("href"),
    ).toBe("https://foundryvtt.com/releases/14.369");
  });

  test("the channel reads as a name; updates disabled by --noupdate say so", () => {
    const r = open({
      hasUpdate: false,
      channel: "development",
      version: "",
      canUpdate: false,
      reachable: true,
    });
    toUpdate(r, "Update page");
    const pageEl = el(r.container, ".mlu-page");
    expect(pageEl.textContent).toContain("Development");
    expect(pageEl.textContent).toContain("Up to date");
    expect(pageEl.textContent).toContain("--noupdate");
  });

  test("when foundryvtt.com didn't answer, it doesn't claim up to date", () => {
    const r = open({
      hasUpdate: false,
      channel: "stable",
      version: "",
      reachable: false,
    });
    fireEvent.click(el(r.container, ".mlh-ver"));
    expect(r.container.textContent).toContain("Couldn't reach foundryvtt.com");
    fireEvent.click(r.getByRole("button", { name: "Update page" }));
    const pageEl = el(r.container, ".mlu-page");
    expect(pageEl.textContent).not.toContain("Up to date");
    expect(pageEl.textContent).toContain("Couldn't reach foundryvtt.com");
  });

  test("a version that isn't a plain number gets no link", () => {
    const r = open({ hasUpdate: true, channel: "stable", version: "../evil" });
    toUpdate(r, "See what's new…");
    expect(r.queryByRole("link", { name: /evil/ })).toBe(null);
  });
});
