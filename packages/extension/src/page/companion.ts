// Installs (or updates) our companion module with Foundry's own installer,
// as its Install Module window does for a manifest address. The address is
// fixed here: the UI can ask for the install, never choose what is installed.
import {
  COMPANION_ID,
  COMPANION_INSTALL_TASK,
  COMPANION_MANIFEST,
} from "@stagehand/shared/companion";
import { logError } from "@stagehand/shared/log";
import type { PageToUi } from "../page-protocol.ts";
import type { PageGlobals } from "./globals.ts";

interface InstallerGame {
  installPackage?: (options: {
    type: "module";
    id: string;
    manifest: string;
  }) => Promise<unknown>;
}

const tick = (step: "start" | "complete"): PageToUi => ({
  type: "PROGRESS",
  payload: {
    action: "installPackage",
    id: COMPANION_INSTALL_TASK,
    packageId: COMPANION_ID,
    type: "module",
    step,
  },
});

/**
 * Foundry reads its package list again after an install and draws it a
 * moment later; our page hears of the module then. The task ends after it,
 * so Install isn't offered again in between.
 */
const SETTLE_MS = 1000;

/** One install at a time, however often it is asked for. */
let installing = false;

/**
 * Resolves once Foundry has installed the module and reloaded its package
 * list, or has failed and said why in its own notice. Our page hears the
 * start and the end as a task of its own.
 */
export async function installCompanion(
  page: Pick<PageGlobals, "game">,
  post: (m: PageToUi) => void,
): Promise<string | undefined> {
  const game = page.game as InstallerGame | undefined;
  if (!game?.installPackage) return "Foundry's installer is missing";
  if (installing) return undefined;
  installing = true;
  post(tick("start"));
  try {
    await game.installPackage({
      type: "module",
      id: COMPANION_ID,
      manifest: COMPANION_MANIFEST,
    });
    await new Promise((resolve) => setTimeout(resolve, SETTLE_MS));
  } catch (error: unknown) {
    // Foundry has shown its own failure notice; a second would repeat it.
    logError("companion install", error);
  } finally {
    installing = false;
    post(tick("complete"));
  }
  return undefined;
}
