// @vitest-environment happy-dom
// The Update page as the prototype (package 7): Foundry's update check runs
// when the page opens; its release notes are read with a search, developer
// notes and jump links; the Update box takes a snapshot first, says why it
// can't install (by hand, or --noupdate), changes channel, forces, shows
// Foundry's steps while it runs, and what happens next.
import { cleanup, fireEvent, waitFor, within } from "@testing-library/preact";
import { afterEach, describe, expect, test } from "vitest";
import type { Release } from "../../src/page-update.ts";
import type { UpdateResult } from "../../src/ui/page.ts";
import { el, renderUi, setupState } from "./harness.tsx";

afterEach(cleanup);

const NOTES = `<header><h2 class="border">Foundry Virtual Tabletop - Version 14 - Stable 13 Release Notes</h2>
<figure><img alt="Banner" src="https://r2.foundryvtt.com/banner.webp"><figcaption>The banner</figcaption></figure></header>
<section><p>We recommend this release.</p><p onclick="alert(1)">Back up first.</p>
<section><h3>Breaking Changes</h3><ul><li>Changed <code>A#b</code>. <a href="https://github.com/foundryvtt/foundryvtt/issues/14864">(14864)</a></li></ul></section>
<section><h2>New Features</h2><h3>Applications and User Interface</h3><ul><li>Players set their passwords. <a href="https://github.com/foundryvtt/foundryvtt/issues/5409">(5409)</a></li></ul>
<h3>Package Development</h3><ul><li>Hot reload for languages.</li></ul></section>
<section><h2>API Improvements</h2><ul><li>Added <code>Grid#x</code>.</li></ul></section>
<section><h2>Bug Fixes</h2><h3>The Game Canvas</h3><ul><li>Fixed vision flicker. <a href="https://github.com/foundryvtt/foundryvtt/issues/14966">(14966)</a></li><li>Fixed <a href="javascript:alert(1)">walls</a>.</li></ul></section></section>`;

const RELEASE: Release = {
  version: "14.371",
  generation: 14,
  build: 371,
  channel: "stable",
  suffix: "Stable 13",
  time: Date.UTC(2026, 10, 5),
  notes: NOTES,
  manual: false,
};

async function open(
  check: UpdateResult = { release: RELEASE },
  coreUpdate: { canUpdate?: boolean } = {},
) {
  const base = setupState();
  const r = renderUi("shell", {
    data: {
      setup: base.setup && {
        ...base.setup,
        coreUpdate: {
          hasUpdate: true,
          channel: "stable",
          version: "14.371",
          ...coreUpdate,
        },
      },
    },
    state: { route: { kind: "server", page: "update" } },
    answers: (page) => {
      page.update.mockResolvedValue(check);
      page.config.mockResolvedValue({
        settings: {
          updateChannel: "stable",
          electron: false,
          noBackups: false,
        } as never,
        choices: {
          worlds: [],
          languages: [],
          themes: [],
          channels: [
            { value: "stable", label: "Stable" },
            { value: "testing", label: "Testing" },
            { value: "prototype", label: "Prototype" },
          ],
        },
      });
    },
  });
  await waitFor(() => {
    expect(r.container.querySelector(".mlu-page [role=status]")).toBe(null);
  });
  return r;
}

describe("the Update page", () => {
  test("it asks Foundry on the configured channel when it opens", async () => {
    const r = await open();
    expect(r.page.update).toHaveBeenCalledWith({
      op: "check",
      channel: "stable",
      force: false,
    });
    const head = el(r.container, ".mlu-page .mlb-head");
    expect(head.textContent).toContain("You're on Foundry 14.369 (Stable).");
    expect(head.textContent).toContain("14.371 is available.");
  });

  test("up to date: says so, with Check again", async () => {
    const r = await open({ info: "SETUP.UpdateNotAvailable" });
    expect(r.container.textContent).toContain("Foundry is up to date");
    expect(r.container.textContent).toContain(
      "Foundry 14.369 is the latest Stable version.",
    );
    fireEvent.click(r.getByRole("button", { name: "Check again" }));
    await waitFor(() => {
      expect(r.page.update).toHaveBeenCalledTimes(2);
    });
  });

  test("a failed check doesn't claim up to date", async () => {
    const r = await open({ error: "foundryvtt.com did not answer" });
    expect(r.container.textContent).toContain("Couldn't check for updates");
    expect(r.container.textContent).not.toContain("up to date");
  });
});

