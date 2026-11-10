import type { WorldInfo } from "@stagehand/shared/world";
import { describe, expect, test } from "vitest";
import {
  cssImage,
  filterWorlds,
  resolveRoute,
} from "../../src/ui/shell/route.ts";

const world = (id: string, over: Partial<WorldInfo> = {}): WorldInfo => ({
  id,
  title: `World ${id}`,
  system: "dnd5e",
  systemVersion: "5",
  coreVersion: "14.370",
  ...over,
});

const worlds = [
  world("old", { lastPlayed: "2026-01-01T00:00:00Z" }),
  world("fav", { favorite: true }),
  world("new", { lastPlayed: "2026-11-01T00:00:00Z" }),
];

describe("which page the shell shows", () => {
  test("nothing chosen yet: the first world in Foundry's order", () => {
    expect(resolveRoute(null, worlds)).toEqual({
      kind: "world",
      worldId: "fav",
    });
  });

  test("a chosen world that still exists stays", () => {
    const r = { kind: "world", worldId: "old" } as const;
    expect(resolveRoute(r, worlds)).toBe(r);
  });

  test("a world that went away falls back to the first one", () => {
    expect(resolveRoute({ kind: "world", worldId: "gone" }, worlds)).toEqual({
      kind: "world",
      worldId: "fav",
    });
  });

  test("no worlds at all: the Library", () => {
    expect(resolveRoute(null, [])).toEqual({ kind: "library" });
    expect(resolveRoute({ kind: "library" }, worlds)).toEqual({
      kind: "library",
    });
  });
});

describe("the worlds filter", () => {
  test("matches titles without caring about case, empty shows all", () => {
    expect(filterWorlds(worlds, "")).toBe(worlds);
    expect(filterWorlds(worlds, "  ")).toBe(worlds);
    expect(filterWorlds(worlds, "FAV").map((w) => w.id)).toEqual(["fav"]);
    expect(filterWorlds(worlds, "nothing")).toEqual([]);
  });
});

describe("world artwork as a CSS image", () => {
  const origin = "http://localhost:30000";

  test("Foundry's relative paths become quoted same-origin URLs", () => {
    expect(cssImage("worlds/strahd/bg.webp", origin)).toBe(
      'url("http://localhost:30000/worlds/strahd/bg.webp")',
    );
  });

  test("quotes and spaces can't break out of the url()", () => {
    const css = cssImage('worlds/a b/x").png', origin) ?? "";
    expect(css).toBe('url("http://localhost:30000/worlds/a%20b/x%22).png")');
  });

  test("a background linked from another site shows, as on Foundry's own Setup (owner)", () => {
    expect(cssImage("https://i.imgur.com/strahd.jpg", origin)).toBe(
      'url("https://i.imgur.com/strahd.jpg")',
    );
    expect(cssImage("//cdn.example.com/a b.webp", origin)).toBe(
      'url("http://cdn.example.com/a%20b.webp")',
    );
    const css = cssImage('https://x.example/a").png', origin) ?? "";
    expect(css).toBe('url("https://x.example/a%22).png")');
  });

  test("odd schemes are refused", () => {
    expect(cssImage("ftp://files.example/x.png", origin)).toBeUndefined();
    expect(cssImage("javascript:alert(1)", origin)).toBeUndefined();
    expect(cssImage("data:image/png;base64,AAAA", origin)).toBeUndefined();
    expect(cssImage(undefined, origin)).toBeUndefined();
    expect(cssImage("", origin)).toBeUndefined();
  });
});
