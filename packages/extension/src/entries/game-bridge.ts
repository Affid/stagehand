// The extension's isolated content script on the game page: the relay
// between the companion module and the background (bridge/game.ts).
import { startGameBridge } from "../bridge/game.ts";
import { send } from "../platform/runtime.ts";

startGameBridge({ send, win: window });
