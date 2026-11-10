// The Configuration page, as the prototype (design/setup-page/src/_config.js)
// in place of Foundry's Application Configuration window: the settings that
// window edits, grouped by task in two columns; changes gathered in a bar at
// the bottom and saved through Foundry after a dialog that lists them; then
// the restart notice with Shut down now (Foundry has no restart command).
import { useState } from "preact/hooks";
import { Icon } from "../../../common/widgets.tsx";
import { useUi } from "../../../context.ts";
import { plural } from "../../../i18n.ts";
import { PageHead } from "../PageHead.tsx";
import { Access } from "./Access.tsx";
import { CertDialog, SaveDialog, StopDialog } from "./Dialogs.tsx";
import { problemsOf } from "./model.ts";
import { Network } from "./Network.tsx";
import { Other, Startup, Storage } from "./Sections.tsx";
import { type ChangeKey, type Config, useConfig } from "./useConfig.ts";
import { Docked } from "../../phone/Dock.tsx";

type Dialog = "save" | "stop" | "generate" | "release" | null;

function Running(props: { readonly c: Config }) {
  const { state, t } = useUi();
  const s = props.c.loaded?.settings;
  if (!s) return null;
  const where = s.running.unixSocket
    ? t("cfg.onSocket")
    : t("cfg.onPort", { port: String(s.running.port) });
  return (
    <>
      {t("cfg.head", { version: state.data.setup?.core.version ?? "", where })}
      <code>{s.running.dataPath}</code>
    </>
  );
}

function Unsaved(props: {
  readonly c: Config;
  readonly problems: number;
  readonly onSave: () => void;
}) {
  const { t, canChange } = useUi();
  const { c } = props;
  const label = (k: ChangeKey): string =>
    t(k === "password" ? "cfg.password" : `cfg.${k}`);
  return (
    <div class="stc-unsaved" role="status">
      <Icon name="pen" />
      <span>
        <b>{plural(t, "cfg.changes", c.keys.length)}</b> {t("cfg.notSaved")}:{" "}
        {c.keys.map(label).join(", ")}
      </span>
      <button type="button" onClick={c.discard}>
        {t("cfg.discard")}
      </button>
      <span
        class="nodel"
        title={
          props.problems ? plural(t, "cfg.fixFirst", props.problems) : undefined
        }
      >
        <button
          type="button"
          class="bright"
          disabled={!canChange || props.problems > 0}
          onClick={props.onSave}
        >
          {t("cfg.saveDots")}
        </button>
      </span>
    </div>
  );
}

function Waiting(props: { readonly c: Config; readonly onStop: () => void }) {
  const { t } = useUi();
  const { c } = props;
  const label = (k: ChangeKey): string =>
    t(k === "password" ? "cfg.password" : `cfg.${k}`);
  return (
    <div class="stc-waiting" role="status">
      <Icon name="rotate" />
      <span>
        <b>{t("cfg.waiting")}</b> {c.waiting.map(label).join(", ")}.
      </span>
      <button type="button" onClick={props.onStop}>
        {t(c.loaded?.settings.electron ? "cfg.quitDots" : "cfg.shutDownDots")}
      </button>
    </div>
  );
}

/** At the bottom, in space always kept free: unsaved changes, else what waits for a restart. */
function Bar(props: {
  readonly c: Config;
  readonly problems: number;
  readonly onDialog: (d: Dialog) => void;
}) {
  const { c } = props;
  if (!c.keys.length && !c.waiting.length) return null;
  return (
    <div class="stc-bar">
      {c.keys.length ? (
        <Unsaved
          c={c}
          problems={props.problems}
          onSave={() => props.onDialog("save")}
        />
      ) : (
        <Waiting c={c} onStop={() => props.onDialog("stop")} />
      )}
    </div>
  );
}

function Body(props: {
  readonly c: Config;
  readonly problems: ReadonlySet<string>;
  readonly onDialog: (d: Dialog) => void;
}) {
  const { c, problems } = props;
  return (
    <div class="stc-cols">
      <div class="col">
        <Access c={c} />
        <Startup c={c} />
        <Other c={c} />
      </div>
      <div class="col">
        <Network
          c={c}
          problems={problems}
          onCert={(op) => props.onDialog(op)}
        />
        <Storage c={c} problems={problems} />
      </div>
    </div>
  );
}

export function ConfigPage() {
  const { t } = useUi();
  const c = useConfig();
  const [dialog, setDialog] = useState<Dialog>(null);
  const saved = c.loaded?.settings;
  const problems = saved ? problemsOf(saved, c.typed) : new Set<string>();
  const close = (): void => setDialog(null);
  return (
    <div class="stc-page st-app">
      <PageHead
        title={t("cfg.title")}
        summary={c.loaded ? <Running c={c} /> : undefined}
      />
      {c.error && !dialog ? <p class="st-banner st-warn">{c.error}</p> : null}
      {c.loaded ? (
        <Body c={c} problems={problems} onDialog={setDialog} />
      ) : c.error ? null : (
        <p class="st-empty">{t("cfg.loading")}</p>
      )}
      {/* On a phone the bar sits above the tabs, where Save stays in reach. */}
      <Docked>
        <Bar c={c} problems={problems.size} onDialog={setDialog} />
      </Docked>
      {dialog === "save" ? <SaveDialog c={c} onClose={close} /> : null}
      {dialog === "stop" ? (
        <StopDialog electron={saved?.electron === true} onClose={close} />
      ) : null}
      {dialog === "generate" || dialog === "release" ? (
        <CertDialog c={c} op={dialog} onClose={close} />
      ) : null}
    </div>
  );
}
