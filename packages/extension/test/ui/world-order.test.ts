import { describe, expect, test } from "vitest";
import { worldOrder } from "../../src/ui/model/order.ts";

const w = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  title: id.toUpperCase(),
  system: "dnd5e",
  systemVersion: "5",
  coreVersion: "14.370",
  ...extra,
});

describe("worlds in Foundry's own order (SetupPackages#sortWorlds)", () => {
  test("favourites first, then most recently played, then never played, then by title", () => {
    const worlds = [
      w("old", { lastPlayed: "2026-01-01T10:00:00Z" }),
      w("never-b"),
      w("fav-old", { favorite: true, lastPlayed: "2025-05-01T10:00:00Z" }),
      w("new", { lastPlayed: "2026-11-05T10:00:00Z" }),
      w("never-a"),
      w("fav-new", { favorite: true, lastPlayed: "2026-11-01T10:00:00Z" }),
    ];
    expect(worldOrder(worlds).map((x) => x.id)).toEqual([
      "fav-new",
      "fav-old",
      "new",
      "old",
      "never-a",
      "never-b",
    ]);
  });

  test("an unreadable date counts as never played, and the input is not changed", () => {
    const worlds = [
      w("bad", { lastPlayed: "not a date" }),
      w("ok", { lastPlayed: "2026-02-02T00:00:00Z" }),
    ];
    const before = worlds.map((x) => x.id);
    expect(worldOrder(worlds).map((x) => x.id)).toEqual(["ok", "bad"]);
    expect(worlds.map((x) => x.id)).toEqual(before);
  });

  test("titles compare in the page's language", () => {
    const worlds = [w("b", { title: "Ödland" }), w("a", { title: "Zeit" })];
    expect(worldOrder(worlds, "de").map((x) => x.id)).toEqual(["b", "a"]);
  });
});
