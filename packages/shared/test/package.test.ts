import { describe, expect, test } from "vitest";
import { PackageInfoSchema, toPackageInfo } from "../src/package.ts";

// Shaped like a live Foundry Module: relationships are Sets, authors too.
const liveModule = {
  id: "a",
  title: "Module A",
  version: "1.2.0",
  description: "<p>Long HTML we do not keep</p>",
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
