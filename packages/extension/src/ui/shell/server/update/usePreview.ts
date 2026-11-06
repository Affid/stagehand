// Foundry's compatibility preview for the release on show: asked once per
// release (it takes Foundry a few seconds), shared by the Update page's
// summary box and its Your packages tab.
import { useEffect, useState } from "preact/hooks";
import type { Preview } from "../../../../page-compat.ts";
import type { Release } from "../../../../page-update.ts";
import { useUi } from "../../../context.ts";

export type PreviewState =
  | { readonly kind: "loading" }
  | { readonly kind: "ready"; readonly preview: Preview }
  | { readonly kind: "error"; readonly error: string };

export function usePreview(
  release: Release | undefined,
  channel: string | null,
): PreviewState {
  const { page } = useUi();
  const [state, setState] = useState<PreviewState>({ kind: "loading" });
  const version = release?.version;
  useEffect(() => {
    if (!version || !channel) return undefined;
    let live = true;
    setState({ kind: "loading" });
    void page
      .update({ op: "preview", channel, force: false, version })
      .then((r) => {
        if (!live) return;
        setState(
          r.preview
            ? { kind: "ready", preview: r.preview }
            : { kind: "error", error: r.error ?? "" },
        );
      });
    return () => {
      live = false;
    };
  }, [version, channel]);
  return state;
}
