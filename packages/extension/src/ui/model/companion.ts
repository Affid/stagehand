// The companion module on this server, as the Library's band and a world's
// setup steps show it (issue 1): missing, out of date, or being installed.
import {
  COMPANION_ID,
  COMPANION_INSTALL_TASK,
  companionState,
  type CompanionState,
} from "@stagehand/shared/companion";
import type { UiState } from "../store.ts";

export interface CompanionNeed {
  readonly need: Exclude<CompanionState, "ok">;
  /** The installed version, when it is the out-of-date one. */
  readonly have: string;
  /** Foundry is installing it now. */
  readonly installing: boolean;
}

/** What the server lacks, or null: the companion is fine, or Setup is unread. */
export function companionNeed(
  state: Pick<UiState, "data" | "tasks">,
): CompanionNeed | null {
  const modules = state.data.setup?.modules;
  if (!modules) return null;
  const need = companionState(modules);
  if (need === "ok") return null;
  return {
    need,
    have: modules.find((m) => m.id === COMPANION_ID)?.version ?? "",
    installing: state.tasks.some((x) => x.id === COMPANION_INSTALL_TASK),
  };
}
