// Startup and appearance, Data and storage, and Other, as the prototype.
import { Icon } from "../../../common/widgets.tsx";
import { useUi } from "../../../context.ts";
import { SelectRow, SwitchRow, TextRow, Row } from "./fields.tsx";
import type { Config } from "./useConfig.ts";

export function Startup(props: { readonly c: Config }) {
  const { t } = useUi();
  const loaded = props.c.loaded;
  if (!loaded) return null;
  return (
    <section class="stw-box">
      <h4>
        <span>{t("cfg.startup")}</span>
      </h4>
      <SelectRow
        c={props.c}
        k="world"
        label={t("cfg.world")}
        hint={t("cfg.worldHint")}
        options={loaded.choices.worlds}
        none={t("cfg.noWorld")}
      />
      <SelectRow
        c={props.c}
        k="language"
        label={t("cfg.language")}
        hint={t("cfg.languageHint")}
        options={loaded.choices.languages}
      />
      <SelectRow
        c={props.c}
        k="cssTheme"
        label={t("cfg.cssTheme")}
        hint={t("cfg.cssThemeHint")}
        options={loaded.choices.themes}
      />
      {loaded.settings.electron ? (
        <SwitchRow
          c={props.c}
          k="fullscreen"
          label={t("cfg.fullscreen")}
          hint={t("cfg.fullscreenHint")}
        />
      ) : null}
    </section>
  );
}

/** Backups are set when the server starts: their state, and a link. */
function BackupsRow(props: { readonly off: boolean }) {
  const { store, t } = useUi();
  return (
    <Row label={t("cfg.backups")} hint={t("cfg.backupsHint")}>
      {props.off ? (
        <span class="stc-state warn">
          <Icon name="ban" />
          {t("cfg.backupsOff")}
        </span>
      ) : (
        <>
          <span class="stc-state ok">
            <Icon name="check" />
            {t("cfg.backupsOn")}
          </span>
          <button
            type="button"
            class="st-link"
            onClick={() =>
              store.set({ route: { kind: "server", page: "backups" } })
            }
          >
            {t("cfg.backupsLink")}
          </button>
        </>
      )}
    </Row>
  );
}

export function Storage(props: {
  readonly c: Config;
  readonly problems: ReadonlySet<string>;
}) {
  const { t } = useUi();
  const s = props.c.loaded?.settings;
  if (!s) return null;
  return (
    <section class="stw-box">
      <h4>
        <span>{t("cfg.data")}</span>
      </h4>
      <TextRow
        c={props.c}
        k="dataPath"
        label={t("cfg.dataPath")}
        hint={t("cfg.dataPathHint")}
        error={
          props.problems.has("dataPath") ? t("cfg.dataPathBad") : undefined
        }
      />
      <BackupsRow off={s.noBackups} />
      <TextRow
        c={props.c}
        k="awsConfig"
        label={t("cfg.awsConfig")}
        hint={t("cfg.awsConfigHint")}
        placeholder={t("cfg.awsConfigPh")}
      />
    </section>
  );
}

export function Other(props: { readonly c: Config }) {
  const { t } = useUi();
  return (
    <section class="stw-box">
      <h4>
        <span>{t("cfg.other")}</span>
      </h4>
      <SwitchRow
        c={props.c}
        k="telemetry"
        label={t("cfg.telemetry")}
        hint={t("cfg.telemetryHint")}
      />
      <SwitchRow
        c={props.c}
        k="hotReload"
        label={t("cfg.hotReload")}
        hint={t("cfg.hotReloadHint")}
      />
      <SwitchRow
        c={props.c}
        k="deleteNEDB"
        label={t("cfg.deleteNEDB")}
        hint={t("cfg.deleteNEDBHint")}
      />
    </section>
  );
}
