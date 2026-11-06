// @vitest-environment happy-dom
// Foundry's release notes read for the notes reader (package 7).
import { describe, expect, test } from "vitest";
import {
  bannerSrc,
  entriesOf,
  parseNotes,
} from "../../src/ui/shell/server/update/notes.ts";

describe("Foundry's release notes", () => {
  test("only Foundry's own https images are shown as the banner", () => {
    expect(bannerSrc("https://r2.foundryvtt.com/a.webp")).toBe(
      "https://r2.foundryvtt.com/a.webp",
    );
    expect(bannerSrc("http://r2.foundryvtt.com/a.webp")).toBeUndefined();
    expect(
      bannerSrc("https://evil.example/foundryvtt.com.png"),
    ).toBeUndefined();
    expect(
      bannerSrc("https://foundryvtt.com.evil.example/a.png"),
    ).toBeUndefined();
    expect(bannerSrc("not a url")).toBeUndefined();
    const notes = parseNotes(
      '<figure><img src="https://evil.example/x.png"></figure><h2>Bug Fixes</h2><ul><li>x</li></ul>',
    );
    expect(notes.banner).toBeNull();
  });

  test("the overview's highlights list stays; empty sections go", () => {
    const notes = parseNotes(
      "<section><p>Hello.</p><dl><dt>Passwords</dt><dd>Players set them.</dd></dl></section>" +
        '<h2>New Features</h2><h3>Empty area</h3><h2>Bug Fixes</h2><ul><li>Fixed. <a href="https://github.com/foundryvtt/foundryvtt/issues/7">(7)</a></li></ul>',
    );
    expect(notes.intro.map((e) => e.tagName)).toEqual(["P", "DL"]);
    expect(notes.sections.map((s) => s.h)).toEqual(["Bug Fixes"]);
    const [fix] = entriesOf(notes.sections[0]!);
    expect(fix).toMatchObject({ issue: 7, text: "Fixed." });
  });

  test("a link elsewhere on GitHub is kept as a link, not an issue", () => {
    const notes = parseNotes(
      '<h2>Bug Fixes</h2><ul><li>See <a href="https://github.com/other/repo/issues/9">this</a>.</li></ul>',
    );
    const [e] = entriesOf(notes.sections[0]!);
    expect(e?.issue).toBeNull();
    expect(e?.node.querySelector("a")).toBeTruthy();
  });
});
