// A module's Library tab inside a running world (design/in-world-library):
// the library shown, not edited, since it is organised on Setup; the
// presets that hold the module, checked when active here; and this world's
// switch.
import type { PackageInfo } from "@stagehand/shared/package";
import { Icon } from "../common/widgets.tsx";
import { useModules } from "../context.ts";
import { presetState } from "../model/presets.ts";
import { worldModules } from "../model/world-modules.ts";
import { WorldItem } from "./WorldItem.tsx";

function Chips(props: { readonly children: preact.ComponentChildren[] }) {
  const { t } = useModules();
  return (
    <div class="chips stl-chips">
      {props.children.length ? (
        props.children
      ) : (
        <span class="st-muted">{t("mp.none")}</span>
      )}
    </div>
  );
}

function Presets(props: {
  readonly id: string;
  readonly on: ReadonlySet<string>;
}) {
  const { t, data } = useModules();
  const installed = new Set(data.setup?.modules.map((m) => m.id));
  const chips = data.library.presets
    .filter((p) => p.modules.includes(props.id))
    .map((p) => {
      const active = presetState(p, installed, props.on).active;
      return (
        <span
          key={p.id}
          class={`stl-tag stl-chip preset${active ? " active" : ""}`}
          title={active ? t("mp.presetActive") : undefined}
        >
          <Icon name={active ? "check" : "layer-group"} />
          {p.name}
        </span>
      );
    });
  return <Chips>{chips}</Chips>;
}

function Facts(props: {
  readonly pkg: PackageInfo;
  readonly on: ReadonlySet<string>;
}) {
  const { t, data } = useModules();
  const meta = data.library.modules[props.pkg.id];
  const folder = data.library.folders.find((f) => f.id === meta?.folderId);
  const tags = data.library.tags.filter((tag) => meta?.tags.includes(tag.id));
  const note = meta?.note.trim();
  return (
    <div class="sts-kv">
      <span>{t("mp.folder")}</span>
      <span class="v">{folder?.name ?? t("folder.none")}</span>
      <span>{t("mp.tags")}</span>
      <Chips>
        {tags.map((tag) => (
          <span key={tag.id} class="stl-tag" style={{ "--st-c": tag.color }}>
            <i class="st-dot" aria-hidden="true" />
            {tag.name}
          </span>
        ))}
      </Chips>
      <span>{t("mp.note")}</span>
      {note ? (
        <span class="v note">{note}</span>
      ) : (
        <span class="v st-muted">{t("mp.none")}</span>
      )}
      <span>{t("mp.presets")}</span>
      <Presets id={props.pkg.id} on={props.on} />
    </div>
  );
}

export function WorldLibraryTab(props: {
  readonly pkg: PackageInfo;
  readonly here: string;
}) {
  const { t, data } = useModules();
  const world = data.setup?.worlds.find((w) => w.id === props.here);
  const model = worldModules(data, props.here);
  const on = new Set(model.next);
  return (
    <div class="stl-libtab">
      <Facts pkg={props.pkg} on={on} />
      {world ? (
        <div class="sts-chg">
          <h4>
            <span>{t("mp.thisWorldHead")}</span>
          </h4>
          <ul class="sts-wlist">
            <WorldItem
              pkg={props.pkg}
              where={{
                world,
                tracked: model.tracked,
                row: model.rows.find((r) => r.pkg.id === props.pkg.id),
              }}
              here={false}
            />
          </ul>
        </div>
      ) : null}
      <p class="st-hint">{t("mp.source")}</p>
    </div>
  );
}
