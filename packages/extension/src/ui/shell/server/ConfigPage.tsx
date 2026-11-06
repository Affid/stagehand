// The Configuration page (SETUP-REDESIGN.md: Configuration), instead of
// Foundry's Application Configuration window: Foundry's settings grouped by
// task, edits gathered in a "not saved" bar, saved through Foundry's own
// model; then the honest restart notice with Shut down now (Foundry has no
// restart command). The password is changed in Foundry's window for now.
import { useEffect, useState } from "preact/hooks";
import type {
  Choices,
  ReadOnly,
  SettingChanges,
  Settings,
} from "../../../page-config.ts";
import { useUi } from "../../context.ts";
import { plural } from "../../i18n.ts";
import {
  type Draft,
  NumberField,
  SelectField,
  TextField,
  Toggle,
} from "./ConfigFields.tsx";

interface Loaded {
  readonly settings: Settings & ReadOnly;
  readonly choices: Choices;
}

function useConfig() {
  const { page } = useUi();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [changes, setChanges] = useState<SettingChanges>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [restart, setRestart] = useState<boolean | null>(null);
  const take = (r: Awaited<ReturnType<typeof page.config>>): boolean => {
    if (r.settings && r.choices)
      setLoaded({ settings: r.settings, choices: r.choices });
    setError(r.error ?? null);
    return !r.error;
  };
  useEffect(() => {
    void page.config("read").then(take);
  }, []);
  const save = async (): Promise<void> => {
    setBusy(true);
    const r = await page.config("save", changes);
    setBusy(false);
    if (take(r)) {
      setChanges({});
      setRestart(r.restart === true);
    }
  };
  return { loaded, changes, setChanges, error, busy, restart, save };
}

function Bar(props: {
  readonly count: number;
  readonly busy: boolean;
  readonly restart: boolean | null;
  readonly onSave: () => void;
  readonly onDiscard: () => void;
}) {
  const { page, t, canChange } = useUi();
  // One slot whose height is always kept: nothing moves under the pointer.
  return (
    <div class={`mlc-bar${props.count ? " dirty" : ""}`} aria-live="polite">
      {props.count ? (
        <>
          <span>{plural(t, "cfg.unsaved", props.count)}</span>
          <span class="ml-spacer" />
          <button type="button" disabled={props.busy} onClick={props.onDiscard}>
            {t("cfg.discard")}
          </button>
          <button
            type="button"
            class="ml-primary"
            disabled={props.busy || !canChange}
            onClick={props.onSave}
          >
            {props.busy ? t("cfg.saving") : t("cfg.save")}
          </button>
        </>
      ) : props.restart ? (
        <>
          <span>{t("cfg.restart")}</span>
          <span class="ml-spacer" />
          <button
            type="button"
            onClick={() => page.foundryAction({ action: "shutdown" })}
          >
            {t("cfg.shutdown")}
          </button>
        </>
      ) : (
        <span class="ml-hint">
          {props.restart === false ? t("cfg.savedNow") : t("cfg.clean")}
        </span>
      )}
    </div>
  );
}

interface GroupProps {
  readonly loaded: Loaded;
  readonly draft: Draft;
}

function Access(props: GroupProps) {
  const { page, t } = useUi();
  return (
    <fieldset>
      <legend>{t("cfg.access")}</legend>
      <div class="mlc-field">
        <span>{t("cfg.password")}</span>
        <span class="mlc-value">
          {props.loaded.settings.passwordSet
            ? t("cfg.passwordSet")
            : t("cfg.passwordNotSet")}
          <button
            type="button"
            onClick={() => page.foundryAction({ action: "configure" })}
          >
            {t("cfg.passwordChange")}
          </button>
        </span>
      </div>
      <TextField
        draft={props.draft}
        k="adminUsername"
        label={t("cfg.adminUsername")}
        optional
      />
    </fieldset>
  );
}

