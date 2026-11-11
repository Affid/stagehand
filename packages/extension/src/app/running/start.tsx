// Starts the app's screen for a running world on the server's /join page
// (Android plan, phases 3 and 7): always, after a launch from our Setup too
// (owner, 2026-11-09); the app never opens the game. Foundry's page
// waits behind a veil until the world's data is there (or gives up and
// shows Foundry's page).
import { logError } from "@stagehand/shared/log";
import { render } from "preact";
import { useEffect, useState } from "preact/hooks";
import type { PageGlobals } from "../../page/globals.ts";
import { showReconnecting } from "../reconnecting.ts";
import { hideResolutionNotice } from "../../page/resolution.ts";
import { isServerPage } from "../native-api.ts";
import { createTranslator } from "../../ui/i18n.ts";
import { type ApplyFlowDeps } from "./apply-flow.ts";
import { useApply } from "./useApply.ts";
import type { PasswordQuestion } from "../platform.ts";
import { RunningScreen } from "./RunningScreen.tsx";
import {
  closeWorld,
  fetchStatus,
  joinGame,
  joinWorld,
  type RunningWorld,
  type ServerDeps,
  type Status,
} from "./server.ts";

const HOST = "st-run-root";
const WAIT_CLASS = "st-run-wait";
const STYLE_ID = "st-run-style";
const POLL_MS = 100;
const MAX_POLLS = 300;
/** While waiting for Foundry's data, the status is asked every this many polls. */
const STATUS_EVERY = 10;
/** How often the screen asks Foundry for the world's status. */
export const STATUS_MS = 5000;
/** How often, once closing, it checks whether the world has closed. */
export const CLOSING_MS = 1000;

/** On the server's /join: always ours in the app. */
export function showsRunning(href: string, server: string): boolean {
  return isServerPage(href, server, "/join");
}

export interface RunningDeps {
  readonly win: Window;
  readonly doc: Document;
  readonly css: string;
  /** Foundry's `game`, read when needed (it arrives after document start). */
  readonly game: () => unknown;
  readonly server: ServerDeps;
  /** The app's server list (native opens it on a tap). */
  readonly serversHref: string;
  /** Where our Setup left its launch note (sessionStorage). */
  readonly notes?: Storage;
  /** The app's native password sheet (password.ask), when the page has the bridge. */
  readonly askPassword?: (q: PasswordQuestion) => Promise<string | undefined>;
  /** Whether native has this world's launch on record (apply.allowed). */
  readonly applyAllowed?: (world: string) => Promise<boolean>;
  /** Native covers the WebView and lets /game load to apply the changes (apply.start). */
  readonly startApply?: (
    world: string,
    title: string,
    changes: number,
  ) => Promise<void>;
}

/** The apply flow's needs from these deps; none without a launch note or native. */
function flowOf(
  deps: RunningDeps,
  world: RunningWorld,
): ApplyFlowDeps | undefined {
  const { notes, startApply, applyAllowed } = deps;
  if (!notes || !startApply || !applyAllowed) return undefined;
  return {
    store: notes,
    world,
    game: deps.game,
    join: (userId, password) => joinGame(deps.server, userId, password),
    allowed: applyAllowed,
    start: startApply,
    go: (path) => {
      deps.win.location.assign(path);
    },
  };
}

/** Foundry confirmed the close; Setup is opened anyway after this long. */
export const CLOSE_GIVE_UP_MS = 30_000;

/** Polls Foundry's status; goes to Setup once (the world closed, or timed out). */
function useStatus(deps: RunningDeps, closing: boolean): Status | undefined {
  const [status, setStatus] = useState<Status | undefined>(undefined);
  useEffect(() => {
    let live = true;
    let busy = false;
    let gone = false;
    const toSetup = (): void => {
      if (gone) return;
      gone = true;
      deps.win.location.assign(deps.server.route("setup"));
    };
    const check = async (): Promise<void> => {
      if (busy) return;
      busy = true;
      const s = await fetchStatus(deps.server);
      busy = false;
      if (!live || !s) return;
      setStatus(s);
      // The world closed (here or elsewhere): Setup is back.
      if (!s.active) toSetup();
    };
    void check();
    const timer = deps.win.setInterval(
      () => void check(),
      closing ? CLOSING_MS : STATUS_MS,
    );
    const giveUp = closing
      ? deps.win.setTimeout(toSetup, CLOSE_GIVE_UP_MS)
      : undefined;
    return () => {
      live = false;
      deps.win.clearInterval(timer);
      if (giveUp !== undefined) deps.win.clearTimeout(giveUp);
    };
  }, [deps, closing]);
  return status;
}

