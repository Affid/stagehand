// Adding a server: its address without the protocol, the toggle, whether
// Foundry answers there, then Add and open (mockup: design/app-screens).
import { useState } from "preact/hooks";
import type { ServerId } from "../../background/servers.ts";
import type { Translate } from "../i18n.ts";
import type { AppHome } from "../settings/platform.ts";
import type { Servers } from "../settings/useServers.ts";
import { serverOf, type Typed } from "./address.ts";
import { AddressField } from "./AddressField.tsx";
import { CheckLine } from "./CheckLine.tsx";
import { ErrorLine } from "./ErrorLine.tsx";
import { Sheet } from "./Sheet.tsx";
import { useCheck } from "./useCheck.ts";

export interface AddSheetProps {
  readonly t: Translate;
  readonly servers: Servers;
  readonly app: AppHome;
  readonly onClose: () => void;
  /** Opens the server in the app, added or already saved. */
  readonly onOpen: (server: ServerId) => void;
}

const messageOf = (e: unknown): string =>
  e instanceof Error ? e.message : String(e);

/** Adds the typed server, then opens it; a saved one just opens. */
function useAdd(props: AddSheetProps) {
  const { t, servers } = props;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const add = (server: ServerId | undefined): void => {
    if (!server) {
      setError(t("home.badAddress"));
      return;
    }
    if (servers.list?.some((s) => s.id === server)) {
      props.onOpen(server);
      return;
    }
    setBusy(true);
    setError("");
    servers
      .add(server)
      .then((added) => {
        if (added) props.onOpen(server);
        else setError(t("home.refused"));
      })
      .catch((err: unknown) => {
        setError(messageOf(err));
      })
      .finally(() => {
        setBusy(false);
      });
  };
  return { busy, error, add };
}

export function AddSheet(props: AddSheetProps) {
  const { t, app } = props;
  const [typed, setTyped] = useState<Typed>({ scheme: "http", rest: "" });
  const server = serverOf(typed);
  const check = useCheck(app.check, server);
  const { busy, error, add } = useAdd(props);
  const submit = (e: Event): void => {
    e.preventDefault();
    add(server);
  };
  return (
    <Sheet title={t("home.addTitle")} onClose={props.onClose}>
      <form class="mlh-form" onSubmit={submit}>
        <AddressField
          t={t}
          id="mlh-add-addr"
          value={typed}
          onChange={setTyped}
          focus
          help={t("home.addressHelp")}
        />
        <CheckLine t={t} check={check} />
        <ErrorLine error={error} />
        <button type="submit" class="mlh-btn mlh-bright" disabled={busy}>
          {t("home.addOpen")}
        </button>
      </form>
    </Sheet>
  );
}
