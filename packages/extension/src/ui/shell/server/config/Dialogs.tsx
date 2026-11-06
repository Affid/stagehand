// The Configuration page's dialogs, as the prototype: Save (each change from
// its saved value to the new one, and that it waits for a restart), Shut
// down (Foundry stops; whatever started it may bring it back), and the
// certificate requests (what Foundry will do, before it does).
import type { SettingKey, Settings } from "../../../../page-config.ts";
import { Icon, Modal } from "../../../common/widgets.tsx";
import { useUi } from "../../../context.ts";
import { plural, type Translate } from "../../../i18n.ts";
import type { ChangeKey, Config } from "./useConfig.ts";

/** A setting's value as people read it (prototype cfgShow). */
function show(t: Translate, c: Config, k: SettingKey, v: unknown): string {
  const choices = c.loaded?.choices;
  const text = typeof v === "string" || typeof v === "number" ? String(v) : "";
  const find = (
    list: readonly { value: string; label: string }[] | undefined,
  ): string => list?.find((x) => x.value === v)?.label ?? text;
  if (k === "world") return text ? find(choices?.worlds) : t("cfg.noWorld");
  if (k === "cssTheme") return find(choices?.themes);
  if (k === "language") return find(choices?.languages);
  if (typeof v === "boolean") return t(v ? "cfg.on" : "cfg.off");
  return text || t("cfg.notSet");
}

/** Cancel, and the dialog's own action. */
function Footer(props: {
  readonly onClose: () => void;
  readonly busy?: boolean;
  readonly danger?: boolean;
  readonly icon?: string;
  readonly label: string;
  readonly onGo: () => void;
}) {
  const { t } = useUi();
  return (
    <>
      <button type="button" onClick={props.onClose}>
        {t("about.cancel")}
      </button>
      <button
        type="button"
        class={props.danger ? "del" : "bright"}
        disabled={props.busy ?? false}
        onClick={props.onGo}
      >
        {props.icon ? <Icon name={props.icon} /> : null}
        {props.label}
      </button>
    </>
  );
}

function Diff(props: { readonly c: Config }) {
  const { t } = useUi();
  const { c } = props;
  const saved = c.loaded?.settings as Settings | undefined;
  const label = (k: ChangeKey): string =>
    t(k === "password" ? "cfg.password" : `cfg.${k}`);
  return (
    <ul class="mlc-diff">
      {c.keys.map((k) => (
        <li key={k}>
          <strong>{label(k)}</strong>
          {k === "password" ? (
            <span>{t("cfg.newPassword")}</span>
          ) : (
            <span>
              {show(t, c, k, saved?.[k])} → <b>{show(t, c, k, c.changes[k])}</b>
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

export function SaveDialog(props: {
  readonly c: Config;
  readonly onClose: () => void;
}) {
  const { t } = useUi();
  const { c } = props;
  const moved = c.keys.some((k) => k === "port" || k === "unixSocket");
  const footer = (
    <Footer
      onClose={props.onClose}
      busy={c.busy}
      icon="floppy-disk"
      label={plural(t, "cfg.saveN", c.keys.length)}
      onGo={() => void c.save().then((ok) => ok && props.onClose())}
    />
  );
  return (
    <Modal title={t("cfg.saveTitle")} onClose={props.onClose} footer={footer}>
      <Diff c={c} />
      <div class="mls-check warn">
        <Icon name="rotate" />
        <span>{t("cfg.saveWarn")}</span>
      </div>
      {moved ? <p class="ml-muted">{t("cfg.newAddress")}</p> : null}
      {c.error ? <p class="ml-banner ml-warn">{c.error}</p> : null}
    </Modal>
  );
}

export function StopDialog(props: {
  readonly electron: boolean;
  readonly onClose: () => void;
}) {
  const { page, t } = useUi();
  const footer = (
    <>
      <button type="button" onClick={props.onClose}>
        {t("about.cancel")}
      </button>
      <button
        type="button"
        class="del"
        onClick={() => page.foundryAction({ action: "quit" })}
      >
        <Icon name="power-off" />
        {t(props.electron ? "cfg.quit" : "cfg.shutDown")}
      </button>
    </>
  );
  return (
    <Modal
      title={t(props.electron ? "cfg.quit" : "cfg.shutDown")}
      onClose={props.onClose}
      footer={footer}
    >
      {props.electron ? (
        <p>{t("cfg.stop.electron")}</p>
      ) : (
        <>
          <p>{t("cfg.stop.lead")}</p>
          <ul class="mlc-how">
            <li>
              <Icon name="rotate" />
              <span>{t("cfg.stop.service")}</span>
            </li>
            <li>
              <Icon name="terminal" />
              <span>{t("cfg.stop.hand")}</span>
            </li>
          </ul>
          <p class="ml-muted">{t("cfg.stop.cant")}</p>
        </>
      )}
    </Modal>
  );
}

export function CertDialog(props: {
  readonly c: Config;
  readonly op: "generate" | "release";
  readonly onClose: () => void;
}) {
  const { t } = useUi();
  const get = props.op === "generate";
  const go = (): void => {
    void props.c
      .certificate(get ? "generateCertificate" : "releaseCertificate")
      .then(props.onClose);
  };
  const footer = (
    <Footer
      onClose={props.onClose}
      busy={props.c.busy}
      label={
        props.c.busy
          ? t("cfg.https.working")
          : t(get ? "cfg.https.getGo" : "cfg.https.releaseGo")
      }
      onGo={go}
    />
  );
  return (
    <Modal
      title={t(get ? "cfg.https.getTitle" : "cfg.https.releaseTitle")}
      onClose={props.onClose}
      footer={footer}
    >
      {get ? (
        <>
          <p>{t("cfg.https.getLead")}</p>
          <p>{t("cfg.https.getFallback")}</p>
          <p class="ml-muted">{t("cfg.https.getTerms")}</p>
        </>
      ) : (
        <p>{t("cfg.https.releaseLead")}</p>
      )}
    </Modal>
  );
}
