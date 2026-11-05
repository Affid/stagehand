// Launching stays Foundry's: we find the world card's own launch control and
// click it, so migration prompts, backups and locks work as usual.
import type { Adapter } from "../../adapters/config.ts";

export function launchControl(
  doc: Document,
  selectors: Adapter["selectors"],
  worldId: string,
): HTMLElement | null {
  const cards = doc.querySelectorAll<HTMLElement>(selectors.worldCard);
  const card = [...cards].find((c) => c.dataset.packageId === worldId);
  return (
    card?.querySelector<HTMLElement>('[data-action="worldLaunch"]') ?? null
  );
}
