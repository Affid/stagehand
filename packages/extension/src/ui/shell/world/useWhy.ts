// What the "why" lines need from the UI: translations, module names and
// the running core version.
import { useUi } from "../../context.ts";
import type { WhyContext } from "./why.ts";

export function useWhy(): WhyContext {
  const { state, t } = useUi();
  const modules = state.data.setup?.modules ?? [];
  return {
    t,
    name: (id) => modules.find((m) => m.id === id)?.title ?? id,
    coreGeneration: String(state.data.setup?.core.generation ?? ""),
  };
}
