// The running page's apply flow (apply-flow.ts) as a hook: it starts as the
// page opens after a launch with changes, asks for the Gamemaster's password
// on the user's tap when Foundry wants one (again at once when it was
// wrong: native allows one retry after a typed answer), and Not now leaves
// the changes queued.
import { useEffect, useRef, useState } from "preact/hooks";
import type { PasswordQuestion } from "../platform.ts";
import {
  type ApplyFlowDeps,
  type ApplyView,
  applyAtStart,
  failApply,
  joinAndHandOver,
  NOT_NOW,
} from "./apply-flow.ts";

export interface ApplyHook {
  readonly view: ApplyView | undefined;
  /** The Gamemaster's password, in native's sheet (a tap). */
  readonly password: () => void;
  readonly notNow: () => void;
}

export function useApply(
  flow: ApplyFlowDeps | undefined,
  ask: ((q: PasswordQuestion) => Promise<string | undefined>) | undefined,
  people: number,
): ApplyHook {
  const [view, setView] = useState<ApplyView | undefined>(() =>
    flow ? applyAtStart(flow) : undefined,
  );
  const started = useRef(false);
  useEffect(() => {
    if (!flow || view?.kind !== "start" || started.current) return;
    started.current = true;
    setView({ kind: "applying", n: view.n });
    void joinAndHandOver(flow, view.n, "").then(setView);
  }, [flow, view]);
  const askLoop = async (v: Extract<ApplyView, { kind: "password" }>) => {
    if (!flow || !ask) return;
    let current = v;
    for (;;) {
      let typed: string | undefined;
      try {
        typed = await ask({
          purpose: "join",
          world: flow.world.title,
          user: current.user,
          people,
          wrong: current.wrong,
        });
      } catch {
        return;
      }
      if (typed === undefined) return;
      setView({ kind: "applying", n: current.n });
      const next = await joinAndHandOver(flow, current.n, typed);
      setView(next);
      if (next.kind !== "password") return;
      current = next;
    }
  };
  return {
    view,
    password: () => {
      if (view?.kind === "password") void askLoop(view);
    },
    notNow: () => {
      if (flow && view) setView(failApply(flow, view.n, NOT_NOW));
    },
  };
}
