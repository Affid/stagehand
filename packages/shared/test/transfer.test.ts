import { describe, expect, test } from "vitest";
import { emptyLibrary, type Library } from "../src/library/schema.ts";
import {
  exportLibrary,
  exportPreset,
  parseLibraryImport,
  parsePresetImport,
} from "../src/library/transfer.ts";

const library: Library = {
  ...emptyLibrary("http://a:1"),
  revision: 5,
  tags: [{ id: "t1", name: "combat", color: "#33aa77", revision: 1 }],
  presets: [
    {
      id: "p1",
      name: "Core QoL",
      description: "",
      modules: ["a"],
      source: "user",
      revision: 2,
    },
  ],
};

describe("library export and import (D-1)", () => {
  test("round-trips through JSON, rebound to the importing server", () => {
    const text = exportLibrary(library, "2026-11-05T00:00:00Z");
    const result = parseLibraryImport(text, "http://b:2");
    expect(result).toEqual({
      ok: true,
      library: { ...library, serverId: "http://b:2" },
    });
  });

  test("rejects files that are not library exports", () => {
    expect(parseLibraryImport("{}", "s")).toMatchObject({ ok: false });
    expect(parseLibraryImport("not json", "s")).toMatchObject({
      ok: false,
      error: expect.stringMatching(/JSON/),
    });
  });

  test("rejects a newer format version with a clear message", () => {
    const text = JSON.stringify({
      ...JSON.parse(exportLibrary(library, "t")),
      formatVersion: 99,
    });
    expect(parseLibraryImport(text, "s")).toMatchObject({
      ok: false,
      error: expect.stringMatching(/newer/),
    });
  });
});

describe("preset export and import (P-7)", () => {
  test("exports the shareable part only and imports it as a new preset", () => {
    const text = exportPreset(library.presets[0]!, "t");
    expect(JSON.parse(text)).not.toHaveProperty("preset.id");
    expect(parsePresetImport(text)).toEqual({
      ok: true,
      preset: { name: "Core QoL", description: "", modules: ["a"] },
    });
  });
});
