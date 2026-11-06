// The Configuration page (SETUP-REDESIGN.md: Configuration), instead of
// Foundry's Application Configuration window: Foundry's settings grouped by
// task, edits gathered in a "not saved" bar, saved through Foundry's own
// model; then the honest restart notice with Shut down now (Foundry has no
// restart command). The password is changed in Foundry's window for now.
import { useEffect, useState } from "preact/hooks";
import {
  type Choices,
  EDITABLE,
  type ReadOnly,
  type SettingChanges,
  type SettingKey,
  type Settings,
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

/** Text is trimmed when saved, not while typed; an empty optional is null. */
function normalize(changes: SettingChanges): SettingChanges {
  return Object.fromEntries(
    Object.entries(changes).map(([k, v]) => {
      if (typeof v !== "string") return [k, v];
      const text = v.trim();
      const optional = EDITABLE[k as keyof typeof EDITABLE] === "optText";
      return [k, optional && text === "" ? null : text];
    }),
  ) as SettingChanges;
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
    const r = await page.config("save", normalize(changes));
    setBusy(false);
    if (take(r)) {
      setChanges({});
      // A pending restart stays pending until Foundry restarts.
      setRestart((prev) => prev === true || r.restart === true);
    }
  };
  return { loaded, changes, setChanges, error, busy, restart, save };
}

function Bar(props: {
  readonly count: number;
  readonly busy: boolean;
  readonly restart: boolean | null;
  /** A field holds something that can't be saved. */
  readonly invalid: boolean;
  readonly onSave: () => void;
  readonly onDiscard: () => void;
}) {
  const { page, t, canChange } = useUi();
  // One slot whose height is always kept: nothing moves under the pointer.
  return (
    <div
      class={`mlc-bar${props.count || props.invalid ? " dirty" : ""}`}
      aria-live="polite"
    >
      {props.count || props.invalid ? (
        <>
          <span>{plural(t, "cfg.unsaved", props.count)}</span>
          <span class="ml-spacer" />
          <button type="button" disabled={props.busy} onClick={props.onDiscard}>
            {t("cfg.discard")}
          </button>
          <button
            type="button"
            class="ml-primary"
            disabled={props.busy || !canChange || props.invalid}
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
  const { t } = useUi();
  return (
    <fieldset>
      <legend>{t("cfg.access")}</legend>
      <div class="mlc-field">
        <span>{t("cfg.password")}</span>
        <span class="mlc-value">
          {props.loaded.settings.passwordSet
            ? t("cfg.passwordSet")
            : t("cfg.passwordNotSet")}
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

/** The page's draft: changes against the saved settings, and invalid fields. */
function useDraft(
  loaded: Loaded | null,
  changes: SettingChanges,
  setChanges: (f: (prev: SettingChanges) => SettingChanges) => void,
  invalid: ReadonlySet<SettingKey>,
  setInvalid: (
    f: (prev: ReadonlySet<SettingKey>) => ReadonlySet<SettingKey>,
  ) => void,
): Draft | null {
  if (!loaded) return null;
  return {
    saved: loaded.settings,
    changes,
    invalid,
    setInvalid: (key, bad) => {
      setInvalid((prev) => {
        const next = new Set(prev);
        if (bad) next.add(key);
        else next.delete(key);
        return next;
      });
    },
    set: (key, value) => {
      const saved = loaded.settings[key];
      setChanges((prev) => {
        const rest = Object.fromEntries(
          Object.entries(prev).filter(([k]) => k !== key),
        ) as SettingChanges;
        return value === saved ? rest : { ...rest, [key]: value };
      });
    },
  };
}

export function ConfigPage() {
  const { t } = useUi();
  const c = useConfig();
  const [invalid, setInvalid] = useState<ReadonlySet<SettingKey>>(new Set());
  const draft = useDraft(
    c.loaded,
    c.changes,
    c.setChanges,
    invalid,
    setInvalid,
  );
  return (
    <div class="mlc-page ml-app">
      <div class="mlw-bhead">
        <h2>{t("cfg.title")}</h2>
      </div>
      <p class="ml-hint">{t("cfg.lead")}</p>
      <Bar
        count={Object.keys(c.changes).length}
        busy={c.busy}
        restart={c.restart}
        onSave={() => void c.save()}
        invalid={invalid.size > 0}
        onDiscard={() => {
          c.setChanges({});
          setInvalid(new Set());
        }}
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
