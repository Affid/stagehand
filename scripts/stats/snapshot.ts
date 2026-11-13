// Saves today's release download totals (downloads.csv) and GitHub's daily
// views and clones (traffic.csv) into a folder, merged with what is there.
// Run daily by .github/workflows/stats.yml onto the `stats` branch; by hand
// it writes wherever it is told.
// Downloads are public: GITHUB_TOKEN only raises the rate limit. Traffic
// needs STATS_TOKEN, a token with read access to the repository's
// Administration; without it traffic.csv is left as it is.
// Usage: node scripts/stats/snapshot.ts <folder>
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { REPOSITORY } from "../release/companion-release.ts";
import { downloadRows, mergeDownloads, mergeTraffic } from "./stats.ts";

const API = `https://api.github.com/repos/${REPOSITORY}`;
const PAGE_SIZE = 100;

async function get(path: string, token: string): Promise<unknown> {
  const response = await fetch(`${API}${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!response.ok) {
    throw new Error(`GitHub answered ${response.status} for ${path}`);
  }
  return response.json() as Promise<unknown>;
}

async function allReleases(token: string): Promise<unknown[]> {
  const pages: unknown[] = [];
  for (let page = 1; ; page++) {
    const batch = await get(
      `/releases?per_page=${PAGE_SIZE}&page=${page}`,
      token,
    );
    if (!Array.isArray(batch)) return [...pages, batch];
    pages.push(...(batch as unknown[]));
    if (batch.length < PAGE_SIZE) return pages;
  }
}

const read = (file: string): string =>
  existsSync(file) ? readFileSync(file, "utf8") : "";

async function main(): Promise<void> {
  const folder = process.argv[2];
  if (!folder)
    throw new Error("Usage: node scripts/stats/snapshot.ts <folder>");
  mkdirSync(folder, { recursive: true });
  const today = new Date().toISOString().slice(0, 10);

  const downloads = join(folder, "downloads.csv");
  const rows = downloadRows(await allReleases(process.env.GITHUB_TOKEN ?? ""));
  writeFileSync(downloads, mergeDownloads(read(downloads), rows, today));
  console.log(`${today}: ${rows.length} release files counted.`);

  const statsToken = process.env.STATS_TOKEN ?? "";
  if (!statsToken) {
    console.log("No STATS_TOKEN: traffic not saved.");
    return;
  }
  const traffic = join(folder, "traffic.csv");
  const [views, clones] = await Promise.all([
    get("/traffic/views", statsToken),
    get("/traffic/clones", statsToken),
  ]);
  writeFileSync(traffic, mergeTraffic(read(traffic), views, clones));
  console.log(`${today}: views and clones saved.`);
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
