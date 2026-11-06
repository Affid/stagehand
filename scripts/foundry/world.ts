// The Module Library test world and its users.
import type { WorldUser } from "./session.ts";

export const TEST_WORLD = {
  id: "module-library-test",
  title: "Module Library test",
  system: "dnd5e",
  /** The system's title, as our pages show it. */
  systemTitle: "Dungeons & Dragons Fifth Edition",
} as const;

const PLAYER = 1;
const ASSISTANT = 3;
const GAMEMASTER = 4;

export const TEST_USERS: readonly WorldUser[] = [
  { name: "Gamemaster", role: GAMEMASTER },
  { name: "Assistant", role: ASSISTANT },
  { name: "Player1", role: PLAYER },
];

export const COMPANION_ID = "module-library";
