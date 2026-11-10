// A world's game system by the title Foundry shows, not its id.
import type { SetupData } from "@stagehand/shared/world";

/** The installed system's title; its id when it isn't installed. */
export function systemTitle(
  setup: Pick<SetupData, "systems"> | undefined,
  id: string,
): string {
  const title = setup?.systems.find((s) => s.id === id)?.title ?? "";
  // An empty title (a broken manifest) reads as the id too.
  return title.length > 0 ? title : id;
}
