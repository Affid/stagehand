// Sends the built companion's version to foundryvtt.com (Foundry's package
// release API), so people who installed it from Foundry's package list get
// the update: since Foundry 14.366 their updates come from there, not from
// the manifest URL. Run by the release workflow after the GitHub release.
// The token is the Package Release Token from the package's page on
// foundryvtt.com, as FOUNDRY_RELEASE_TOKEN; without it nothing is sent.
// Usage: node scripts/release/listing.ts [--dry-run]
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { listingOutcome, listingRequest } from "./companion-release.ts";

const API = "https://foundryvtt.com/_api/packages/release_version/";
const root = join(import.meta.dirname, "..", "..");

async function main(): Promise<void> {
  const token = process.env.FOUNDRY_RELEASE_TOKEN ?? "";
  if (!token) {
    console.log("No FOUNDRY_RELEASE_TOKEN: not sent to foundryvtt.com.");
    return;
  }
  const dryRun = process.argv.includes("--dry-run");
  const manifest = JSON.parse(
    readFileSync(join(root, "packages/module/dist/module.json"), "utf8"),
  ) as Record<string, unknown>;
  const request = listingRequest(manifest, dryRun);
  const response = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: token },
    body: JSON.stringify(request),
  });
  const body: unknown = await response.json().catch(() => ({}));
  const outcome = listingOutcome(
    response.status,
    body,
    dryRun,
    response.headers.get("Retry-After") ?? undefined,
  );
  const v = request.release.version;
  if (outcome.kind === "exists")
    console.log(`foundryvtt.com already has ${v}: nothing to do.`);
  else console.log(`foundryvtt.com ${outcome.kind} ${v}: ${outcome.page}`);
}

await main();