describe("What's new (the notes reader)", () => {
  test("title, sections, areas, issue numbers as links, and nothing unsafe", async () => {
    const r = await open();
    const notes = el(r.container, ".mlu-notes");
    expect(notes.querySelector("h3")?.textContent).toBe(
      "Release notes: Version 14 - Stable 13",
    );
    expect(notes.textContent).toContain("Foundry 14.371");
    const issue = within(notes).getByRole("link", { name: "#5409" });
    expect(issue.getAttribute("href")).toBe(
      "https://github.com/foundryvtt/foundryvtt/issues/5409",
    );
    expect(notes.textContent).not.toContain("(5409)");
    expect(notes.querySelector("[onclick]")).toBe(null);
    expect(notes.querySelector('a[href^="javascript"]')).toBe(null);
    expect(notes.querySelector("img")?.getAttribute("src")).toBe(
      "https://r2.foundryvtt.com/banner.webp",
    );
  });

  test("Breaking Changes, New Features and Bug Fixes open; the rest fold", async () => {
    const r = await open();
    const open_ = (name: RegExp) =>
      r.getByRole("button", { name }).getAttribute("aria-expanded");
    expect(open_(/^Breaking Changes/)).toBe("true");
    expect(open_(/^API Improvements/)).toBe("false");
    fireEvent.click(r.getByRole("button", { name: /^API Improvements/ }));
    expect(r.container.textContent).toContain("Grid#x");
  });

  test("jump links count each section", async () => {
    const r = await open();
    const jump = el(r.container, ".mlu-jump");
    expect(jump.textContent).toContain("1 breaking change");
    expect(jump.textContent).toContain("2 new features");
    expect(jump.textContent).toContain("2 bug fixes");
  });

  test("the search finds entries by text or issue number", async () => {
    const r = await open();
    fireEvent.input(r.getByRole("searchbox", { name: "Search the notes" }), {
      target: { value: "14966" },
    });
    const body = el(r.container, ".mlu-body");
    expect(body.textContent).toContain("Fixed vision flicker");
    expect(body.textContent).not.toContain("Players set");
    fireEvent.input(r.getByRole("searchbox", { name: "Search the notes" }), {
      target: { value: "zzz" },
    });
    expect(body.textContent).toContain("Nothing matches.");
  });

  test("Developer notes off hides API and Package Development", async () => {
    const r = await open();
    fireEvent.click(r.getByRole("checkbox", { name: "Developer notes" }));
    expect(r.queryByRole("button", { name: /^API Improvements/ })).toBe(null);
    expect(r.container.textContent).not.toContain("Hot reload");
    expect(el(r.container, ".mlu-jump").textContent).toContain("1 new feature");
  });
});

describe("the Update box", () => {
  test("Snapshot, then update: Foundry downloads after the snapshot", async () => {
    const r = await open();
    expect(
      (
        r.getByRole("checkbox", {
          name: /Take a snapshot first/,
        }) as HTMLInputElement
      ).checked,
    ).toBe(true);
    r.page.update.mockResolvedValueOnce({ installed: true });
    fireEvent.click(
      r.getByRole("button", { name: "Snapshot, then update 14.371" }),
    );
    await waitFor(() => {
      expect(r.page.update).toHaveBeenLastCalledWith({
        op: "download",
        channel: "stable",
        force: false,
        snapshot: true,
        version: "14.371",
      });
    });
    await waitFor(() => {
      expect(r.container.textContent).toContain("Installed Foundry 14.371");
    });
    expect(r.container.textContent).toContain("shutting down");
  });

  test("while it runs: Foundry's steps and percent", async () => {
    const r = await open();
    r.page.update.mockReturnValueOnce(new Promise(() => undefined));
    fireEvent.click(r.getByRole("checkbox", { name: /Take a snapshot first/ }));
    fireEvent.click(
      r.getByRole("button", { name: "Download and install 14.371" }),
    );
    r.emit({
      type: "PROGRESS",
      payload: {
        action: "updateDownload",
        id: "updateCore",
        step: "extract",
        pct: 60,
      },
    });
    await waitFor(() => {
      expect(r.container.textContent).toContain("Updating to 14.371");
    });
    const box = el(r.container, ".mlu-act");
    expect(box.textContent).toContain("60%");
    expect(el(box, ".mlu-steps li.done").textContent).toBe("Downloading");
    expect(el(box, ".mlu-steps li.now").textContent).toBe("Extracting");
  });

  test("a release to install by hand says why, with the download page", async () => {
    const r = await open({ release: { ...RELEASE, manual: true } });
    const go = r.getByRole("button", {
      name: "Manual installation required",
    }) as HTMLButtonElement;
    expect(go.disabled).toBe(true);
    expect(
      r.getByRole("link", { name: "Download page" }).getAttribute("href"),
    ).toBe("https://foundryvtt.com/me/licenses");
    expect(r.queryByRole("checkbox", { name: /Take a snapshot/ })).toBe(null);
  });

  test("--noupdate: Updates disabled, and why", async () => {
    const r = await open({ release: RELEASE }, { canUpdate: false });
    expect(
      (r.getByRole("button", { name: "Updates disabled" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(el(r.container, ".mlu-why").textContent).toContain("--noupdate");
  });

  test("the channel: Foundry's own three, a hint, and a new check on change", async () => {
    const r = await open();
    const select = r.getByRole("combobox", {
      name: "Update channel",
    }) as HTMLSelectElement;
    expect([...select.querySelectorAll("option")].map((o) => o.value)).toEqual([
      "stable",
      "testing",
    ]);
    expect(el(r.container, ".mlu-chan").textContent).toContain(
      "recommended for live games",
    );
    fireEvent.change(select, { target: { value: "testing" } });
    await waitFor(() => {
      expect(r.page.update).toHaveBeenLastCalledWith({
        op: "check",
        channel: "testing",
        force: false,
      });
    });
  });

  test("Advanced: force update goes with the download", async () => {
    const r = await open();
    fireEvent.click(r.getByRole("button", { name: "Advanced: force update" }));
    fireEvent.click(r.getByRole("checkbox", { name: /Force update/ }));
    fireEvent.click(r.getByRole("button", { name: /then update 14.371/ }));
    await waitFor(() => {
      expect(r.page.update).toHaveBeenLastCalledWith(
        expect.objectContaining({ op: "download", force: true }),
      );
    });
  });

  test("a failed update says so and can be tried again", async () => {
    const r = await open();
    r.page.update.mockResolvedValueOnce({ error: "Disk full" });
    fireEvent.click(r.getByRole("button", { name: /then update 14.371/ }));
    await waitFor(() => {
      expect(r.getByRole("alert").textContent).toContain("Disk full");
    });
    expect(r.getByRole("button", { name: /then update 14.371/ })).toBeTruthy();
  });
});
