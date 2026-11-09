// Which Gamemaster in the world runs the companion's session.
import type { FoundryGame } from "./foundry.ts";

/**
 * Only one Gamemaster applies: the full Gamemaster with the lowest id among
 * those in the world. Foundry's own world edit accepts only full
 * Gamemasters, so Assistant GMs never could.
 */
export function isFirstGamemaster(game: FoundryGame, role: number): boolean {
  const me = game.user;
  if (me?.role !== role) return false;
  const first = [...game.users]
    .filter((u) => u.active && u.role === role)
    .map((u) => u.id)
    .sort()[0];
  return first === undefined || first === me.id;
}
