// config/setup-config.json is what the extension and the app read from the
// repository once a day (REMOTE_CONFIG_URL): it must pass the same checks a
// downloaded config does, and match the bundled config until a newer
// revision is published on purpose (pnpm config:write).
import { describe, expect, test } from "vitest";
import published from "../../../config/setup-config.json" with { type: "json" };
import {
  BUNDLED_CONFIG,
  REMOTE_CONFIG_URL,
  SetupConfigSchema,
} from "../src/adapters/config.ts";

describe("the published Setup config", () => {
  test("is a valid Setup config", () => {
    expect(SetupConfigSchema.safeParse(published).success).toBe(true);
  });

  test("is the bundled config (pnpm config:write after changing it)", () => {
    expect(published).toEqual(BUNDLED_CONFIG);
  });

  test("is where the extension and the app look for it", () => {
    expect(REMOTE_CONFIG_URL).toBe(
      "https://raw.githubusercontent.com/Affid/stagehand/main/config/setup-config.json",
    );
  });
});
