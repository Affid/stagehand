// What the modules view and the module panel need from the page that shows
// them: Setup's world page and Library, or Module Management inside a world.
import type { ApplyMode } from "@stagehand/shared/resolver";
import type { LibraryOp } from "@stagehand/shared/library/ops";
import type { PackageInfo } from "@stagehand/shared/package";
import { type ComponentType, createContext } from "preact";
import { useContext } from "preact/hooks";
import type { Translate } from "./i18n.ts";
import type { ModulesData } from "./model/data.ts";
import type { GroupBy } from "./model/library-groups.ts";

export interface WorldView {
  readonly by: GroupBy;
  readonly layout: "cards" | "list";
}

export type PackageKind = "module" | "system";

export interface ModulesUi {
  readonly t: Translate;
  readonly data: ModulesData;
  /**
   * "setup": Setup, which sees every world and organises the library.
   * "world": inside a running world, which knows only itself; the library
   * is shown, and organised on Setup.
   */
  readonly where: "setup" | "world";
  /** Turn modules on and off (and every "Turn all"). */
  readonly canSwitch: boolean;
  /** Change a module's folder, tags and note. */
  readonly canOrganise: boolean;
  readonly view: WorldView;
  /** The module whose details are open, if any. */
  readonly panel: string | null;
  readonly openPanel: (moduleId: string | null) => void;
  /** Folded sections, when the page keeps them (else the view does). */
  readonly folded?: ReadonlySet<string>;
  readonly onFold?: (key: string) => void;
  readonly flip: (
    worldId: string,
    moduleId: string,
    on: boolean,
  ) => Promise<unknown>;
  readonly queueApply: (
    worldId: string,
    mode: ApplyMode,
    presetIds: readonly string[],
    modules?: readonly string[],
  ) => Promise<unknown>;
  readonly organise: (op: LibraryOp) => Promise<unknown>;
  /** The page's own actions for a package (Setup: Foundry's), if any. */
  readonly PackageActions?: ComponentType<{
    readonly pkg: PackageInfo;
    readonly kind: PackageKind;
  }>;
}

export const ModulesContext = createContext<ModulesUi | null>(null);

export function useModules(): ModulesUi {
  const ui = useContext(ModulesContext);
  if (!ui) throw new Error("Stagehand modules view used outside its provider");
  return ui;
}
