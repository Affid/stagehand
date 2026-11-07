// "Create a snapshot" as the prototype (_server.js snapshotDialog): what it
// backs up, the space it needs and the space free (Foundry's own check),
// an optional note, and that it can't be interrupted. Then Foundry runs it
// without its own dialog.
import { useEffect, useState } from "preact/hooks";
import {
  MAX_SNAPSHOT_NOTE,
  type SnapshotSpace,
} from "../../../../page-server-backups.ts";
import { formatSize } from "../../../common/size.ts";
import { Icon, Modal } from "../../../common/widgets.tsx";
import { useUi } from "../../../context.ts";
import { plural } from "../../../i18n.ts";

/** "1 world, 5 modules and 1 system". */
function useCounts(): string {
  const { state, t } = useUi();
  const s = state.data.setup;
  return t("snap.counts", {
    worlds: plural(t, "snap.worlds", s?.worlds.length ?? 0),
    modules: plural(t, "snap.modules", s?.modules.length ?? 0),
    systems: plural(t, "snap.systems", s?.systems.length ?? 0),
  });
}

/** Foundry sizes every package first: "Checking…" until it answers. */
function SpaceLine(props: {
  readonly ask: () => Promise<SnapshotSpace | undefined>;
}) {
  const { t } = useUi();
  const [space, setSpace] = useState<SnapshotSpace | null | undefined>(null);
  useEffect(() => {
    void props.ask().then(setSpace);
  }, []);
  if (space === undefined) return null;
  return (
    <span>
      <Icon name="hard-drive" />
      {space === null
        ? t("snap.checking")
        : t("snap.space", {
            needed: formatSize(space.required),
            free: formatSize(space.available),
          })}
    </span>
  );
}

function Footer(props: {
  readonly onClose: () => void;
  readonly onCreate: () => void;
}) {
  const { t } = useUi();
  return (
    <>
      <button type="button" onClick={props.onClose}>
        {t("about.cancel")}
      </button>
      <button type="button" class="bright" onClick={props.onCreate}>
        <Icon name="camera-retro" />
        {t("snap.go")}
      </button>
    </>
  );
}

export function SnapshotDialog(props: {
  readonly onClose: () => void;
  readonly onCreate: (note: string) => void;
  readonly askSpace: () => Promise<SnapshotSpace | undefined>;
}) {
  const { t } = useUi();
  const [note, setNote] = useState("");
  const counts = useCounts();
  const footer = (
    <Footer
      onClose={props.onClose}
      onCreate={() => props.onCreate(note.trim())}
    />
  );
  return (
    <Modal title={t("sb.create")} onClose={props.onClose} footer={footer}>
      <div class="mls-launch-body mlb-snapdialog">
        <p>{t("snap.lead")}</p>
        <div class="mlb-facts">
          <span>
            <Icon name="box-archive" />
            {counts}
          </span>
          <SpaceLine ask={props.askSpace} />
          <span class="ml-muted">{t("snap.neededHint")}</span>
        </div>
        <label class="mlb-note">
          <span>{t("snap.note")}</span>
          <input
            type="text"
            value={note}
            maxLength={MAX_SNAPSHOT_NOTE}
            placeholder={t("snap.notePlaceholder")}
            onInput={(e) => setNote(e.currentTarget.value)}
          />
        </label>
        <div class="mls-check warn">
          <Icon name="triangle-exclamation" />
          <span>{t("snap.warn")}</span>
        </div>
      </div>
    </Modal>
  );
}
