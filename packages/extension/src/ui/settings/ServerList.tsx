// The servers Module Library runs on, each with Remove, and adding one by
// its address.
import { useState } from "preact/hooks";
import { normalizeServerUrl } from "../../background/servers.ts";
import type { Translate } from "../i18n.ts";
import { type Servers, serverLabel } from "./useServers.ts";

const messageOf = (e: unknown): string =>
  e instanceof Error ? e.message : String(e);

function AddServer(props: { readonly t: Translate; readonly s: Servers }) {
  const { t } = props;
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const submit = (e: Event): void => {
    e.preventDefault();
    let server: string;
    try {
      server = normalizeServerUrl(value.trim());
    } catch (err: unknown) {
      setError(messageOf(err));
      return;
    }
    setError("");
    props.s
      .add(server)
      .then((added) => {
        if (added) setValue("");
        else setError(t("set.refused"));
      })
      .catch((err: unknown) => {
        setError(messageOf(err));
      });
  };
  return (
    <form class="mlp-add" onSubmit={submit}>
      <input
        aria-label={t("set.address")}
        placeholder="http://localhost:30000"
        value={value}
        onInput={(e) => {
          setValue(e.currentTarget.value);
        }}
      />
      <button type="submit">{t("set.add")}</button>
      {error ? (
        <p class="mlp-err" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}

/** Saved but off (the browser dropped its scripts): turn it back on. */
function Off(props: {
  readonly t: Translate;
  readonly id: string;
  readonly s: Servers;
}) {
  const { t, id } = props;
  return (
    <span class="mlp-off">
      <span class="mlp-tag">{t("set.off")}</span>
      <button
        type="button"
        aria-label={t("set.turnOnAria", { server: serverLabel(id) })}
        onClick={() => {
          props.s.add(id).catch(() => undefined);
        }}
      >
        {t("set.turnOn")}
      </button>
    </span>
  );
}

/** One server, with Remove and what went wrong removing it. */
function ServerRow(props: {
  readonly t: Translate;
  readonly id: string;
  readonly active: boolean;
  readonly s: Servers;
}) {
  const { t, id, s } = props;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const remove = (): void => {
    setBusy(true);
    setError("");
    s.remove(id).catch((err: unknown) => {
      setError(messageOf(err));
      setBusy(false);
    });
  };
  return (
    <li>
      <span class="mlp-addr">{serverLabel(id)}</span>
      {props.active ? null : <Off t={t} id={id} s={s} />}
      <button
        type="button"
        class="mlp-quiet"
        disabled={busy}
        aria-label={t("set.removeAria", { server: serverLabel(id) })}
        onClick={remove}
      >
        {t("set.remove")}
      </button>
      {error ? (
        <p class="mlp-err" role="alert">
          {error}
        </p>
      ) : null}
    </li>
  );
}

export function ServerList(props: {
  readonly t: Translate;
  readonly s: Servers;
}) {
  const { t, s } = props;
  return (
    <section aria-labelledby="mlp-servers-h">
      <h2 id="mlp-servers-h">{t("set.servers")}</h2>
      {s.list?.length === 0 ? <p class="mlp-muted">{t("set.none")}</p> : null}
      <ul class="mlp-servers">
        {(s.list ?? []).map((r) => (
          <ServerRow key={r.id} t={t} id={r.id} active={r.active} s={s} />
        ))}
      </ul>
      <AddServer t={t} s={s} />
      {s.list?.length ? (
        <p class="mlp-muted mlp-small">{t("set.removeNote")}</p>
      ) : null}
    </section>
  );
}
