// Setup adapter configuration: data only (selectors, flags), never code
// (R-4). Bundled here; a newer copy may come from the project repository.
import { z } from "zod";
import { V13_ADAPTER } from "../compat/v13/adapter.ts";
import { V14_SELECTORS } from "./selectors.ts";

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

export { V14_SELECTORS } from "./selectors.ts";

/** Verified against V14 build 369 in the M0 spike (docs/M0-FINDINGS.md) and again on build 370. */
export const BUNDLED_CONFIG: SetupConfig = {
  configVersion: 1,
  revision: 3,
  adapters: [
    {
      id: "v14",
      generation: 14,
      minBuild: 0,
      maxBuild: 370,
      selectors: V14_SELECTORS,
      // Foundry's internal editWorld and lockPackage requests, tested live
      // on 14.370 (docs/SETUP-SPIKE.md); diskFree reads free space through
      // its checkRestoreSnapshotDiskSpace request; updateCheck asks
      // Foundry's package list (game.getPackages) once per Setup load;
      // certificates asks for or releases one (adminGenerateCertificates).
      flags: {
        editWorld: true,
        lockPackage: true,
        diskFree: true,
        updateCheck: true,
        certificates: true,
      },
    },
    V13_ADAPTER,
  ],
};

export const REMOTE_CONFIG_URL =
  "https://raw.githubusercontent.com/Affid/stagehand/main/config/setup-config.json";
