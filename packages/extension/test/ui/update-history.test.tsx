// @vitest-environment happy-dom
// Release history on the Update page (package 7): Foundry's public list and
// each release's notes from foundryvtt.com, through the background, only
// with the browser's permission; without it, how to allow it.
import { cleanup, fireEvent, waitFor, within } from "@testing-library/preact";
import { afterEach, describe, expect, test } from "vitest";
import type { ExtensionMessage } from "../../src/messages.ts";
import type { Release } from "../../src/page-update.ts";
import {
  parseReleaseList,
  releaseNotesOf,
} from "../../src/ui/shell/server/update/releases.ts";
import { el, renderUi, sent, setupState } from "./harness.tsx";

afterEach(cleanup);

const li = (v: string, date: string, tags: string) =>
  `<li class="article release flexrow"><h3 class="article-title"><a href="/releases/${v}">Release ${v}</a></h3><span class="release-time">${date}</span><div class="release-tags">${tags}</div></li>`;
const LIST = `<nav><a href="/releases/">Releases</a></nav><section><h2>Version 14</h2><ol class="index-list releases-list">
${li("14.372", "December 01, 2026", '<span class="release-tag">Update</span><span class="release-tag testing">Testing</span>')}
${li("14.371", "November 20, 2026", '<span class="release-tag">Update</span><span class="release-tag stable">Stable</span>')}
${li("14.370", "November 02, 2026", '<span class="release-tag">Full</span><span class="release-tag stable">Stable</span>')}
${li("14.369", "October 08, 2026", '<span class="release-tag">Update</span><span class="release-tag stable">Stable</span>')}
${li("13.351", "May 01, 2026", '<span class="release-tag">Update</span><span class="release-tag stable">Stable</span>')}
<li class="article release"><a href="https://evil.example/releases/99.1">x</a></li>
</ol></section>`;
const page = (v: string) =>
  `<header><h1 id="site-title">Release ${v}</h1><nav><ul><li>Site menu</li></ul></nav></header><article class="primary-content"><h5 class="release-date">Date</h5><header><h2>Foundry Virtual Tabletop - Version 14 - Build ${v} Release Notes</h2></header><section><h2>Bug Fixes</h2><ul><li>Fixed ${v}. <a href="https://github.com/foundryvtt/foundryvtt/issues/1">(1)</a></li></ul></section></article>`;

const RELEASE: Release = {
  version: "14.371",
  generation: 14,
  build: 371,
  channel: "stable",
  suffix: "Stable 13",
  time: 1,
  notes: "<h2>Bug Fixes</h2><ul><li>x</li></ul>",
  manual: false,
};

async function open(permitted = true) {
  const base = setupState();
  const data = {
    setup: base.setup && {
      ...base.setup,
      coreUpdate: { hasUpdate: true, channel: "stable", version: "14.371" },
    },
  };
  const full = setupState(data);
  const reply = (m: ExtensionMessage): unknown => {
    if (m.kind === "foundry-releases")
      return permitted
        ? { permitted, html: m.version ? page(m.version) : LIST }
        : { permitted };
    return m.kind === "get-state" ? full : undefined;
  };
  const r = renderUi("shell", {
    data,
    reply,
    state: { route: { kind: "server", page: "update" } },
    answers: (p) => {
      p.update.mockResolvedValue({ release: RELEASE });
    },
  });
  await waitFor(() => {
    expect(r.queryByRole("tab", { name: /Release history/ })).toBeTruthy();
  });
  fireEvent.click(r.getByRole("tab", { name: /Release history/ }));
  return r;
}

describe("Foundry's release pages", () => {
  test("the list: versions, dates, channels, Full as installed by hand", () => {
    const list = parseReleaseList(LIST);
    expect(list.map((x) => x.version)).toEqual([
      "14.372",
      "14.371",
      "14.370",
      "14.369",
      "13.351",
    ]);
    expect(list[2]).toMatchObject({
      date: "November 02, 2026",
      channel: "stable",
      full: true,
    });
    expect(list[0]?.channel).toBe("testing");
  });

  test("a release's notes are its article, without the site around it", () => {
    const html = releaseNotesOf(page("14.371"));
    expect(html).toContain("Fixed 14.371.");
    expect(html).not.toContain("Site menu");
    expect(html).not.toContain("release-date");
  });
});

describe("Release history", () => {
  test("this generation on your channel; the newest newer release is shown first", async () => {
    const r = await open();
    const hist = await waitFor(() => el(r.container, ".mlu-hist .mlu-rels"));
    const versions = [...hist.querySelectorAll("li strong")].map(
      (s) => s.textContent,
    );
    expect(versions).toEqual(["14.371", "14.370", "14.369"]);
    expect(el(r.container, ".mlu-hist .mlu-nhead").textContent).toContain(
      "2 releases since your 14.369",
    );
    const on = el(hist, "li.on");
    expect(on.textContent).toContain("14.371");
    expect(on.textContent).toContain("new");
    expect(
      within(hist).getByText("manual").closest("li")?.textContent,
    ).toContain("14.370");
    expect(
      within(hist).getByText("installed").closest("li")?.textContent,
    ).toContain("14.369");
    await waitFor(() => {
      expect(el(r.container, ".mlu-hnotes").textContent).toContain(
        "Fixed 14.371.",
      );
    });
    expect(el(r.container, ".mlu-hhead").textContent).toContain("1 change");
  });

  test("another release's notes are read when it is picked", async () => {
    const r = await open();
    await waitFor(() => el(r.container, ".mlu-hist .mlu-rels"));
    fireEvent.click(r.getByRole("button", { name: /^14\.369/ }));
    await waitFor(() => {
      expect(el(r.container, ".mlu-hnotes").textContent).toContain(
        "Fixed 14.369.",
      );
    });
    expect(sent(r.send)).toContainEqual({
      kind: "foundry-releases",
      version: "14.369",
    });
  });

  test("Include testing and development adds those channels", async () => {
    const r = await open();
    await waitFor(() => el(r.container, ".mlu-hist .mlu-rels"));
    fireEvent.click(
      r.getByRole("checkbox", { name: "Include testing and development" }),
    );
    const hist = el(r.container, ".mlu-hist .mlu-rels");
    expect(hist.querySelector("li strong")?.textContent).toBe("14.372");
    expect(hist.textContent).toContain("testing");
  });

  test("without the permission: why, the way to allow it, and the site itself", async () => {
    const r = await open(false);
    const ask = await waitFor(() => el(r.container, ".mlu-hask"));
    expect(ask.textContent).toContain(
      "one extra permission for foundryvtt.com",
    );
    expect(
      within(ask)
        .getByRole("link", { name: "Open foundryvtt.com/releases" })
        .getAttribute("href"),
    ).toBe("https://foundryvtt.com/releases/");
    fireEvent.click(
      within(ask).getByRole("button", {
        name: "Allow reading foundryvtt.com…",
      }),
    );
    await waitFor(() => {
      expect(sent(r.send)).toContainEqual({ kind: "ask-foundryvtt" });
    });
  });
});
