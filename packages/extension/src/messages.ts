// Messages from the extension's own pages and content scripts to its
// background. The background checks each sender before acting.
import type { Envelope } from "@module-library/shared/protocol";
import type { ApplyMode } from "@module-library/shared/resolver";

/** What the Setup page's main-world script reads from `game`. */
export interface SetupData {
  readonly coreVersion: string;
  readonly generation: number;
  readonly isAdmin: boolean;
  readonly modules: readonly SetupModule[];
  readonly worlds: readonly SetupWorld[];
}

export interface SetupModule {
  readonly id: string;
  readonly title: string;
  readonly version: string;
  readonly authors: readonly string[];
  readonly library: boolean;
  readonly requires: readonly string[];
  readonly conflicts: readonly string[];
  readonly verified: string;
}

export interface SetupWorld {
  readonly id: string;
  readonly title: string;
  readonly system: string;
  readonly coreVersion: string;
}

export type ExtensionMessage =
  | { readonly kind: "register-server"; readonly server: string }
  | { readonly kind: "setup-seen"; readonly data: SetupData }
  | {
      readonly kind: "queue-command";
      readonly worldId: string;
      readonly mode: ApplyMode;
      readonly modules: readonly string[];
    }
  | { readonly kind: "bridge-init" }
  | { readonly kind: "relay"; readonly msg: Envelope };
