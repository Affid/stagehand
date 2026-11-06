// The world page's modules, in groups (View options). The filter, All / On /
// Changes, Add and View options sit in the tab row (ModulesTools). A switch
// queues a change for the next launch; a live region says what it did.
import type { WorldInfo } from "@module-library/shared/world";
import { useRef, useState } from "preact/hooks";
import { useUi } from "../../context.ts";
import type {
  WorldModuleRow,
  WorldModules,
} from "../../model/world-modules.ts";
import { ModuleSections } from "./ModuleSections.tsx";
import type { Filters, Show } from "./ModulesTools.tsx";
import { useWhy } from "./useWhy.ts";

const keep = (show: Show, text: string) => (r: WorldModuleRow) => {
  if (show === "on" && !r.next) return false;
  if (show === "changes" && !r.delta) return false;
  const q = text.trim().toLowerCase();
  return (
    !q ||
    r.pkg.title.toLowerCase().includes(q) ||
    r.pkg.id.toLowerCase().includes(q)
  );
};

/** The filter state, kept by the world page so the tab row can show it. */
export function useFilters(): Filters {
  const [show, setShow] = useState<Show>("all");
  const [text, setText] = useState("");
  return { show, text, onShow: setShow, onText: setText };
}

export function ModulesTab(props: {
  readonly world: WorldInfo;
  readonly model: WorldModules;
  readonly filters: Filters;
}) {
  const { actions, t } = useUi();
  const { show, text } = props.filters;
  const [said, setSaid] = useState("");
  const why = useWhy();
  // The switch shows the stored state, so a second press before the save
  // lands would repeat the first: ignore it until then.
  const saving = useRef(new Set<string>());
  const onFlip = (id: string, on: boolean): void => {
    if (saving.current.has(id)) return;
    saving.current.add(id);
    setSaid(t(`wp.announce.${on ? "on" : "off"}`, { module: why.name(id) }));
    void actions.flip(props.world.id, id, on).finally(() => {
      saving.current.delete(id);
    });
  };
  const rows = props.model.rows.filter(keep(show, text));
  return (
    <div class="mlw-modules">
      {rows.length ? (
        <ModuleSections
          rows={rows}
          all={props.model.rows}
          world={props.world}
          why={why}
          onFlip={onFlip}
        />
      ) : (
        <p class="ml-empty">{t(`wp.empty.${show}`)}</p>
      )}
      <p class="ml-sr-only" aria-live="polite">
        {said}
      </p>
    </div>
  );
}
