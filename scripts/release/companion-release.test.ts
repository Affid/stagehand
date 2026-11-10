import { describe, expect, test } from "vitest";
import {
  bumpManifest,
  changelogHas,
  listingOutcome,
  listingRequest,
  MANIFEST_URL,
  newerVersion,
  releaseRefusal,
  tagFor,
} from "./companion-release.ts";

const manifest = {
  id: "stagehand",
  version: "0.1.0",
  manifest: MANIFEST_URL,
  download:
    "https://github.com/Affid/stagehand/releases/download/stagehand-v0.1.0/stagehand.zip",
  compatibility: { minimum: "13", verified: "14.370" },
};

describe("companion releases", () => {
  test("are tagged stagehand-v<version>", () => {
    expect(tagFor("0.2.0")).toBe("stagehand-v0.2.0");
  });

  test("update from a fixed manifest on the manifests branch", () => {
    expect(MANIFEST_URL).toBe(
      "https://raw.githubusercontent.com/Affid/stagehand/manifests/stagehand/module.json",
    );
  });

  test("a bump changes the version and the download, nothing else", () => {
    const next = bumpManifest(manifest, "0.2.0");
    expect(next).toEqual({
      ...manifest,
      version: "0.2.0",
      download:
        "https://github.com/Affid/stagehand/releases/download/stagehand-v0.2.0/stagehand.zip",
    });
    expect(manifest.version).toBe("0.1.0");
  });

  test("a version must be plain semver and newer", () => {
    expect(newerVersion("0.2.0", "0.1.0")).toBeUndefined();
    expect(newerVersion("1.0.0", "0.9.9")).toBeUndefined();
    expect(newerVersion("0.10.0", "0.9.0")).toBeUndefined();
    expect(newerVersion("0.1.0", "0.1.0")).toMatch(/newer/);
    expect(newerVersion("0.0.9", "0.1.0")).toMatch(/newer/);
    expect(newerVersion("0.2.0-beta.1", "0.1.0")).toMatch(/semver/);
    expect(newerVersion("v0.2.0", "0.1.0")).toMatch(/semver/);
  });

  test("the first release may be the current version; later ones must be newer", () => {
    expect(releaseRefusal("0.1.0", "0.1.0", false)).toBeUndefined();
    expect(releaseRefusal("0.1.0", "0.1.0", true)).toMatch(/already exists/);
    expect(releaseRefusal("0.2.0", "0.1.0", false)).toBeUndefined();
    expect(releaseRefusal("0.2.0", "0.1.0", true)).toMatch(/already exists/);
    expect(releaseRefusal("0.0.9", "0.1.0", false)).toMatch(/newer/);
    expect(releaseRefusal("", "0.1.0", false)).toMatch(/semver/);
  });

  test("the changelog must have the version's section", () => {
    const text =
      "# Changelog\n\n## Unreleased\n\n### Companion module 0.2.0\n\n- x\n";
    expect(changelogHas(text, "0.2.0")).toBe(true);
    expect(changelogHas(text, "0.2")).toBe(false);
    expect(changelogHas(text, "0.3.0")).toBe(false);
  });
});

describe("Foundry's package release API", () => {
  test("gets this version's own manifest, its changelog and compatibility", () => {
    expect(listingRequest({ ...manifest, version: "0.2.0" }, false)).toEqual({
      id: "stagehand",
      "dry-run": false,
      release: {
        version: "0.2.0",
        manifest:
          "https://github.com/Affid/stagehand/releases/download/stagehand-v0.2.0/module.json",
        notes:
          "https://github.com/Affid/stagehand/blob/stagehand-v0.2.0/CHANGELOG.md",
        compatibility: { minimum: "13", verified: "14.370", maximum: "" },
      },
    });
  });

  test("its answers: saved, checked, already there, too fast, refused", () => {
    expect(listingOutcome(200, { page: "https://x" }, false)).toEqual({
      kind: "saved",
      page: "https://x",
    });
    expect(listingOutcome(200, { page: "https://x" }, true)).toEqual({
      kind: "checked",
      page: "https://x",
    });
    expect(
      listingOutcome(
        400,
        { errors: { __all__: [{ code: "unique_together" }] } },
        false,
      ),
    ).toEqual({ kind: "exists" });
    expect(() => listingOutcome(429, {}, false, "30")).toThrow(/30 seconds/);
    expect(() =>
      listingOutcome(
        400,
        { errors: { manifest: [{ message: "Bad URL" }] } },
        false,
      ),
    ).toThrow(/manifest: Bad URL/);
    expect(() => listingOutcome(500, "<html>", false)).toThrow(/500/);
  });
});
