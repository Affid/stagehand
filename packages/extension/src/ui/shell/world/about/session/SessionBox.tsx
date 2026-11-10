// The About tab's Next session box: the view, or the editor after
// "Set a date" / "Change".
import type { WorldInfo } from "@stagehand/shared/world";
import { useState } from "preact/hooks";
import { useUi } from "../../../../context.ts";
import { SessionEditor } from "./SessionEditor.tsx";
import { SessionView } from "./SessionView.tsx";
import { SavedMark, useBackToLink } from "../EditRow.tsx";

export function SessionBox(props: {
  readonly world: WorldInfo;
  readonly canEdit: boolean;
}) {
  const { t } = useUi();
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const focus = useBackToLink(editing);
  const { world } = props;
  const has = world.schedule !== undefined || world.nextSession !== undefined;
  return (
    <section class="stw-box stw-sess">
      <h4>
        <span>{t("about.nextBox")}</span>
        <SavedMark on={saved && !editing} />
        {props.canEdit && !editing ? (
          <button
            type="button"
            ref={focus.link}
            class="st-link"
            aria-label={has ? t("sched.changeLabel") : t("sched.setLabel")}
            onClick={() => {
              setSaved(false);
              setEditing(true);
            }}
          >
            {has ? t("sched.change") : t("sched.set")}
          </button>
        ) : null}
      </h4>
      {editing ? (
        <SessionEditor
          world={world}
          onDone={(ok) => {
            focus.closed();
            setEditing(false);
            setSaved(ok);
          }}
        />
      ) : (
        <SessionView world={world} canEdit={props.canEdit} />
      )}
    </section>
  );
}
