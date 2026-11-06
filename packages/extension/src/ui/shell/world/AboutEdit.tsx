// In-place editors for a world's title and next session (SETUP-REDESIGN.md:
// About edited in place). They save through Foundry's own editWorld, only
// when the remote config's `editWorld` flag allows it; otherwise the About
// tab offers Foundry's World Configuration instead.
import type { WorldInfo } from "@module-library/shared/world";
import { useState } from "preact/hooks";
import type { WorldChanges } from "../../../page-save.ts";
import { IconButton, InlineInput } from "../../common/widgets.tsx";
import { useUi } from "../../context.ts";

/** Edits need a verified admin, a supported Foundry and the flag. */
export function useCanEditWorld(): boolean {
  const { state, canChange } = useUi();
  const a = state.adapter;
  return (
    canChange && a.status !== "safe-mode" && a.adapter.flags.editWorld === true
  );
}

/** Saves through Foundry; a refusal becomes a notification. True if saved. */
export function useSave(
  worldId: string,
): (changes: WorldChanges) => Promise<boolean> {
  const { page, actions, t } = useUi();
  return async (changes) => {
    const error = await page.saveWorld(worldId, changes);
    if (error) actions.notify("error", t("about.saveFailed", { error }));
    return error === undefined;
  };
}

/** Stays open until Foundry has saved; a failure keeps what was typed. */
export function TitleField(props: { readonly world: WorldInfo }) {
  const { t } = useUi();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(props.world.title);
  const [attempt, setAttempt] = useState(0);
  const save = useSave(props.world.id);
  const commit = (title: string): void => {
    if (title === props.world.title) {
      setEditing(false);
      return;
    }
    setDraft(title);
    void save({ title }).then((ok) => {
      if (ok) setEditing(false);
      // A fresh input with the typed text, ready to try again.
      else setAttempt((n) => n + 1);
    });
  };
  if (editing)
    return (
      <InlineInput
        key={attempt}
        initial={draft}
        label={t("about.title")}
        onCancel={() => setEditing(false)}
        onCommit={commit}
      />
    );
  return (
    <span class="mlw-editable">
      {props.world.title}
      <IconButton
        icon="pen"
        label={t("about.changeTitle")}
        onClick={() => {
          setDraft(props.world.title);
          setEditing(true);
        }}
      />
    </span>
  );
}
