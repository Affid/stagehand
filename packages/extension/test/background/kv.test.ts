import { describe, expect, test } from "vitest";
import { memoryKeyValue, serialized } from "../../src/background/kv.ts";

describe("serialized updates", () => {
  test("concurrent updates of one key never lose a write", async () => {
    const kv = serialized(memoryKeyValue());
    await Promise.all(
      Array.from({ length: 20 }, () =>
        kv.update<number>("n", 0, async (n) => {
          await Promise.resolve();
          return n + 1;
        }),
      ),
    );
    expect(await kv.get<number>("n")).toBe(20);
  });

  test("a failing update rejects without blocking the next one", async () => {
    const kv = serialized(memoryKeyValue());
    await expect(
      kv.update("k", 0, () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    await kv.update<number>("k", 0, (n) => n + 1);
    expect(await kv.get<number>("k")).toBe(1);
  });

  test("returns the stored value and the update's extra result", async () => {
    const kv = serialized(memoryKeyValue());
    const result = await kv.update<number, string>("k", 1, (n) => ({
      value: n * 2,
      result: "doubled",
    }));
    expect(result).toBe("doubled");
    expect(await kv.get("k")).toBe(2);
  });

  test("stored values are copies: mutating a read never changes storage", async () => {
    const kv = memoryKeyValue();
    await kv.set("o", { a: 1 });
    const read = await kv.get<{ a: number }>("o");
    if (read) read.a = 2;
    expect(await kv.get("o")).toEqual({ a: 1 });
  });
});
