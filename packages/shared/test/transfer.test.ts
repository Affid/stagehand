import { describe, expect, test } from "vitest";
import { emptyLibrary, type Library } from "../src/library/schema.ts";
import {
  exportLibrary,
  exportPreset,
  parseLibraryImport,
  parsePresetImport,
  rebaseRevisions,
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

  test("names itself Stagehand; an export from before the rename still imports", () => {
    const text = exportLibrary(library, "2026-11-05T00:00:00Z");
    expect(JSON.parse(text)).toMatchObject({ format: "stagehand" });
    const old = JSON.stringify({
      ...JSON.parse(text),
      format: "module-library",
    });
    expect(parseLibraryImport(old, "http://b:2")).toMatchObject({ ok: true });
    const other = JSON.stringify({ ...JSON.parse(text), format: "elsewhere" });
    expect(parseLibraryImport(other, "s")).toMatchObject({
      ok: false,
      error: "The file is not a Stagehand export.",
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

describe("rebaseRevisions (import keeps D-2)", () => {
  test("every imported entity is newer than any copy an editor holds", () => {
    const current: Library = {
      ...library,
      presets: [{ ...library.presets[0]!, revision: 7 }],
    };
    const imported: Library = {
      ...library,
      presets: [{ ...library.presets[0]!, revision: 2 }],
      folders: [
        {
          id: "f",
          name: "F",
          color: "#000000",
          parentId: null,
          order: 0,
          collapsed: false,
          revision: 1,
        },
      ],
    };
    const next = rebaseRevisions(current, imported);
    expect(next.presets[0]?.revision).toBe(8);
    expect(next.tags[0]?.revision).toBe(2);
    expect(next.folders[0]?.revision).toBe(2);
  });
});
