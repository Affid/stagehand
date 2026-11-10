// The running Foundry's differences from 14, for components
// (compat/quirks.ts): by the core generation Setup reported.
import { type Quirks, quirksFor } from "../compat/quirks.ts";
import { useUi } from "./context.ts";

export function useQuirks(): Quirks {
  const { state } = useUi();
  return quirksFor(state.data.setup?.core.generation);
}
