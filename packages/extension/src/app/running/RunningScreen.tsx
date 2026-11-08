// The app's screen while a world runs (Android plan, phase 3, package 6;
// mockup: design/setup-page/src/_running.js). Foundry has no Setup then and
// sends everyone to /join; the app is for Setup, so it shows which world
// runs, who is in it and for how long, and one way out: Return to Setup. With
// people in the game it asks first; Foundry wants the administrator password
// to close a world, so the app asks for it when Foundry does.
import type { ComponentChildren } from "preact";
import { useRef, useState } from "preact/hooks";
import { useModalFocus } from "../../ui/common/modal-focus.ts";
import { Icon } from "../../ui/common/widgets.tsx";
import { plural, type Translate } from "../../ui/i18n.ts";
import { cssImage } from "../../ui/shell/route.ts";
import {
  type CloseResult,
  type JoinResult,
  type JoinUser,
  type RunningWorld,
  type Status,
  uptimeParts,
} from "./server.ts";

export interface RunningProps {
  readonly t: Translate;
  readonly world: RunningWorld;
  readonly status: Status | undefined;
  readonly origin: string;
  /** Asks Foundry to close the world (a password when it wants one). */
  readonly close: (password?: string) => Promise<CloseResult>;
  /** Who can join (the join page's users, Gamemasters first). */
  readonly users: readonly JoinUser[];
  /** Changes launched with this world from our Setup, if it just was. */
  readonly launched: number | undefined;
  /** Joins as a user; on success the page goes into the game. */
  readonly join: (userId: string, password: string) => Promise<JoinResult>;
  /** The app's server list (native opens it on a tap). */
  readonly serversHref: string;
}

type Step =
  | { readonly kind: "idle" }
  | { readonly kind: "asking" }
  | { readonly kind: "password"; readonly wrong: boolean }
  | { readonly kind: "closing" }
  | { readonly kind: "failed" };

function since(t: Translate, seconds: number | undefined): string | null {
  if (seconds === undefined) return null;
  const { h, min } = uptimeParts(seconds);
  if (h) return t("run.forHours", { h, min });
  return min ? t("run.forMinutes", { min }) : t("run.justStarted");
}

