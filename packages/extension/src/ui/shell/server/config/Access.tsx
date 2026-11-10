// Access, as the prototype's cfgAccess: the admin password (set or not; to
// change it Foundry first checks the current one, then the new one is typed
// twice and saved with the other changes) and the admin username.
import { useState } from "preact/hooks";
import { Icon } from "../../../common/widgets.tsx";
import { useUi } from "../../../context.ts";
import { Row, TextRow } from "./fields.tsx";
import type { Config } from "./useConfig.ts";

/** Foundry has no rule; the prototype asks for at least this many. */
const MIN_PASSWORD = 8;

function State(props: { readonly set: boolean }) {
  const { t } = useUi();
  return props.set ? (
    <span class="stc-state ok">
      <Icon name="lock" />
      {t("cfg.pw.set")}
    </span>
  ) : (
    <span class="stc-state bad">
      <Icon name="lock-open" />
      {t("cfg.pw.notSet")}
    </span>
  );
}

function Current(props: {
  readonly c: Config;
  readonly error?: string | undefined;
}) {
  const { t } = useUi();
  const [text, setText] = useState("");
  return (
    <div class="stc-pw">
      <input
        type="password"
        autocomplete="current-password"
        aria-label={t("cfg.pw.current")}
        placeholder={t("cfg.pw.current")}
        value={text}
        onInput={(e) => setText(e.currentTarget.value)}
      />
      <button
        type="button"
        class="bright"
        disabled={!text || props.c.busy}
        onClick={() => void props.c.checkPassword(text)}
      >
        {t("cfg.pw.continue")}
      </button>
      <button type="button" onClick={() => props.c.setPw(null)}>
        {t("about.cancel")}
      </button>
      {props.error ? (
        <span class="err" role="alert">
          {props.error}
        </span>
      ) : null}
    </div>
  );
}

function Next(props: {
  readonly c: Config;
  readonly error?: string | undefined;
}) {
  const { t } = useUi();
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const use = (): void => {
    if (a.length < MIN_PASSWORD)
      props.c.setPw({
        step: "new",
        error: t("cfg.pw.short", { n: String(MIN_PASSWORD) }),
      });
    else if (a !== b)
      props.c.setPw({ step: "new", error: t("cfg.pw.mismatch") });
    else props.c.setPw({ step: "done", password: a });
  };
  return (
    <div class="stc-pw">
      <input
        type="password"
        autocomplete="new-password"
        aria-label={t("cfg.pw.new")}
        placeholder={t("cfg.pw.new")}
        value={a}
        onInput={(e) => setA(e.currentTarget.value)}
      />
      <input
        type="password"
        autocomplete="new-password"
        aria-label={t("cfg.pw.repeat")}
        placeholder={t("cfg.pw.repeatShort")}
        value={b}
        onInput={(e) => setB(e.currentTarget.value)}
      />
      <button type="button" class="bright" onClick={use}>
        {t("cfg.pw.use")}
      </button>
      <button type="button" onClick={() => props.c.setPw(null)}>
        {t("about.cancel")}
      </button>
      {props.error ? (
        <span class="err" role="alert">
          {props.error}
        </span>
      ) : null}
    </div>
  );
}

function PasswordFlow(props: { readonly c: Config }) {
  const { t, canChange } = useUi();
  const { c } = props;
  const set = c.loaded?.settings.passwordSet === true;
  const pw = c.pw;
  if (pw?.step === "current") return <Current c={c} error={pw.error} />;
  if (pw?.step === "new") return <Next c={c} error={pw.error} />;
  if (pw?.step === "done")
    return (
      <>
        <span class="stc-state warn">
          <Icon name="clock" />
          {t("cfg.pw.chosen")}
        </span>
        <button type="button" onClick={() => c.setPw(null)}>
          {t("cfg.pw.undo")}
        </button>
      </>
    );
  return (
    <>
      <State set={set} />
      <button
        type="button"
        disabled={!canChange}
        onClick={() => c.setPw({ step: set ? "current" : "new" })}
      >
        {t(set ? "cfg.pw.change" : "cfg.pw.setOne")}
      </button>
    </>
  );
}

export function Access(props: { readonly c: Config }) {
  const { t } = useUi();
  return (
    <section class="stw-box">
      <h4>
        <span>{t("cfg.access")}</span>
      </h4>
      <Row
        label={t("cfg.password")}
        hint={t("cfg.pw.hint")}
        changed={props.c.pw?.step === "done"}
      >
        <PasswordFlow c={props.c} />
      </Row>
      <TextRow
        c={props.c}
        k="adminUsername"
        label={t("cfg.adminUsername")}
        hint={t("cfg.adminUsernameHint")}
        placeholder={t("cfg.optional")}
      />
    </section>
  );
}
