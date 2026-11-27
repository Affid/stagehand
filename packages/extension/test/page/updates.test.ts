import { describe, expect, test } from "vitest";
import { checkUpdates } from "../../src/page/updates.ts";

type Page = Parameters<typeof checkUpdates>[0];

/** Dotted versions compared part by part, as Foundry's isNewerVersion. */
function isNewer(a: string, b: string): boolean {
  const x = a.split(".").map(Number);
  const y = b.split(".").map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0);
  }
  return false;
}

/** Installed modules at 1.0.0, and Foundry's package list with these entries. */
function page(
  listed: Record<string, { version: string; availability: number }>,
): Page {
  const entries = new Map(Object.entries(listed));
  const modules = new Map(
    Object.keys(listed).map((id) => [id, { id, version: "1.0.0" }]),
  );
  return {
    game: {
      modules,
      systems: new Map(),
      getPackages: ({ type }: { type: string }) =>
        Promise.resolve(type === "module" ? entries : new Map()),
    },
    foundry: { utils: { isNewerVersion: isNewer } },
  } as unknown as Page;
}

describe("the update marks", () => {
  test("only updates Foundry's own updater installs: availability 1 to 4", async () => {
    const updates = await checkUpdates(
      page({
        verified: { version: "1.1.0", availability: 1 },
        unverifiedBuild: { version: "1.1.0", availability: 2 },
        unverifiedSystem: { version: "1.1.0", availability: 3 },
        unverifiedGeneration: { version: "1.1.0", availability: 4 },
        // Foundry's updater calls these current and installs nothing.
        missingSystem: { version: "1.1.0", availability: 5 },
        missingDependency: { version: "1.1.0", availability: 6 },
        needsCore: { version: "1.1.0", availability: 8 },
        dependencyUpdate: { version: "1.1.0", availability: 11 },
      }),
    );
    expect(Object.keys(updates?.module ?? {}).sort()).toEqual([
      "unverifiedBuild",
      "unverifiedGeneration",
      "unverifiedSystem",
      "verified",
    ]);
  });

  test("an entry that isn't newer is no update", async () => {
    const updates = await checkUpdates(
      page({ same: { version: "1.0.0", availability: 1 } }),
    );
    expect(updates?.module).toEqual({});
  });
});
