// Network and HTTPS, as the prototype's cfgNetwork: the port with UPnP; a
// box that says how players connect (a reverse proxy, Let's Encrypt, your
// own certificate, or not encrypted) with Foundry's own certificate actions;
// your own certificate's files; and an Advanced fold.
import type { ComponentChildren } from "preact";
import { useState } from "preact/hooks";
import { Icon } from "../../../common/widgets.tsx";
import { useUi } from "../../../context.ts";
import { clean, shown } from "./model.ts";
import { Row, SwitchRow, TextInput, TextRow, useField } from "./fields.tsx";
import type { Config } from "./useConfig.ts";

function Box(props: {
  readonly ok: boolean;
  readonly icon: string;
  readonly title: string;
  readonly text: string;
  readonly children?: ComponentChildren;
}) {
  return (
    <div class={`mlc-https ${props.ok ? "ok" : "warn"}`}>
      <Icon name={props.icon} />
      <div>
        <strong>{props.title}</strong>
        <span>{props.text}</span>
      </div>
      {props.children}
    </div>
  );
}

/** Foundry's certificate requests are internal: behind the certificates flag. */
function useCertsAllowed(): boolean {
  const { state, canChange } = useUi();
  const a = state.adapter;
  return (
    canChange &&
    a.status !== "safe-mode" &&
    a.adapter.flags.certificates === true
  );
}

interface HttpsState {
  readonly ok: boolean;
  readonly icon: string;
  readonly title: string;
  readonly text: string;
  readonly action?: "generate" | "release";
}

/** What the box says: a proxy, Let's Encrypt, your own certificate, or none. */
function httpsState(c: Config): HttpsState | null {
  const s = c.loaded?.settings;
  if (!s) return null;
  const shield = "shield-halved";
  const err = s.certificate.error;
  const draft = (k: "sslCert" | "sslKey"): unknown =>
    clean(k, shown(s, c.typed, k));
  if (s.proxySSL)
    return {
      ok: true,
      icon: shield,
      title: "cfg.https.proxy",
      text: "cfg.https.proxyText",
    };
  if (s.certificate.managed)
    return {
      ok: true,
      icon: shield,
      title: "cfg.https.managed",
      text: err ?? "cfg.https.managedText",
      action: "release",
    };
  if (s.sslCert && s.sslKey)
    return {
      ok: true,
      icon: shield,
      title: c.waiting.includes("sslCert")
        ? "cfg.https.ownAfter"
        : "cfg.https.own",
      text: err ?? "cfg.https.ownText",
    };
  if (draft("sslCert") && draft("sslKey"))
    return {
      ok: false,
      icon: shield,
      title: "cfg.https.ownSoon",
      text: "cfg.https.ownSoonText",
    };
  return {
    ok: false,
    icon: "triangle-exclamation",
    title: "cfg.https.none",
    text: "cfg.https.noneText",
    action: "generate",
  };
}

function Https(props: {
  readonly c: Config;
  readonly onCert: (op: "generate" | "release") => void;
}) {
  const { t } = useUi();
  const allowed = useCertsAllowed();
  const st = httpsState(props.c);
  if (!st) return null;
  const action = st.action;
  return (
    <Box ok={st.ok} icon={st.icon} title={t(st.title)} text={t(st.text)}>
      {action && allowed ? (
        <button
          type="button"
          class={action === "generate" ? "bright" : ""}
          onClick={() => props.onCert(action)}
        >
          {t(action === "generate" ? "cfg.https.get" : "cfg.https.release")}
        </button>
      ) : null}
    </Box>
  );
}

function OwnCert(props: {
  readonly c: Config;
  readonly error?: string | undefined;
}) {
  const { t } = useUi();
  const [open, setOpen] = useState(false);
  const s = props.c.loaded?.settings;
  const cert = useField(props.c, "sslCert");
  const key = useField(props.c, "sslKey");
  if (!s || s.proxySSL || s.certificate.managed) return null;
  if (!open && !cert.value && !key.value)
    return (
      <button
        type="button"
        class="ml-link mlc-more"
        onClick={() => setOpen(true)}
      >
        {t("cfg.https.useOwn")}
      </button>
    );
  return (
    <>
      <TextRow
        c={props.c}
        k="sslCert"
        label={t("cfg.sslCert")}
        hint={t("cfg.sslCertHint")}
        placeholder={t("cfg.sslCertPh")}
        error={props.error}
      />
      <TextRow
        c={props.c}
        k="sslKey"
        label={t("cfg.sslKey")}
        placeholder={t("cfg.sslKeyPh")}
      />
    </>
  );
}

function Advanced(props: { readonly c: Config }) {
  const { t } = useUi();
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <button
        type="button"
        class="ml-link mlc-more"
        onClick={() => setOpen(true)}
      >
        {t("cfg.advanced")}
      </button>
    );
  return (
    <>
      <TextRow
        c={props.c}
        k="unixSocket"
        label={t("cfg.unixSocket")}
        hint={t("cfg.unixSocketHint")}
        placeholder={t("cfg.unixSocketPh")}
      />
      <SwitchRow
        c={props.c}
        k="compressStatic"
        label={t("cfg.compressStatic")}
        hint={t("cfg.compressStaticHint")}
      />
      <SwitchRow
        c={props.c}
        k="compressSocket"
        label={t("cfg.compressSocket")}
        hint={t("cfg.compressSocketHint")}
      />
      <button
        type="button"
        class="ml-link mlc-more"
        onClick={() => setOpen(false)}
      >
        {t("cfg.fewer")}
      </button>
    </>
  );
}

export function Network(props: {
  readonly c: Config;
  readonly problems: ReadonlySet<string>;
  readonly onCert: (op: "generate" | "release") => void;
}) {
  const { t, canChange } = useUi();
  const port = useField(props.c, "port");
  const upnp = useField(props.c, "upnp");
  return (
    <section class="mlw-box">
      <h4>
        <span>{t("cfg.network")}</span>
      </h4>
      <Row
        label={t("cfg.port")}
        hint={t("cfg.portHint")}
        error={props.problems.has("port") ? t("cfg.portRange") : undefined}
        changed={port.changed || upnp.changed}
      >
        <div class="mlc-port">
          <TextInput
            c={props.c}
            k="port"
            label={t("cfg.port")}
            type="number"
            placeholder="30000"
          />
          <label>
            <input
              type="checkbox"
              checked={upnp.value === true}
              disabled={!canChange}
              onChange={(e) => upnp.set(e.currentTarget.checked)}
            />
            {t("cfg.upnp")}
          </label>
        </div>
      </Row>
      <Https c={props.c} onCert={props.onCert} />
      <OwnCert
        c={props.c}
        error={props.problems.has("sslCert") ? t("cfg.sslPair") : undefined}
      />
      <Advanced c={props.c} />
    </section>
  );
}
