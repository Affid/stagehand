// The About tab's Next session box: the view, or the editor after
// "Set a date" / "Change".
import type { WorldInfo } from "@module-library/shared/world";
import { useState } from "preact/hooks";
import { useUi } from "../../../../context.ts";
import { SessionEditor } from "./SessionEditor.tsx";
import { SessionView } from "./SessionView.tsx";

export function SessionBox(props: {
  readonly world: WorldInfo;
  readonly canEdit: boolean;
}) {
  const { t } = useUi();
  const [editing, setEditing] = useState(false);
  const { world } = props;
  const has = world.schedule !== undefined || world.nextSession !== undefined;
  return (
    <section class="mlw-box mlw-sess">
      <h4>
        <span>{t("about.nextBox")}</span>
        {props.canEdit && !editing ? (
          <button
            type="button"
            class="ml-link"
            aria-label={has ? t("sched.changeLabel") : t("sched.setLabel")}
            onClick={() => setEditing(true)}
          >
            {has ? t("sched.change") : t("sched.set")}
          </button>
        ) : null}
      </h4>
      {editing ? (
        <SessionEditor world={world} onDone={() => setEditing(false)} />
      ) : (
        <SessionView world={world} canEdit={props.canEdit} />
      )}
    </section>
  );
}
