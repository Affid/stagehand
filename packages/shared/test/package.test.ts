import { describe, expect, test } from "vitest";
import {
  MAX_DESCRIPTION,
  MAX_LINK,
  PackageInfoSchema,
  toPackageInfo,
} from "../src/package.ts";
import { plainText } from "../src/package-read.ts";

// Shaped like a live Foundry Module: relationships are Sets, authors too.
const liveModule = {
  id: "a",
  title: "Module A",
  version: "1.2.0",
  description: "<p>Long HTML, kept as text</p>",
  authors: new Set([
    { name: "Ann", url: "https://ann.example", discord: "ann#1", flags: {} },
  ]),
  url: "https://a.example",
  bugs: "https://a.example/issues",
  library: false,
  packs: new Set([{ name: "p" }]),
  esmodules: new Set(["a.js"]),
  scripts: new Set(),
  styles: new Set(),
  compatibility: { minimum: "13", verified: "14", maximum: undefined },
  relationships: {
    requires: new Set([
      { id: "lib", type: "module", compatibility: { minimum: "2.0.0" } },
    ]),
    recommends: new Set([{ id: "nice", type: "module", reason: "Nice." }]),
    conflicts: new Set([{ id: "bad", type: "module", reason: "Breaks." }]),
    systems: new Set([{ id: "dnd5e", type: "system", compatibility: {} }]),
  },
};

describe("toPackageInfo", () => {
  test("extracts the fields the library uses from a live Foundry package", () => {
    const info = toPackageInfo(liveModule);
    expect(info).toEqual({
      id: "a",
      title: "Module A",
      version: "1.2.0",
      authors: [{ name: "Ann", url: "https://ann.example", discord: "ann#1" }],
      url: "https://a.example",
      bugs: "https://a.example/issues",
      library: false,
      hasPacks: true,
      hasCode: true,
      compatibility: { minimum: "13", verified: "14" },
      requires: [
        { id: "lib", type: "module", compatibility: { minimum: "2.0.0" } },
      ],
      recommends: [{ id: "nice", type: "module", reason: "Nice." }],
      conflicts: [{ id: "bad", type: "module", reason: "Breaks." }],
      systems: [{ id: "dnd5e", type: "system" }],
      // Kept as plain text for the card's line (6b).
      description: "Long HTML, kept as text",
    });
    expect(PackageInfoSchema.parse(info)).toEqual(info);
  });

  test("tolerates missing optional parts", () => {
    const info = toPackageInfo({ id: "x", title: "X" });
    expect(info).toMatchObject({
      id: "x",
      version: "",
      authors: [],
      library: false,
      hasPacks: false,
      hasCode: false,
      requires: [],
    });
  });

  test("schema rejects a package without an id", () => {
    expect(PackageInfoSchema.safeParse({ title: "x" }).success).toBe(false);
  });
});

describe("what the Library shows from a manifest (6b)", () => {
  test("the description as plain text, cut to a card's worth", () => {
    expect(plainText("<p>Voice &amp; video<br>for <b>Foundry</b></p>")).toBe(
      "Voice & video for Foundry",
    );
    expect(plainText("&#65;&nbsp;b")).toBe("A b");
    expect(plainText("<p> </p>")).toBeUndefined();
    expect(plainText(3)).toBeUndefined();
    expect(plainText("x".repeat(900))?.length).toBe(MAX_DESCRIPTION);
  });

  test("favourite, lock, links, packs and languages, bounded", () => {
    const info = toPackageInfo({
      id: "m",
      title: "M",
      favorite: true,
      locked: true,
      readme: "https://x.example/readme",
      license: "x".repeat(MAX_LINK + 1),
      packs: [{ label: "Macros" }, { label: "" }],
      languages: [{ name: "English" }],
    });
    expect(info).toMatchObject({
      favorite: true,
      locked: true,
      readme: "https://x.example/readme",
      packs: ["Macros"],
      languages: ["English"],
    });
    expect(info).not.toHaveProperty("license");
    expect(PackageInfoSchema.safeParse(info).success).toBe(true);
    expect(toPackageInfo({ id: "n" })).not.toHaveProperty("favorite");
  });
});

describe("descriptions that could break the read (security review)", () => {
  test("a numeric entity out of range reads as a space, never throws", () => {
    expect(plainText("a&#1114112;b")).toBe("a b");
    expect(plainText("a&#99999999999;b")).toBe("a b");
    expect(plainText("&#0;x")).toBe("x");
  });
});
