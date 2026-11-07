// Runs first on a Setup page, before it draws: Foundry's Setup stays out of
// sight until the new page takes over or gives up (page/veil.ts).
import { startVeil } from "../page/veil.ts";

startVeil(document);