function Startup(props: GroupProps) {
  const { t } = useUi();
  const { choices } = props.loaded;
  const d = props.draft;
  return (
    <fieldset>
      <legend>{t("cfg.startup")}</legend>
      <SelectField
        draft={d}
        k="world"
        label={t("cfg.world")}
        options={choices.worlds}
        none={t("cfg.noWorld")}
      />
      <SelectField
        draft={d}
        k="language"
        label={t("cfg.language")}
        options={choices.languages}
      />
      <SelectField
        draft={d}
        k="cssTheme"
        label={t("cfg.cssTheme")}
        options={choices.themes}
      />
    </fieldset>
  );
}

function Network(props: GroupProps) {
  const { t } = useUi();
  const d = props.draft;
  return (
    <fieldset>
      <legend>{t("cfg.network")}</legend>
      <NumberField draft={d} k="port" label={t("cfg.port")} />
      <Toggle draft={d} k="upnp" label={t("cfg.upnp")} />
      <TextField draft={d} k="hostname" label={t("cfg.hostname")} optional />
      <TextField
        draft={d}
        k="routePrefix"
        label={t("cfg.routePrefix")}
        optional
      />
      <NumberField
        draft={d}
        k="proxyPort"
        label={t("cfg.proxyPort")}
        optional
      />
      <Toggle draft={d} k="proxySSL" label={t("cfg.proxySSL")} />
    </fieldset>
  );
}

function Data(props: GroupProps) {
  const { t } = useUi();
  return (
    <fieldset>
      <legend>{t("cfg.data")}</legend>
      <div class="mlc-field">
        <span>{t("cfg.dataPath")}</span>
        <code class="mlc-value">{props.loaded.settings.dataPath}</code>
      </div>
      <Toggle
        draft={props.draft}
        k="noBackups"
        label={t("cfg.backups")}
        invert
      />
    </fieldset>
  );
}

function Other(props: GroupProps) {
  const { t } = useUi();
  const d = props.draft;
  return (
    <fieldset>
      <legend>{t("cfg.other")}</legend>
      <Toggle draft={d} k="telemetry" label={t("cfg.telemetry")} />
      <Toggle draft={d} k="hotReload" label={t("cfg.hotReload")} />
      <Toggle draft={d} k="deleteNEDB" label={t("cfg.deleteNEDB")} />
      <Toggle draft={d} k="compressStatic" label={t("cfg.compressStatic")} />
      <Toggle draft={d} k="compressSocket" label={t("cfg.compressSocket")} />
      <SelectField
        draft={d}
        k="updateChannel"
        label={t("cfg.updateChannel")}
        options={props.loaded.choices.channels}
      />
    </fieldset>
  );
}

function Groups(props: GroupProps) {
  return (
    <form onSubmit={(e) => e.preventDefault()}>
      <Access {...props} />
      <Startup {...props} />
      <Network {...props} />
      <Data {...props} />
      <Other {...props} />
    </form>
  );
}

export function ConfigPage() {
  const { page, t } = useUi();
  const c = useConfig();
  const draft: Draft | null = c.loaded
    ? {
        saved: c.loaded.settings,
        changes: c.changes,
        set: (key, value) => {
          const saved = c.loaded?.settings[key];
          c.setChanges((prev) => {
            const rest = Object.fromEntries(
              Object.entries(prev).filter(([k]) => k !== key),
            ) as SettingChanges;
            return value === saved ? rest : { ...rest, [key]: value };
          });
        },
      }
    : null;
  return (
    <div class="mlc-page ml-app">
      <div class="mlw-bhead">
        <h2>{t("cfg.title")}</h2>
        <span class="ml-spacer" />
        <button
          type="button"
          onClick={() => page.foundryAction({ action: "configure" })}
        >
          {t("cfg.foundryWindow")}
        </button>
      </div>
      <p class="ml-hint">{t("cfg.lead")}</p>
      <Bar
        count={Object.keys(c.changes).length}
        busy={c.busy}
        restart={c.restart}
        onSave={() => void c.save()}
        onDiscard={() => c.setChanges({})}
      />
      {c.error ? <p class="ml-banner ml-warn">{c.error}</p> : null}
      {c.loaded && draft ? (
        <Groups loaded={c.loaded} draft={draft} />
      ) : c.error ? null : (
        <p class="ml-empty">{t("cfg.loading")}</p>
      )}
    </div>
  );
}