function Root(props: {
  readonly deps: RunningDeps;
  readonly world: RunningWorld;
}) {
  const { deps } = props;
  const [closing, setClosing] = useState(false);
  const status = useStatus(deps, closing);
  const ask = deps.askPassword;
  const [flow] = useState(() => flowOf(deps, props.world));
  const apply = useApply(flow, ask, status?.users ?? 0);
  return (
    <RunningScreen
      t={createTranslator("en")}
      world={props.world}
      status={status}
      origin={deps.win.location.origin}
      close={async (password) => {
        const result = await closeWorld(deps.server, password);
        if (result === "closing") setClosing(true);
        return result;
      }}
      apply={apply.view}
      onApplyPassword={apply.password}
      onApplyNotNow={apply.notNow}
      serversHref={deps.serversHref}
      {...(ask
        ? {
            askPassword: (wrong: boolean) =>
              ask({
                purpose: "close",
                world: props.world.title,
                people: status?.users ?? 0,
                wrong,
              }),
          }
        : {})}
    />
  );
}

function veil(doc: Document, css: string): void {
  doc.documentElement.classList.add(WAIT_CLASS);
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement("style");
  style.id = STYLE_ID;
  style.textContent = css;
  // At document start the head may not be there yet.
  (doc.querySelector("head") ?? doc.documentElement).append(style);
}

function mount(deps: RunningDeps, world: RunningWorld): void {
  // Foundry's "window smaller than 1024×768" notice: this screen is made
  // for the small window, as the phone layout is (page/resolution.ts).
  hideResolutionNotice(deps.win as PageGlobals, deps.doc);
  // Nor its talk about its connection: our small sign instead.
  showReconnecting({
    page: deps.win as PageGlobals,
    doc: deps.doc,
    win: deps.win,
    label: createTranslator("en")("app.reconnecting"),
  });
  const host = deps.doc.createElement("div");
  host.id = HOST;
  deps.doc.body.append(host);
  // Foundry's join page stays under it, out of reach (review).
  for (const el of deps.doc.body.children)
    if (el !== host) (el as HTMLElement).inert = true;
  render(<Root deps={deps} world={world} />, host);
}

/** Shows the screen; anything going wrong gives Foundry's page back. */
function show(deps: RunningDeps, world: RunningWorld): void {
  try {
    mount(deps, world);
  } catch (error: unknown) {
    deps.doc.getElementById(HOST)?.remove();
    for (const el of deps.doc.body.children) (el as HTMLElement).inert = false;
    logError("running world screen", error);
  } finally {
    deps.doc.documentElement.classList.remove(WAIT_CLASS);
  }
}

/**
 * While the data hasn't come: a world that closed meanwhile (Foundry's
 * /join then never gets its data and stays blank) sends the app to Setup.
 */
interface Waiting {
  /** The screen shown, or Setup on its way: nothing more to do. */
  done: boolean;
  /** A status question out: one at a time (review). */
  asking: boolean;
}

function setupIfClosed(deps: RunningDeps, w: Waiting): void {
  if (w.asking) return;
  w.asking = true;
  void fetchStatus(deps.server).then((s) => {
    w.asking = false;
    if (!s || s.active || w.done) return;
    // Once: the polling stops here (review).
    w.done = true;
    deps.win.location.assign(deps.server.route("setup"));
  });
}

/** Waits for Foundry's join data, then shows the screen (or lifts the veil). */
export function startRunning(deps: RunningDeps): void {
  veil(deps.doc, deps.css);
  let polls = 0;
  const w: Waiting = { done: false, asking: false };
  const tick = (): void => {
    if (w.done) return;
    const world = joinWorld(deps.game());
    if (world && deps.doc.querySelector("body")) {
      w.done = true;
      show(deps, world);
      return;
    }
    if (polls % STATUS_EVERY === STATUS_EVERY - 1) setupIfClosed(deps, w);
    polls += 1;
    if (polls >= MAX_POLLS)
      deps.doc.documentElement.classList.remove(WAIT_CLASS);
    else deps.win.setTimeout(tick, POLL_MS);
  };
  tick();
}
