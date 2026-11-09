// A saved server's own sheet (⋮ on its card): rename it, give it a new
// address that keeps its library, turn it back on, or remove it after asking
// (mockup: design/app-screens, approved 2026-11-09).
import { useState } from "preact/hooks";
import { MAX_SERVER_NAME } from "../../messages.ts";
import type { Translate } from "../i18n.ts";
import type { AppHome } from "../settings/platform.ts";
import type { ListedServer, Servers } from "../settings/useServers.ts";
import { hostOf, serverOf, type Typed, typedOf } from "./address.ts";
import { AddressField } from "./AddressField.tsx";
import { CheckLine } from "./CheckLine.tsx";
import { ErrorLine } from "./ErrorLine.tsx";
import { Sheet } from "./Sheet.tsx";
import { useCheck } from "./useCheck.ts";

export interface ServerSheetProps {
  readonly t: Translate;
  readonly server: ListedServer;
  readonly servers: Servers;
  readonly app: AppHome;
  readonly onClose: () => void;
}

const messageOf = (e: unknown): string =>
  e instanceof Error ? e.message : String(e);

/** Runs one change of the sheet: busy meanwhile, its error shown. */
function useWork(onDone: () => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const run = (work: () => Promise<string | undefined>): void => {
    setBusy(true);
    setError("");
    work()
      .then((failed) => {
        if (failed) setError(failed);
        else onDone();
      })
      .catch((e: unknown) => {
        setError(messageOf(e));
      })
      .finally(() => {
        setBusy(false);
      });
  };
  return { busy, error, run };
}

export function ServerSheet(props: ServerSheetProps) {
  const [removing, setRemoving] = useState(false);
  return removing ? (
    <RemoveView {...props} />
  ) : (
    <EditView
      {...props}
      onRemove={() => {
        setRemoving(true);
      }}
    />
  );
}

/** Saves the sheet: the name first, then the address (which keeps it). */
function useSave(
  props: ServerSheetProps,
  name: string,
  next: string | undefined,
) {
  const { t, server, servers } = props;
  const work = useWork(props.onClose);
  const save = (e: Event): void => {
    e.preventDefault();
    work.run(async () => {
      if (!next) return t("home.badAddress");
      if (name.trim() !== (server.name ?? ""))
        await servers.rename(server.id, name);
      if (next === server.id) return undefined;
      return (await servers.move(server.id, next))
        ? undefined
        : t("home.refused");
    });
  };
  return { ...work, save };
}

function EditView(props: ServerSheetProps & { readonly onRemove: () => void }) {
  const { t, server, servers } = props;
  const [name, setName] = useState(server.name ?? "");
  const [typed, setTyped] = useState<Typed>(typedOf(server.id));
  const next = serverOf(typed);
  const check = useCheck(
    props.app.check,
    next === server.id ? undefined : next,
  );
  const work = useSave(props, name, next);
  return (
    <Sheet title={server.name ?? hostOf(server.id)} onClose={props.onClose}>
      <form class="mlh-form" onSubmit={work.save}>
        <NameField
          t={t}
          value={name}
          placeholder={hostOf(server.id)}
          onChange={setName}
        />
        <AddressField
          t={t}
          id="mlh-edit-addr"
          value={typed}
          onChange={setTyped}
          help={t("home.moveHelp")}
        />
        <CheckLine t={t} check={check} />
        <ErrorLine error={work.error} />
        <button type="submit" class="mlh-btn mlh-bright" disabled={work.busy}>
          {t("home.save")}
        </button>
        {server.active ? null : (
          <TurnOn
            t={t}
            server={server}
            servers={servers}
            disabled={work.busy}
          />
        )}
        <button
          type="button"
          class="mlh-btn mlh-ghost mlh-danger"
          onClick={props.onRemove}
        >
          {t("home.removeAsk")}
        </button>
      </form>
    </Sheet>
  );
}

function NameField(props: {
  readonly t: Translate;
  readonly value: string;
  readonly placeholder: string;
  readonly onChange: (name: string) => void;
}) {
  return (
    <div class="mlh-field">
      <label for="mlh-name">{props.t("home.name")}</label>
      <input
        id="mlh-name"
        class="mlh-input"
        value={props.value}
        placeholder={props.placeholder}
        maxLength={MAX_SERVER_NAME}
        autocomplete="off"
        onInput={(e) => {
          props.onChange(e.currentTarget.value);
        }}
      />
    </div>
  );
}

/** Saved but off (its scripts were dropped): on again. */
function TurnOn(props: {
  readonly t: Translate;
  readonly server: ListedServer;
  readonly servers: Servers;
  readonly disabled: boolean;
}) {
  return (
    <button
      type="button"
      class="mlh-btn"
      disabled={props.disabled}
      onClick={() => {
        props.servers.add(props.server.id).catch(() => undefined);
      }}
    >
      {props.t("home.turnOn")}
    </button>
  );
}

function RemoveView(props: ServerSheetProps) {
  const { t, server, servers } = props;
  const label = server.name ?? hostOf(server.id);
  const work = useWork(props.onClose);
  const remove = (): void => {
    work.run(async () => {
      await servers.remove(server.id);
      return undefined;
    });
  };
  return (
    <Sheet
      title={t("home.removeTitle", { server: label })}
      onClose={props.onClose}
    >
      <p class="mlh-help">
        {t("home.removeText", { host: hostOf(server.id) })}
      </p>
      <ErrorLine error={work.error} />
      <button
        type="button"
        class="mlh-btn mlh-danger"
        disabled={work.busy}
        onClick={remove}
      >
        {t("home.removeGo")}
      </button>
      <button type="button" class="mlh-btn mlh-ghost" onClick={props.onClose}>
        {t("home.cancel")}
      </button>
    </Sheet>
  );
}
