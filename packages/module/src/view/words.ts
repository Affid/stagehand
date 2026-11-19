// Names for the view's dialogs: modules by title, and the presets of the
// unsaved changes with how they apply.
import type { FoundryGame } from "../foundry.ts";
import type { ModulesData } from "@stagehand/ui/model/data.ts";

export const titleOf = (data: ModulesData, id: string): string =>
  data.setup?.modules.find((m) => m.id === id)?.title ?? id;

const MODE_KEY = {
  add: "ModeAdd",
  replace: "ModeReplace",
  remove: "ModeRemove",
} as const;

/** "Combat (Add)", for every preset in the unsaved changes. */
export function presetLines(game: FoundryGame, data: ModulesData): string[] {
  return data.commands.flatMap((c) =>
    c.payload.presetIds.map((id) => {
      const name = data.library.presets.find((p) => p.id === id)?.name ?? id;
      const mode = game.i18n.localize(
        `STAGEHAND.Manage.${MODE_KEY[c.payload.mode]}`,
      );
      return `${name} (${mode})`;
    }),
  );
}
