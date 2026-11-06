// Every installed module as a box to tick, under its folder (then Unfiled),
// for a tag's or a preset's modules (prototype moduleChecks).
import { useUi } from "../../../context.ts";
import { orderedFolders } from "../../../model/modules.ts";

export function ModuleChecks(props: {
  readonly isOn: (id: string) => boolean;
  readonly onToggle: (id: string, on: boolean) => void;
}) {
  const { state, t, canChange } = useUi();
  const { library } = state.data;
  const modules = [...(state.data.setup?.modules ?? [])].sort((a, b) =>
    a.title.localeCompare(b.title),
  );
  const folderOf = (id: string): string | null =>
    library.modules[id]?.folderId ?? null;
  const known = new Set(library.folders.map((f) => f.id));
  const groups = [
    ...orderedFolders(library).map((f) => ({
      key: f.id,
      name: f.name,
      list: modules.filter((m) => folderOf(m.id) === f.id),
    })),
    {
      key: "",
      name: t("folder.none"),
      list: modules.filter((m) => {
        const f = folderOf(m.id);
        return f === null || !known.has(f);
      }),
    },
  ].filter((g) => g.list.length > 0);
  return (
    <ul class="mls-mods">
      {groups.flatMap((g) => [
        <li key={`g:${g.key}`} class="grp">
          {g.name}
        </li>,
        ...g.list.map((m) => (
          <li key={m.id}>
            <label>
              <input
                type="checkbox"
                checked={props.isOn(m.id)}
                disabled={!canChange}
                onChange={(e) => props.onToggle(m.id, e.currentTarget.checked)}
              />
              {m.title}
            </label>
          </li>
        )),
      ])}
    </ul>
  );
}
