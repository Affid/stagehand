// What the modules view reads: the library, the server's modules and worlds,
// each world's last snapshot and the changes queued for it. Setup's state
// has all of it; a running world builds it for itself alone.
import type { Library } from "@stagehand/shared/library/schema";
import type { Command, SetupData, Snapshot } from "@stagehand/shared/world";

export type ModulesSetup = Pick<
  SetupData,
  "core" | "lang" | "modules" | "worlds"
>;

export interface ModulesData {
  readonly library: Library;
  readonly setup: ModulesSetup | undefined;
  readonly snapshots: Readonly<Record<string, Snapshot>>;
  readonly commands: readonly Command[];
}
