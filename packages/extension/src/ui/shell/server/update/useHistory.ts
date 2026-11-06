// Release history's state: Foundry's public list once the tab opens, each
// release's notes when it is picked (kept for the visit), and whether the
// browser may read foundryvtt.com at all.
import { useEffect, useState } from "preact/hooks";
import { useUi } from "../../../context.ts";
import type { ReleasesAnswer } from "../../../actions.ts";
import {
  parseReleaseList,
  type ReleaseItem,
  releaseNotesOf,
} from "./releases.ts";

export type ListState =
  | { readonly kind: "loading" }
  | { readonly kind: "denied" }
  | { readonly kind: "error"; readonly error: string }
  | { readonly kind: "ready"; readonly releases: readonly ReleaseItem[] };

export type NotesState =
  | { readonly kind: "loading" }
  | { readonly kind: "error"; readonly error: string }
  | { readonly kind: "ready"; readonly html: string };

function stateOf<T>(
  a: ReleasesAnswer,
  read: (html: string) => T,
):
  | { kind: "denied" }
  | { kind: "error"; error: string }
  | { kind: "ok"; value: T } {
  if ("error" in a) return { kind: "error", error: a.error };
  if (!a.permitted) return { kind: "denied" };
  return { kind: "ok", value: read(a.html) };
}

export function useHistory() {
  const { actions } = useUi();
  const [list, setList] = useState<ListState>({ kind: "loading" });
  const [notes, setNotes] = useState<ReadonlyMap<string, NotesState>>(
    new Map(),
  );
  const load = (): void => {
    setList({ kind: "loading" });
    void actions.releases().then((a) => {
      const s = stateOf(a, parseReleaseList);
      setList(s.kind === "ok" ? { kind: "ready", releases: s.value } : s);
    });
  };
  useEffect(load, []);
  const setOne = (version: string, s: NotesState): void => {
    setNotes((m) => new Map([...m, [version, s]]));
  };
  const read = (version: string): void => {
    if (notes.has(version)) return;
    setOne(version, { kind: "loading" });
    void actions.releases(version).then((a) => {
      const s = stateOf(a, releaseNotesOf);
      setOne(
        version,
        s.kind === "ok"
          ? { kind: "ready", html: s.value }
          : { kind: "error", error: s.kind === "error" ? s.error : "" },
      );
    });
  };
  return { list, notes, load, read, ask: () => actions.askFoundryvtt() };
}

export type History = ReturnType<typeof useHistory>;
