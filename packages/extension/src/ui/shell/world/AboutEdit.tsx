// In-place editors for a world's title and next session (SETUP-REDESIGN.md:
// About edited in place). They save through Foundry's own editWorld, only
// when the remote config's `editWorld` flag allows it; otherwise the About
// tab offers Foundry's World Configuration instead.
import type { WorldInfo } from "@module-library/shared/world";
import { useState } from "preact/hooks";
import type { WorldChanges } from "../../../page-save.ts";
import { IconButton, InlineInput } from "../../common/widgets.tsx";
import { useUi } from "../../context.ts";
import { formatSession } from "./AboutTab.tsx";

/** Edits need a verified admin, a supported Foundry and the flag. */
export function useCanEditWorld(): boolean {
  const { state, canChange } = useUi();
  const a = state.adapter;
  return (
    canChange && a.status !== "safe-mode" && a.adapter.flags.editWorld === true
  );
}

/** Saves through Foundry; a refusal becomes a notification. */
function useSave(worldId: string): (changes: WorldChanges) => Promise<void> {
  const { page, actions, t } = useUi();
  return async (changes) => {
    const error = await page.saveWorld(worldId, changes);
    if (error) actions.notify("error", t("about.saveFailed", { error }));
  };
}

export function TitleField(props: { readonly world: WorldInfo }) {
  const { t } = useUi();
  const [editing, setEditing] = useState(false);
  const save = useSave(props.world.id);
  if (editing)
    return (
      <InlineInput
        initial={props.world.title}
        label={t("about.title")}
        onCancel={() => setEditing(false)}
        onCommit={(title) => {
          setEditing(false);
          if (title !== props.world.title) void save({ title });
        }}
      />
    );
  return (
    <span class="mlw-editable">
      {props.world.title}
      <IconButton
        icon="pen"
        label={t("about.changeTitle")}
        onClick={() => setEditing(true)}
      />
    </span>
  );
}

/** "2026-11-12T19:00" in local time, as a datetime-local input wants it. */
function localValue(iso: string | undefined): string {
  const d = new Date(iso ?? "");
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

function SessionEditor(props: {
  readonly world: WorldInfo;
  readonly onDone: () => void;
}) {
  const { t } = useUi();
  const save = useSave(props.world.id);
  const [value, setValue] = useState(localValue(props.world.nextSession));
  const finish = (nextSession: string | null): void => {
    props.onDone();
    void save({ nextSession });
  };
  return (
    <span class="mlw-sessionedit">
      <label>
        <span class="ml-hint">{t("about.nextIn", { zone: ZONE })}</span>
        <input
          type="datetime-local"
          value={value}
          onInput={(e) => setValue(e.currentTarget.value)}
        />
      </label>
      <button
        type="button"
        disabled={!value}
        onClick={() => finish(new Date(value).toISOString())}
      >
        {t("about.save")}
      </button>
      <button type="button" onClick={() => finish(null)}>
        {t("about.clear")}
      </button>
      <button type="button" class="ml-link" onClick={props.onDone}>
        {t("about.cancel")}
      </button>
    </span>
  );
}

export function SessionField(props: { readonly world: WorldInfo }) {
  const { state, t } = useUi();
  const [editing, setEditing] = useState(false);
  if (editing)
    return (
      <SessionEditor world={props.world} onDone={() => setEditing(false)} />
    );
  const shown = formatSession(props.world.nextSession, state.data.setup?.lang);
  return (
    <span class="mlw-editable">
      {shown ?? t("about.notSet")}
      <IconButton
        icon="pen"
        label={t("about.changeNext")}
        onClick={() => setEditing(true)}
      />
    </span>
  );
}
