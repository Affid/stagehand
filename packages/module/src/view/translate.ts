// The view's words inside a world: Setup's, except where Setup talks about
// a world's next launch. Inside a world, changes wait for Save instead.
import { createTranslator, type Translate } from "@stagehand/ui/i18n.ts";

const WORLD_WORDING: Readonly<Record<string, string>> = {
  "wp.empty.changes": "mm.empty.changes",
  "wp.announce.on": "mm.announce.on",
  "wp.announce.off": "mm.announce.off",
  "mp.delta.on": "mm.delta.on",
  "mp.delta.off": "mm.delta.off",
};

export function worldTranslator(lang: string): Translate {
  const t = createTranslator(lang);
  return (key, params) => t(WORLD_WORDING[key] ?? key, params);
}
