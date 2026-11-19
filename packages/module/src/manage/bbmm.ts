// BBMM in the same world (docs/IN-WORLD-LIBRARY-PLAN.md, "Other module
// managers in the same world"). With BBMM's enhanced module management on,
// its own window opens from the sidebar button and ours only on Shift-click.
// Decided (owner, 2026-11-18): ask once, don't compete for the button. The
// first full Gamemaster with Stagehand's view on is asked which view Module
// Management opens in this world; neither answer is the default, and
// closing the dialog asks again next time.
import { escapeHtml } from "../dialog.ts";
import { type DialogV2, type FoundryGame, MODULE_ID } from "../foundry.ts";

export const BBMM_ID = "bbmm";
const BBMM_SETTING = "enableModuleManagement";
/** The world's answer: "stagehand", "bbmm", or "" until someone answers. */
export const ANSWER_SETTING = "bbmmAnswer";
const GAMEMASTER = 4;
const K = "STAGEHAND.Manage";

export interface BbmmDeps {
  readonly game: FoundryGame;
  readonly dialog: DialogV2;
  readonly info: (message: string) => void;
  readonly reloadAll: () => void;
  /** Stagehand's view is on for this user. */
  readonly settingOn: () => boolean;
  readonly hasLibrary: () => Promise<boolean>;
  readonly loadCss: () => void;
}

export type BbmmAnswer = "stagehand" | "bbmm" | "later" | "skip";

export function registerBbmmAnswer(game: FoundryGame): void {
  game.settings.register(MODULE_ID, ANSWER_SETTING, {
    scope: "world",
    config: false,
    type: String,
    default: "",
  });
}

/** BBMM opens its own window from the sidebar button. */
export function bbmmHoldsButton(game: FoundryGame): boolean {
  if (game.modules.get(BBMM_ID)?.active !== true) return false;
  try {
    return game.settings.get(BBMM_ID, BBMM_SETTING) !== false;
  } catch {
    // BBMM without this setting (another version): it doesn't hold it.
    return false;
  }
}

function answered(game: FoundryGame): boolean {
  try {
    return Boolean(game.settings.get(MODULE_ID, ANSWER_SETTING));
  } catch {
    return false;
  }
}

function promptHtml(game: FoundryGame): string {
  const say = (key: string): string =>
    escapeHtml(game.i18n.localize(`${K}.${key}`));
  // The dialog opens on the question: the browser would otherwise focus
  // the first answer, as if it were the default.
  return `<p class="stagehand-lead" tabindex="-1" autofocus>${say("BbmmIntro")}</p>
    <dl class="stagehand-choices">
      <dt>${say("BbmmUse")}</dt><dd>${say("BbmmUseHint")}</dd>
      <dt>${say("BbmmKeep")}</dt><dd>${say("BbmmKeepHint")}</dd>
    </dl>
    <p class="hint">${say("BbmmLater")}</p>`;
}

async function shouldAsk(deps: BbmmDeps): Promise<boolean> {
  const { game } = deps;
  if (game.user?.role !== GAMEMASTER || !deps.settingOn()) return false;
  if (!bbmmHoldsButton(game) || answered(game)) return false;
  return deps.hasLibrary();
}

export async function askAboutBbmm(deps: BbmmDeps): Promise<BbmmAnswer> {
  if (!(await shouldAsk(deps))) return "skip";
  const { game } = deps;
  const say = (key: string): string => game.i18n.localize(`${K}.${key}`);
  deps.loadCss();
  const answer = await deps.dialog.wait({
    window: { title: say("BbmmTitle") },
    content: promptHtml(game),
    // Neither is the default: Stagehand doesn't lean on a GM who chose BBMM.
    buttons: [
      {
        action: "useStagehand",
        label: say("BbmmUse"),
        icon: "fa-solid fa-cubes",
      },
      {
        action: "keepBbmm",
        label: say("BbmmKeep"),
        icon: "fa-solid fa-layer-group",
      },
    ],
    rejectClose: false,
    modal: true,
    classes: ["stagehand-dialog"],
  });
  if (answer === "useStagehand") {
    await game.settings.set(MODULE_ID, ANSWER_SETTING, "stagehand");
    await game.settings.set(BBMM_ID, BBMM_SETTING, false);
    deps.info(say("BbmmUsed"));
    deps.reloadAll();
    return "stagehand";
  }
  if (answer === "keepBbmm") {
    await game.settings.set(MODULE_ID, ANSWER_SETTING, "bbmm");
    deps.info(say("BbmmKept"));
    return "bbmm";
  }
  return "later";
}
