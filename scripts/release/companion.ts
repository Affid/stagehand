// Releases the companion module (CONTRIBUTING.md, Releases):
//   pnpm release:companion 0.2.0 [--dry-run]
// Checks the working tree, the version and the changelog, writes the new
// version into the module's manifest and package, runs pnpm verify, commits,
// tags stagehand-v<version> and pushes both; the release workflow on GitHub
// does the rest. --dry-run checks and says what it would do, changing nothing.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  bumpManifest,
  changelogHas,
  newerVersion,
  tagFor,
} from "./companion-release.ts";

const root = join(import.meta.dirname, "..", "..");
const MANIFEST = join(root, "packages/module/static/module.json");
const PACKAGE = join(root, "packages/module/package.json");

const git = (...args: string[]): string =>
  execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
const run = (cmd: string, ...args: string[]): void => {
  execFileSync(cmd, args, { cwd: root, stdio: "inherit" });
};
const readJson = (path: string): Record<string, unknown> =>
  JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
const writeJson = (path: string, value: unknown): void => {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
};

/** Why a release can't start now, or undefined. */
function refusal(version: string, current: string): string | undefined {
  if (git("rev-parse", "--abbrev-ref", "HEAD") !== "main")
    return "Release from main.";
  if (git("status", "--porcelain") !== "")
    return "Commit or stash your changes first.";
  try {
    git("remote", "get-url", "origin");
  } catch {
    return "No git remote 'origin' yet: create the GitHub repository first.";
  }
  const why = newerVersion(version, current);
  if (why) return why;
  const changelog = readFileSync(join(root, "CHANGELOG.md"), "utf8");
  if (!changelogHas(changelog, version))
    return `CHANGELOG.md has no "### Companion module ${version}" section.`;
  if (git("tag", "--list", tagFor(version)) !== "")
    return `${tagFor(version)} already exists.`;
  return undefined;
}

/** The tag is on GitHub and main has nothing left to push. */
function landed(tag: string): boolean {
  const remote = git("ls-remote", "--tags", "origin", `refs/tags/${tag}`);
  return remote !== "" && !git("status", "-sb").includes("ahead");
}

function release(version: string): void {
  const tag = tagFor(version);
  writeJson(MANIFEST, bumpManifest(readJson(MANIFEST), version));
  writeJson(PACKAGE, { ...readJson(PACKAGE), version });
  run("pnpm", "exec", "prettier", "--write", MANIFEST, PACKAGE);
  run("pnpm", "verify");
  git("add", MANIFEST, PACKAGE);
  git("commit", "-m", `chore(release): companion ${version}`);
  git("tag", tag);
  git("push", "origin", "main");
  git("push", "origin", tag);
  if (!landed(tag))
    throw new Error(`The push of ${tag} didn't land: check git status.`);
  console.log(
    `Pushed ${tag}: follow the release in the repository's Actions tab.`,
  );
}

function main(): void {
  const version = process.argv[2] ?? "";
  const dryRun = process.argv.includes("--dry-run");
  const current = String(readJson(MANIFEST).version);
  const why = refusal(version, current);
  if (why) {
    console.error(why);
    process.exitCode = 1;
    return;
  }
  if (dryRun) {
    console.log(
      `Would release ${current} -> ${version}: bump, pnpm verify, commit, tag ${tagFor(version)}, push.`,
    );
    return;
  }
  release(version);
}

main();
