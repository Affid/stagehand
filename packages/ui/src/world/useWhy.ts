// What the "why" lines need from the UI: translations, module names and
// the running core version.
import { useModules } from "../context.ts";
import type { WhyContext } from "./why.ts";

export function useWhy(): WhyContext {
  const { t, data } = useModules();
  const modules = data.setup?.modules ?? [];
  return {
    t,
    name: (id) => modules.find((m) => m.id === id)?.title ?? id,
    coreGeneration: data.setup?.core.generation,
  };
}
