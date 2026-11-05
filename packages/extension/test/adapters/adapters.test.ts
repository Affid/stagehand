import { describe, expect, test, vi } from "vitest";
import { parseCoreVersion } from "@module-library/shared/version";
import { BUNDLED_CONFIG, type SetupConfig } from "../../src/adapters/config.ts";
import {
  CONFIG_MAX_AGE_MS,
  loadSetupConfig,
} from "../../src/adapters/remote.ts";
import { allowsChanges, selectAdapter } from "../../src/adapters/select.ts";
import { memoryKeyValue } from "../../src/background/kv.ts";

const adapter = BUNDLED_CONFIG.adapters[0]!;
const config: SetupConfig = {
  configVersion: 1,
  revision: 1,
  adapters: [
    { ...adapter, id: "v14a", minBuild: 300, maxBuild: 360 },
    { ...adapter, id: "v14b", minBuild: 361, maxBuild: 369 },
  ],
};

describe("selectAdapter (V-2, V-3)", () => {
  test("an exact range match is supported", () => {
    const choice = selectAdapter(config, parseCoreVersion("14.365"));
    expect(choice).toMatchObject({
      status: "supported",
      adapter: { id: "v14b" },
    });
    expect(allowsChanges(choice)).toBe(true);
  });

  test("a newer build uses the closest older adapter, flagged untested", () => {
    expect(selectAdapter(config, parseCoreVersion("14.380"))).toMatchObject({
      status: "untested-build",
      adapter: { id: "v14b" },
    });
  });

  test("an unknown generation is safe mode, with no changes allowed", () => {
    const choice = selectAdapter(config, parseCoreVersion("15.300"));
    expect(choice).toEqual({ status: "safe-mode" });
    expect(allowsChanges(choice)).toBe(false);
  });

  test("an older build than any adapter is safe mode", () => {
    expect(selectAdapter(config, parseCoreVersion("14.100")).status).toBe(
      "safe-mode",
    );
  });
});

describe("loadSetupConfig (R-4, V-5)", () => {
  const remote: SetupConfig = { ...config, revision: 5 };

  test("uses a newer remote config and caches it", async () => {
    const kv = memoryKeyValue();
    const fetchText = vi.fn().mockResolvedValue(JSON.stringify(remote));
    const deps = { kv, fetchText, now: () => 1000 };
    expect(await loadSetupConfig(deps)).toEqual(remote);
    expect(await loadSetupConfig(deps)).toEqual(remote);
    expect(fetchText).toHaveBeenCalledTimes(1);
  });

  test("refetches when the cache is older than a day", async () => {
    const kv = memoryKeyValue();
    const fetchText = vi.fn().mockResolvedValue(JSON.stringify(remote));
    await loadSetupConfig({ kv, fetchText, now: () => 0 });
    await loadSetupConfig({ kv, fetchText, now: () => CONFIG_MAX_AGE_MS + 1 });
    expect(fetchText).toHaveBeenCalledTimes(2);
  });

  test("falls back to the bundled config when offline or invalid", async () => {
    const kv = memoryKeyValue();
    const offline = vi.fn().mockRejectedValue(new Error("offline"));
    expect(
      await loadSetupConfig({ kv, fetchText: offline, now: () => 0 }),
    ).toEqual(BUNDLED_CONFIG);
    const code = vi
      .fn()
      .mockResolvedValue('{"configVersion":1,"adapters":"alert(1)"}');
    expect(
      await loadSetupConfig({ kv, fetchText: code, now: () => 0 }),
    ).toEqual(BUNDLED_CONFIG);
  });

  test("keeps the bundled config when the remote one is older", async () => {
    const kv = memoryKeyValue();
    const old = vi
      .fn()
      .mockResolvedValue(JSON.stringify({ ...config, revision: 0 }));
    expect(await loadSetupConfig({ kv, fetchText: old, now: () => 0 })).toEqual(
      BUNDLED_CONFIG,
    );
  });
});

describe("remote config selectors (review fix)", () => {
  test("list selectors must be plain ids, so a config cannot hide the page", async () => {
    const kv = memoryKeyValue();
    const bad = {
      ...config,
      revision: 9,
      adapters: [
        {
          ...adapter,
          selectors: { ...adapter.selectors, modulesList: "body" },
        },
      ],
    };
    const fetchText = vi.fn().mockResolvedValue(JSON.stringify(bad));
    expect(await loadSetupConfig({ kv, fetchText, now: () => 0 })).toEqual(
      BUNDLED_CONFIG,
    );
  });
});
