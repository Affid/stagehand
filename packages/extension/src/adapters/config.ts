// Setup adapter configuration: data only (selectors, flags), never code
// (R-4). Bundled here; a newer copy may come from the project repository.
import { z } from "zod";

const Selector = z.string().min(1).max(200);
/** The lists hidden or mounted next to must be named by id: never `body`. */
const IdSelector = z.string().regex(/^#[A-Za-z][\w-]{0,80}$/);

export const AdapterSchema = z.object({
  id: z.string().min(1),
  generation: z.number().int().positive(),
  minBuild: z.number().int().nonnegative(),
  maxBuild: z.number().int().nonnegative(),
  selectors: z.object({
    worldsTab: Selector,
    modulesTab: Selector,
    modulesList: IdSelector,
    worldsList: IdSelector,
    worldCard: Selector,
    /** Inside a world card: where our status tag goes. */
    worldTags: Selector,
  }),
  flags: z.record(z.string(), z.boolean()),
});

export const SetupConfigSchema = z.object({
  configVersion: z.literal(1),
  revision: z.number().int().nonnegative(),
  adapters: z.array(AdapterSchema),
});

export type Adapter = z.infer<typeof AdapterSchema>;
export type SetupConfig = z.infer<typeof SetupConfigSchema>;

/** Setup markup of V14 builds 369 and 370; also the best guess in safe mode. */
export const V14_SELECTORS: Adapter["selectors"] = {
  worldsTab: "#setup-packages-worlds",
  modulesTab: "#setup-packages-modules",
  modulesList: "#modules-list",
  worldsList: "#worlds-list",
  worldCard: "#worlds-list > li.package.world[data-package-id]",
  worldTags: ".tags.right",
};

/** Verified against V14 build 369 in the M0 spike (docs/M0-FINDINGS.md) and again on build 370. */
export const BUNDLED_CONFIG: SetupConfig = {
  configVersion: 1,
  revision: 2,
  adapters: [
    {
      id: "v14",
      generation: 14,
      minBuild: 0,
      maxBuild: 370,
      selectors: V14_SELECTORS,
      // Foundry's internal editWorld and lockPackage requests, tested live
      // on 14.370 (docs/SETUP-SPIKE.md); diskFree reads free space through
      // its checkRestoreSnapshotDiskSpace request.
      flags: { editWorld: true, lockPackage: true, diskFree: true },
    },
  ],
};

export const REMOTE_CONFIG_URL =
  "https://raw.githubusercontent.com/Affid/module-library/main/config/setup-config.json";
