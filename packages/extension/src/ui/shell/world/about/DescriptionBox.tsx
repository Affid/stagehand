// The About tab's Description: shown cleaned and folded when long; Edit
// opens Foundry's own prose-mirror editor here (the page world mounts it in
// our host) and Save stores its HTML through editWorld (SETUP-REDESIGN.md).
import type { WorldInfo } from "@module-library/shared/world";
import { useEffect, useMemo, useState } from "preact/hooks";
import { RichText } from "../../../common/rich-text.tsx";
import { useUi } from "../../../context.ts";

/** Longer descriptions fold until "Show more". */
const FOLD_CHARS = 600;

let hosts = 0;

function View(props: { readonly html: string | undefined }) {
  const { t } = useUi();
  const [open, setOpen] = useState(false);
  const html = props.html ?? "";
  if (!html.trim()) return <p class="ml-empty">{t("about.noDescription")}</p>;
  const long = html.length > FOLD_CHARS;
  return (
    <div class={`mlw-desc${long && !open ? " folded" : ""}`}>
      <RichText html={html} />
      {long ? (
        <button
          type="button"
          class="ml-link"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {open ? t("about.less") : t("about.more")}
        </button>
      ) : null}
    </div>
  );
}

/** Foundry's editor in our host; stays open until Foundry has saved. */
function Editor(props: {
  readonly world: WorldInfo;
  readonly onDone: () => void;
}) {
  const { page, actions, t } = useUi();
  const hostId = useMemo(
    () =>
      `ml-pm-${props.world.id.replace(/[^a-z0-9-]/gi, "")}-${String(++hosts)}`,
    [props.world.id],
  );
  useEffect(() => {
    page.editorOpen(hostId, props.world.description ?? "");
    return () => {
      page.editorClose(hostId);
    };
    // Opened once: a re-render must not reset what is being typed.
  }, [hostId]);
  const save = (): void => {
    void page.editorSave(props.world.id, hostId).then((error) => {
      if (error) actions.notify("error", t("about.saveFailed", { error }));
      else props.onDone();
    });
  };
  return (
    <div class="mlw-edit">
      <div id={hostId} class="mlw-pmhost" />
      <div class="bar">
        <button type="button" class="bright" onClick={save}>
          {t("about.save")}
        </button>
        <button type="button" onClick={props.onDone}>
          {t("about.cancel")}
        </button>
      </div>
    </div>
  );
}

export function DescriptionBox(props: {
  readonly world: WorldInfo;
  readonly canEdit: boolean;
}) {
  const { t } = useUi();
  const [editing, setEditing] = useState(false);
  return (
    <section class="mlw-box">
      <h4>
        <span>{t("about.description")}</span>
        {props.canEdit && !editing ? (
          <button
            type="button"
            class="ml-link"
            aria-label={t("about.editDescription")}
            onClick={() => setEditing(true)}
          >
            {t("about.edit")}
          </button>
        ) : null}
      </h4>
      {editing ? (
        <Editor world={props.world} onDone={() => setEditing(false)} />
      ) : (
        <View html={props.world.description} />
      )}
    </section>
  );
}