function Hero(props: RunningProps) {
  const { t, world, status } = props;
  const n = status?.users ?? 0;
  const image = cssImage(world.background, props.origin);
  const uptime = since(t, status?.uptime);
  return (
    <div class="mlr-hero" style={image ? { "--img": image } : undefined}>
      <span class="live">
        <i aria-hidden="true" />
        {t("run.live")}
      </span>
      <h2>{world.title}</h2>
      <div class="meta">
        {status?.system ? (
          <span>
            <Icon name="dice-d20" />
            {[status.system, status.systemVersion].filter(Boolean).join(" ")}
          </span>
        ) : null}
        <span>
          <Icon name="users" />
          {n ? plural(t, "run.people", n) : t("run.nobody")}
        </span>
        {uptime ? (
          <span>
            <Icon name="clock" />
            {uptime}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/** A question in a sheet from the bottom; Escape and the scrim cancel. */
function Sheet(props: {
  readonly title: string;
  readonly onCancel: () => void;
  readonly children: ComponentChildren;
}) {
  const box = useRef<HTMLDivElement>(null);
  useModalFocus(box, props.onCancel);
  return (
    <>
      <div class="mlr-scrim" aria-hidden="true" onClick={props.onCancel} />
      <div
        ref={box}
        class="mlr-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={props.title}
        tabIndex={-1}
      >
        <h3>{props.title}</h3>
        {props.children}
      </div>
    </>
  );
}

function Ask(
  props: RunningProps & {
    readonly go: () => void;
    readonly cancel: () => void;
  },
) {
  const { t } = props;
  const n = props.status?.users ?? 0;
  return (
    <Sheet title={t("run.askTitle")} onCancel={props.cancel}>
      <p>{plural(t, "run.ask", n, { world: props.world.title })}</p>
      <div class="row">
        <button type="button" onClick={props.cancel}>
          {t("run.cancel")}
        </button>
        <button type="button" class="bright mlr-go" onClick={props.go}>
          <Icon name="door-open" />
          {t("run.disconnect")}
        </button>
      </div>
    </Sheet>
  );
}

function Password(props: {
  readonly t: Translate;
  readonly wrong: boolean;
  readonly go: (password: string) => void;
  readonly cancel: () => void;
}) {
  const { t } = props;
  const [pw, setPw] = useState("");
  return (
    <Sheet title={t("run.pwTitle")} onCancel={props.cancel}>
      <form
        class="mlr-form"
        onSubmit={(e) => {
          e.preventDefault();
          props.go(pw);
        }}
      >
        <p>{t("run.pwLead")}</p>
        <input
          type="password"
          autoComplete="off"
          aria-label={t("run.pwTitle")}
          value={pw}
          onInput={(e) => setPw(e.currentTarget.value)}
        />
        {props.wrong ? (
          <p class="err" role="alert">
            {t("run.pwWrong")}
          </p>
        ) : null}
        <div class="row">
          <button type="button" onClick={props.cancel}>
            {t("run.cancel")}
          </button>
          <button type="submit" class="bright mlr-go">
            <Icon name="door-open" />
            {t("run.return")}
          </button>
        </div>
      </form>
    </Sheet>
  );
}

function JoinFields(props: {
  readonly t: Translate;
  readonly users: readonly JoinUser[];
  readonly user: string;
  readonly setUser: (id: string) => void;
  readonly pw: string;
  readonly setPw: (pw: string) => void;
}) {
  const { t } = props;
  return (
    <>
      <label class="mlr-field">
        <span>{t("run.joinAs")}</span>
        <select
          value={props.user}
          onChange={(e) => props.setUser(e.currentTarget.value)}
        >
          {props.users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </label>
      <label class="mlr-field">
        <span>{t("run.joinPassword")}</span>
        <input
          type="password"
          autoComplete="current-password"
          placeholder={t("run.joinPasswordHint")}
          value={props.pw}
          onInput={(e) => props.setPw(e.currentTarget.value)}
        />
      </label>
    </>
  );
}

function JoinSheet(props: RunningProps & { readonly cancel: () => void }) {
  const { t, users } = props;
  const [user, setUser] = useState(
    (users.find((u) => u.gm) ?? users[0])?.id ?? "",
  );
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (e: Event): Promise<void> => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const result = await props.join(user, pw);
    if (result.kind === "joined") return;
    setBusy(false);
    setError(result.kind === "refused" ? result.message : t("run.joinFailed"));
  };
  const n = props.launched ?? 0;
  return (
    <Sheet
      title={t("run.joinTitle", { world: props.world.title })}
      onCancel={props.cancel}
    >
      <form class="mlr-form" onSubmit={(e) => void submit(e)}>
        <JoinFields
          t={t}
          users={users}
          user={user}
          setUser={setUser}
          pw={pw}
          setPw={setPw}
        />
        <p>{n ? plural(t, "run.joinNote", n) : t("run.joinNoteNone")}</p>
        {error ? (
          <p class="err" role="alert">
            {error}
          </p>
        ) : null}
        <button type="submit" class="bright mlr-go" disabled={busy || !user}>
          <Icon name={busy ? "spinner fa-spin-pulse" : "play"} />
          {t("run.joinGo")}
        </button>
      </form>
    </Sheet>
  );
}

/** Return to Setup: ask first with people in, then the password if wanted. */
function useReturn(props: RunningProps) {
  const [step, setStep] = useState<Step>({ kind: "idle" });
  const attempt = async (password?: string): Promise<void> => {
    setStep({ kind: "closing" });
    const result = await props.close(password);
    if (result === "closing") return;
    if (result === "password")
      setStep({ kind: "password", wrong: password !== undefined });
    else setStep({ kind: "failed" });
  };
  const start = (): void => {
    if ((props.status?.users ?? 0) > 0) setStep({ kind: "asking" });
    else void attempt();
  };
  return { step, start, attempt, cancel: () => setStep({ kind: "idle" }) };
}

function JoinButton(props: {
  readonly t: Translate;
  readonly changes: number;
  readonly main: boolean;
  readonly onClick: () => void;
}) {
  const { t, changes } = props;
  return (
    <button
      type="button"
      class={props.main ? "bright mlr-go mlr-join" : "mlr-go mlr-join"}
      onClick={props.onClick}
    >
      <span>
        <Icon name="play" />
        {t("run.join")}
      </span>
      {changes ? (
        <span class="sub">{plural(t, "run.joinApplies", changes)}</span>
      ) : null}
    </button>
  );
}

function ReturnButton(props: {
  readonly t: Translate;
  readonly world: string;
  readonly closing: boolean;
  readonly main: boolean;
  readonly onClick: () => void;
}) {
  const { t, closing } = props;
  return (
    <button
      type="button"
      class={props.main ? "bright mlr-go" : "mlr-go"}
      disabled={closing}
      onClick={props.onClick}
    >
      <Icon name={closing ? "spinner fa-spin-pulse" : "door-open"} />
      {closing ? t("run.closing", { world: props.world }) : t("run.return")}
    </button>
  );
}

/** What Return to Setup does, for the line under the buttons. */
function hint(t: Translate, changes: number, people: number): string {
  if (changes) return t("run.hintLaunched");
  return people ? plural(t, "run.hintPeople", people) : t("run.hint");
}

function Body(
  props: RunningProps & {
    readonly r: ReturnType<typeof useReturn>;
    readonly openJoin: () => void;
  },
) {
  const { t, r } = props;
  const n = props.status?.users ?? 0;
  const changes = props.launched ?? 0;
  const ret = (
    <ReturnButton
      t={t}
      world={props.world.title}
      closing={r.step.kind === "closing"}
      main={!changes}
      onClick={r.start}
    />
  );
  // Only when the world has a Gamemaster to join as (review).
  const join = props.users.some((u) => u.gm) ? (
    <JoinButton
      t={t}
      changes={changes}
      main={changes > 0}
      onClick={props.openJoin}
    />
  ) : null;
  return (
    <div class="mlr-body">
      <p>{changes ? plural(t, "run.leadLaunched", changes) : t("run.lead")}</p>
      {changes ? (
        <>
          {join}
          {ret}
        </>
      ) : (
        <>
          {ret}
          {join}
        </>
      )}
      {r.step.kind === "failed" ? (
        <p class="err" role="alert">
          {t("run.failed")}
        </p>
      ) : null}
      <p class="hint">{hint(t, changes, n)}</p>
    </div>
  );
}

export function RunningScreen(props: RunningProps) {
  const { t, status } = props;
  const r = useReturn(props);
  const [joining, setJoining] = useState(false);
  // Behind an open question the screen can't be reached.
  const asking =
    joining || r.step.kind === "asking" || r.step.kind === "password";
  return (
    <>
      <header class="mlr-top" inert={asking}>
        <a
          class="mlr-back"
          href={props.serversHref}
          aria-label={t("run.servers")}
        >
          <Icon name="chevron-left" />
        </a>
        <span class="logo" aria-hidden="true" />
        <h1>{t("mlp.title")}</h1>
        {status?.version ? (
          <span
            class="mlr-ver"
            title={t("run.version", { version: status.version })}
          >
            {status.version.replace(".", " · ")}
          </span>
        ) : null}
      </header>
      <main class="mlr-scroll" inert={asking}>
        <Hero {...props} />
        <Body {...props} r={r} openJoin={() => setJoining(true)} />
      </main>
      {joining ? (
        <JoinSheet {...props} cancel={() => setJoining(false)} />
      ) : null}
      {r.step.kind === "asking" ? (
        <Ask {...props} go={() => void r.attempt()} cancel={r.cancel} />
      ) : null}
      {r.step.kind === "password" ? (
        <Password
          t={t}
          wrong={r.step.wrong}
          go={(pw) => void r.attempt(pw)}
          cancel={r.cancel}
        />
      ) : null}
    </>
  );
}
