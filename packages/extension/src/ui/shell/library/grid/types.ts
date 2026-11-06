// What the By world grid's pieces share: each shown world's rows, looked up
// by module id once per render.
import type {
  WorldModuleRow,
  WorldModules,
} from "../../../model/world-modules.ts";

export interface WorldRows {
  readonly model: WorldModules;
  readonly byId: ReadonlyMap<string, WorldModuleRow>;
}

export type Models = ReadonlyMap<string, WorldRows>;

/** Folded groups: shared with the Modules tab's group headers. */
export interface Folding {
  readonly closed: ReadonlySet<string>;
  readonly onToggle: (key: string) => void;
}
