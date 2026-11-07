// The Configuration page's state: Foundry's settings as read, what is typed,
// the new admin password on its way, what waits for a restart, and the
// operations that go through Foundry (save, password check, certificates).
import { useEffect, useState } from "preact/hooks";
import type {
  Choices,
  ConfigOp,
  ReadOnly,
  SettingKey,
  Settings,
} from "../../../../page-config.ts";
import { useUi } from "../../../context.ts";
import type { ConfigResult } from "../../../page.ts";
import { changesOf, type Typed } from "./model.ts";

export interface Loaded {
  readonly settings: Settings & ReadOnly;
  readonly choices: Choices;
}

/** The password flow (prototype cfgAccess): check the current one, then choose. */
export type PasswordStep =
  | { readonly step: "current"; readonly error?: string }
  | { readonly step: "new"; readonly error?: string }
  | { readonly step: "done"; readonly password: string };

/** A change, as the bar and the save dialog name it: a setting or the password. */
export type ChangeKey = SettingKey | "password";

function useLoad() {
  const { page } = useUi();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (
    op: ConfigOp,
    changes = {},
    password?: string,
  ): Promise<ConfigResult> => {
    setBusy(true);
    const r = await page.config(op, changes, password).finally(() => {
      setBusy(false);
    });
    if (r.settings && r.choices)
      setLoaded({ settings: r.settings, choices: r.choices });
    setError(r.error ?? null);
    return r;
  };
  useEffect(() => {
    void run("read");
  }, []);
  return { loaded, error, busy, run };
}

type Run = ReturnType<typeof useLoad>["run"];
type SetWaiting = (
  f: (w: readonly ChangeKey[]) => readonly ChangeKey[],
) => void;

/** Foundry checks the current password before a new one is chosen. */
function useCheckPassword(run: Run, setPw: (p: PasswordStep) => void) {
  const { t } = useUi();
  return async (password: string): Promise<void> => {
    const r = await run("checkPassword", {}, password);
    setPw(
      r.passwordOk
        ? { step: "new" }
        : { step: "current", error: t("cfg.pw.wrong") },
    );
  };
}

/** A certificate got or released through Foundry; it applies after a restart. */
function useCertificate(run: Run, setWaiting: SetWaiting) {
  const { actions, t } = useUi();
  return async (
    op: "generateCertificate" | "releaseCertificate",
  ): Promise<void> => {
    const r = await run(op);
    if (r.error) return;
    if (r.restart) setWaiting((w) => [...new Set([...w, "sslCert" as const])]);
    if (op === "generateCertificate")
      actions.notify(
        "info",
        r.method === "letsencrypt"
          ? t("cfg.https.got")
          : t("cfg.https.selfSigned", { reason: r.reason ?? "" }),
      );
  };
}

export function useConfig() {
  const load = useLoad();
  const [typed, setTyped] = useState<Typed>({});
  const [pw, setPw] = useState<PasswordStep | null>(null);
  const [waiting, setWaiting] = useState<readonly ChangeKey[]>([]);
  const saved = load.loaded?.settings;
  const changes = saved ? changesOf(saved, typed) : {};
  const keys: ChangeKey[] = [
    ...(Object.keys(changes) as SettingKey[]),
    ...(pw?.step === "done" ? (["password"] as const) : []),
  ];
  const discard = (): void => {
    setTyped({});
    setPw(null);
  };
  const save = async (): Promise<boolean> => {
    const r = await load.run(
      "save",
      changes,
      pw?.step === "done" ? pw.password : undefined,
    );
    if (r.error) return false;
    discard();
    // Foundry's own restart flag, as it is: today it says restart for any
    // change (even the theme, which applies at once), but we follow it so a
    // finer check in Foundry reaches the page as is (owner, 2026-11-07).
    if (r.restart) setWaiting((w) => [...new Set([...w, ...keys])]);
    return true;
  };
  const checkPassword = useCheckPassword(load.run, setPw);
  const certificate = useCertificate(load.run, setWaiting);
  return {
    ...load,
    typed,
    setTyped,
    pw,
    setPw,
    waiting,
    changes,
    keys,
    discard,
    save,
    checkPassword,
    certificate,
  };
}

export type Config = ReturnType<typeof useConfig>;
