// A world's game system by the title Foundry shows, not its id.
import type { SetupData } from "@module-library/shared/world";

/** The installed system's title; its id when it isn't installed. */
export function systemTitle(
  setup: Pick<SetupData, "systems"> | undefined,
  id: string,
): string {
  return setup?.systems.find((s) => s.id === id)?.title || id;
}
