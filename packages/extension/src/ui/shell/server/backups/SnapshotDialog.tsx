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

type Space =
  | { readonly kind: "checking" }
  | { readonly kind: "unknown" }
  | { readonly kind: "known"; readonly space: SnapshotSpace };

/** Foundry sizes every package first: "Checking…" until it answers. */
function useSpace(ask: () => Promise<SnapshotSpace | undefined>): Space {
  const [space, setSpace] = useState<Space>({ kind: "checking" });
  useEffect(() => {
    void ask().then((s) => {
      setSpace(s ? { kind: "known", space: s } : { kind: "unknown" });
    });
  }, []);
  return space;
}

/** The space it needs and has; a warning when it won't fit (review). */
function SpaceLines(props: { readonly space: Space }) {
  const { t } = useUi();
  const { space } = props;
  if (space.kind === "unknown") return null;
  if (space.kind === "checking")
    return (
      <span>
        <Icon name="hard-drive" />
        {t("snap.checking")}
      </span>
    );
  const { required, available } = space.space;
  return (
    <>
      <span>
        <Icon name="hard-drive" />
        {t("snap.space", {
          needed: formatSize(required),
          free: formatSize(available),
        })}
      </span>
      <span class="st-muted">{t("snap.neededHint")}</span>
      {required > available ? (
        <span class="stb-short">{t("snap.short")}</span>
      ) : null}
    </>
  );
}

function Footer(props: {
  readonly onClose: () => void;
  readonly onCreate: () => void;
  /** Why it can't run now (Foundry busy, a backup running), or null. */
  readonly off: string | null;
}) {
  const { t } = useUi();
  return (
    <>
      <button type="button" onClick={props.onClose}>
        {t("about.cancel")}
      </button>
      {/* The reason sits on a wrapper: disabled buttons get no hover. */}
      <span
        class="nodel"
        title={props.off === "" ? undefined : (props.off ?? undefined)}
      >
        <button
          type="button"
          class="bright"
          disabled={props.off !== null}
          onClick={props.onCreate}
        >
          <Icon name="camera-retro" />
          {t("snap.go")}
        </button>
      </span>
    </>
  );
}

export function SnapshotDialog(props: {
  readonly onClose: () => void;
  readonly onCreate: (note: string) => void;
  readonly askSpace: () => Promise<SnapshotSpace | undefined>;
  readonly off: string | null;
}) {
  const { t } = useUi();
  const [note, setNote] = useState("");
  const counts = useCounts();
  const space = useSpace(props.askSpace);
  const footer = (
    <Footer
      onClose={props.onClose}
      onCreate={() => props.onCreate(note.trim())}
      off={props.off}
    />
  );
  return (
    <Modal title={t("sb.create")} onClose={props.onClose} footer={footer}>
      <div class="sts-launch-body stb-snapdialog">
        <p>{t("snap.lead")}</p>
        <div class="stb-facts">
          <span>
            <Icon name="box-archive" />
            {counts}
          </span>
          <SpaceLines space={space} />
        </div>
        <label class="stb-note">
          <span>{t("snap.note")}</span>
          <input
            type="text"
            value={note}
            maxLength={MAX_SNAPSHOT_NOTE}
            placeholder={t("snap.notePlaceholder")}
            onInput={(e) => setNote(e.currentTarget.value)}
          />
        </label>
        <div class="sts-check warn">
          <Icon name="triangle-exclamation" />
          <span>{t("snap.warn")}</span>
        </div>
      </div>
    </Modal>
  );
}
