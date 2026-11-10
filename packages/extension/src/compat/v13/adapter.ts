// Foundry 13's adapter (docs/FOUNDRY-13-PLAN.md): Setup's markup is the
// same as 14's, so are the requests behind these flags, except
// certificates, which 13 can't create or release from Setup. Checked in
// 13.351's code. Imported only by the bundled config.
import type { Adapter } from "../../adapters/config.ts";
import { V14_SELECTORS } from "../../adapters/selectors.ts";

export const V13_ADAPTER: Adapter = {
  id: "v13",
  generation: 13,
  minBuild: 0,
  maxBuild: 351,
  selectors: V14_SELECTORS,
  flags: {
    editWorld: true,
    lockPackage: true,
    diskFree: true,
    updateCheck: true,
    certificates: false,
  },
};
