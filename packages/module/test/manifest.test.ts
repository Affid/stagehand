// The companion's manifest as Foundry's installer and package listing read
// it: a stable "latest" manifest URL, a download for exactly this version,
// and the same version as the package (docs: foundryvtt.com module
// development and package release API).
import { describe, expect, test } from "vitest";
import pkg from "../package.json" with { type: "json" };
import manifestJson from "../static/module.json" with { type: "json" };

const manifest = manifestJson as Record<string, unknown>;
const REPO = "https://github.com/Affid/stagehand";

describe("the companion's manifest", () => {
  test("has the version of its package, in plain semver", () => {
    expect(manifest.version).toBe(pkg.version);
    expect(manifest.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  test("updates from the manifests branch and installs this version's zip", () => {
    // A fixed file on the manifests branch, not GitHub's "latest" release,
    // which other parts' releases would take over (scripts/release).
    expect(manifest.manifest).toBe(
      "https://raw.githubusercontent.com/Affid/stagehand/manifests/stagehand/module.json",
    );
    expect(manifest.download).toBe(
      `${REPO}/releases/download/stagehand-v${String(manifest.version)}/stagehand.zip`,
    );
  });

  test("names its author and links its project, issues, readme, changelog and licence", () => {
    expect(manifest.id).toBe("stagehand");
    expect(manifest.authors).toEqual([
      { name: "Andrei Fedorov", url: "https://github.com/Affid" },
    ]);
    for (const key of ["url", "bugs", "readme", "changelog", "license"])
      expect(String(manifest[key])).toMatch(new RegExp(`^${REPO}`));
  });

  test("declares the Foundry versions it was checked on", () => {
    expect(manifest.compatibility).toEqual({
      minimum: "13",
      verified: "14.370",
    });
  });
});
