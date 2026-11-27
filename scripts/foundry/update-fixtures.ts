// Packages with real updates for the live suites (docs/UPDATES-PLAN.md,
// Tests): a local HTTP server serves newer manifests and zips, and the
// installed copies point their manifest at it, so Foundry's own check and
// install run end to end. Only ids starting with st-upd- are touched.
import {
  mkdirSync,
  readdirSync,
  rmSync,
  writeFileSync,
  existsSync,
} from "node:fs";
import { createServer, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { zip } from "./zip.ts";

export const UPD = "st-upd-";

export interface UpdateFixture {
  readonly id: string;
  readonly title: string;
  readonly kind: "module" | "system";
  readonly installed: string;
  /** The version the server offers; none for a manifest that refuses. */
  readonly remote?: string;
  readonly library?: boolean;
  /** The remote version needs these modules at least at these versions. */
  readonly requires?: readonly { readonly id: string; readonly min: string }[];
  /** The installed copy declares a system range (impact of its update). */
  readonly fitsSystem?: { readonly id: string; readonly max: string };
  /** The remote version needs this test system at least at this version. */
  readonly needsSystem?: { readonly id: string; readonly min: string };
  /** The remote version needs this Foundry generation. */
  readonly coreMin?: string;
  readonly manifestStatus?: number;
  readonly downloadStatus?: number;
  /** Spread the download over this long, so its progress can be seen. */
  readonly slowMs?: number;
}

const SYS = `${UPD}sys`;

export const UPDATE_FIXTURES: readonly UpdateFixture[] = [
  {
    id: `${UPD}plain`,
    title: "Updates fixture: plain",
    kind: "module",
    installed: "1.0.0",
    remote: "1.1.0",
    slowMs: 3000,
  },
  {
    id: `${UPD}lib`,
    title: "Updates fixture: library",
    kind: "module",
    installed: "1.0.0",
    remote: "1.1.0",
    library: true,
  },
  {
    id: `${UPD}needs`,
    title: "Updates fixture: needs library 1.1",
    kind: "module",
    installed: "1.0.0",
    remote: "1.1.0",
    requires: [{ id: `${UPD}lib`, min: "1.1.0" }],
  },
  {
    id: `${UPD}core`,
    title: "Updates fixture: needs Foundry 99",
    kind: "module",
    installed: "1.0.0",
    remote: "2.0.0",
    coreMin: "99",
  },
  {
    id: SYS,
    title: "Updates fixture system",
    kind: "system",
    installed: "1.0.0",
    remote: "1.1.0",
  },
  {
    id: `${UPD}sysdep`,
    title: "Updates fixture: fits the system 1.0",
    kind: "module",
    installed: "1.0.0",
    fitsSystem: { id: SYS, max: "1.0.0" },
  },
  {
    id: `${UPD}sysnew`,
    title: "Updates fixture: needs the system 1.1",
    kind: "module",
    installed: "1.0.0",
    remote: "1.1.0",
    needsSystem: { id: SYS, min: "1.1.0" },
  },
  {
    id: `${UPD}manifest403`,
    title: "Updates fixture: manifest refused",
    kind: "module",
    installed: "1.0.0",
    manifestStatus: 403,
  },
  {
    id: `${UPD}download403`,
    title: "Updates fixture: download refused",
    kind: "module",
    installed: "1.0.0",
    remote: "1.1.0",
    downloadStatus: 403,
  },
];

const fileOf = (f: UpdateFixture): string =>
  f.kind === "system" ? "system.json" : "module.json";
const folderOf = (f: UpdateFixture): string =>
  f.kind === "system" ? "systems" : "modules";

/** A manifest for this fixture at this version, pointing at the server. */
export function manifestOf(
  f: UpdateFixture,
  version: string,
  base: string,
  remote: boolean,
): Record<string, unknown> {
  const url = `${base}/p/${f.id}`;
  const relationships: Record<string, unknown[]> = {
    requires: [],
    systems: [],
  };
  if (remote) {
    relationships.requires = (f.requires ?? []).map((r) => ({
      id: r.id,
      type: "module",
      compatibility: { minimum: r.min },
    }));
    if (f.needsSystem)
      relationships.systems = [
        {
          id: f.needsSystem.id,
          type: "system",
          compatibility: { minimum: f.needsSystem.min },
        },
      ];
  } else {
    relationships.requires = (f.requires ?? []).map((r) => ({
      id: r.id,
      type: "module",
    }));
    if (f.fitsSystem)
      relationships.systems = [
        {
          id: f.fitsSystem.id,
          type: "system",
          compatibility: { maximum: f.fitsSystem.max },
        },
      ];
  }
  return {
    id: f.id,
    title: f.title,
    description: "A package with a real update, for Stagehand's live tests.",
    version,
    authors: [{ name: "Stagehand tests" }],
    compatibility: {
      minimum: remote && f.coreMin ? f.coreMin : "13",
      verified: "14",
    },
    manifest: `${url}/${fileOf(f)}`,
    download: `${url}/package.zip`,
    ...(f.library ? { library: true } : {}),
    ...(f.kind === "module" ? { relationships } : {}),
  };
}

function packageZip(f: UpdateFixture, base: string): Buffer {
  const manifest = manifestOf(f, f.remote ?? f.installed, base, true);
  return zip([
    { name: fileOf(f), data: Buffer.from(JSON.stringify(manifest, null, 2)) },
    // Some bulk, so the download takes long enough to show its progress.
    { name: "assets/padding.bin", data: Buffer.alloc(256 * 1024, 1) },
  ]);
}

async function sendSlowly(
  res: ServerResponse,
  body: Buffer,
  ms: number,
): Promise<void> {
  const parts = 12;
  const size = Math.ceil(body.length / parts);
  res.writeHead(200, {
    "content-type": "application/zip",
    "content-length": String(body.length),
  });
  for (let i = 0; i < parts; i++) {
    res.write(body.subarray(i * size, (i + 1) * size));
    await new Promise((r) => setTimeout(r, ms / parts));
  }
  res.end();
}

export interface UpdateServer {
  readonly base: string;
  /** The paths asked for, in order (manifests and downloads). */
  readonly hits: string[];
  close(): Promise<void>;
}

/** Serves every fixture's newer manifest and zip on a free local port. */
export async function startUpdateServer(
  fixtures = UPDATE_FIXTURES,
): Promise<UpdateServer> {
  const hits: string[] = [];
  let base = "";
  const server = createServer((req, res) => {
    const path = req.url ?? "";
    hits.push(path);
    const [, , id, file] = path.split("/");
    const f = fixtures.find((x) => x.id === id);
    if (!f) return void res.writeHead(404).end();
    if (file === fileOf(f)) {
      if (f.manifestStatus) return void res.writeHead(f.manifestStatus).end();
      res.writeHead(200, { "content-type": "application/json" });
      return void res.end(
        JSON.stringify(manifestOf(f, f.remote ?? f.installed, base, true)),
      );
    }
    if (file === "package.zip") {
      if (f.downloadStatus) return void res.writeHead(f.downloadStatus).end();
      const body = packageZip(f, base);
      if (f.slowMs) return void sendSlowly(res, body, f.slowMs);
      res.writeHead(200, {
        "content-type": "application/zip",
        "content-length": String(body.length),
      });
      return void res.end(body);
    }
    res.writeHead(404).end();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`;
  return {
    base,
    hits,
    close: () =>
      new Promise((resolve) => {
        server.close(() => {
          resolve();
        });
      }),
  };
}

/** Writes each fixture's installed copy into Foundry's data, pointing at `base`. */
export function installFixtures(
  dataDir: string,
  base: string,
  fixtures = UPDATE_FIXTURES,
): void {
  for (const f of fixtures) {
    const dir = join(dataDir, "Data", folderOf(f), f.id);
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    const manifest = manifestOf(f, f.installed, base, false);
    const extra = f.kind === "system" ? { documentTypes: {} } : {};
    writeFileSync(
      join(dir, fileOf(f)),
      JSON.stringify({ ...manifest, ...extra }, null, 2),
    );
  }
}

/** Takes every fixture away again. */
export function removeFixtures(dataDir: string): void {
  for (const folder of ["modules", "systems"]) {
    const dir = join(dataDir, "Data", folder);
    if (!existsSync(dir)) continue;
    for (const id of readdirSync(dir).filter((d) => d.startsWith(UPD)))
      rmSync(join(dir, id), { recursive: true, force: true });
  }
}
