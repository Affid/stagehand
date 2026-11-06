// @vitest-environment happy-dom
import { cleanup, fireEvent } from "@testing-library/preact";
import { afterEach, describe, expect, test } from "vitest";
import { el, renderUi, setupState } from "./harness.tsx";

afterEach(cleanup);

function open(coreUpdate?: {
  hasUpdate: boolean;
  channel: string;
  version: string;
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

describe("the Update page", () => {
  test("the Version chip marks an update and opens the page", () => {
    const r = open({ hasUpdate: true, channel: "stable", version: "14.371" });
    const chip = el(r.container, ".mlh-ver");
    expect(chip.textContent).toContain("update");
    fireEvent.click(chip);
    expect(r.store.get().route).toEqual({ kind: "server", page: "update" });
    const pageEl = el(r.container, ".mlu-page");
    expect(pageEl.textContent).toContain("14.369");
    expect(pageEl.textContent).toContain("14.371 is available");
    const notes = r.getByRole("link", { name: /What's new in 14.371/ });
    expect(notes.getAttribute("href")).toBe(
      "https://foundryvtt.com/releases/14.371",
    );
    expect(notes.getAttribute("rel")).toBe("noopener noreferrer");
    fireEvent.click(r.getByRole("button", { name: "Update in Foundry…" }));
    expect(r.page.foundryAction).toHaveBeenCalledWith({ action: "update" });
  });

  test("up to date says so, with the installed version's notes", () => {
    const r = open({ hasUpdate: false, channel: "stable", version: "" });
    expect(el(r.container, ".mlh-ver").textContent).not.toContain("update");
    fireEvent.click(el(r.container, ".mlh-ver"));
    expect(el(r.container, ".mlu-page").textContent).toContain("Up to date");
    expect(
      r
        .getByRole("link", { name: /What's new in 14.369/ })
        .getAttribute("href"),
    ).toBe("https://foundryvtt.com/releases/14.369");
  });

  test("a version that isn't a plain number gets no link", () => {
    const r = open({ hasUpdate: true, channel: "stable", version: "../evil" });
    fireEvent.click(el(r.container, ".mlh-ver"));
    expect(r.queryByRole("link", { name: /evil/ })).toBe(null);
  });
});
