// One module in the new Library, as the prototype's libCard: name with
// Foundry's star, lock and an update to install; one line (not verified,
// note or description); up to three tags, version and how many worlds it is
// on in. In select mode a checkbox picks it for the selection bar.
import type { PackageInfo } from "@module-library/shared/package";
import {
  type CoreVersion,
  isCompatibilityRisk,
  testAvailability,
} from "@module-library/shared/version";
import { Icon } from "../../common/widgets.tsx";
import { useUi } from "../../context.ts";
import { plural } from "../../i18n.ts";
import { unverifiedText } from "../../model/unverified.ts";
import { updateFor } from "../../model/updates.ts";

const MAX_TAGS = 3;

/** As Foundry badges it: a newer build of the verified generation is fine. */
const isRisk = (pkg: PackageInfo, core: CoreVersion): boolean =>
  isCompatibilityRisk(testAvailability(pkg.compatibility, core));

const toggled = (list: readonly string[], id: string): string[] =>
  list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

function Line(props: {
  readonly pkg: PackageInfo;
  readonly core: CoreVersion;
}) {
  const { state, t } = useUi();
  const { pkg } = props;
  if (isRisk(pkg, props.core))
    return (
      <div class="l2 warn">
        <Icon name="code-branch" />
        <span>{unverifiedText(t, props.core.generation)}</span>
      </div>
    );
  const note = state.data.library.modules[pkg.id]?.note.trim();
  if (note)
    return (
      <div class="l2 note">
        <Icon name="note-sticky" />
        <span>{note}</span>
      </div>
    );
  return (
    <div class="l2 desc">
      <span>{pkg.description ?? ""}</span>
    </div>
  );
}

/** Foundry's star and lock, and an update it would install (not when locked). */
function Marks(props: { readonly pkg: PackageInfo }) {
  const { state, page, t, canChange } = useUi();
  const { pkg } = props;
  const update = updateFor(state.updates.module, pkg);
  return (
    <>
      {pkg.favorite ? (
        <i
          class="fa-solid fa-star mlw-fav"
          title={t("lib.favourite")}
          aria-label={t("lib.favourite")}
        />
      ) : null}
      {pkg.locked ? (
        <i
          class="fa-solid fa-lock mlw-lock"
          title={t("lib.locked")}
          aria-label={t("lib.locked")}
        />
      ) : null}
      {update ? (
        <button
          type="button"
          class="mlw-upd"
          disabled={!canChange}
          title={t("lib.updateFrom", { version: pkg.version })}
          aria-label={t("lib.updateTo", { title: pkg.title, version: update })}
          onClick={() =>
            page.foundryAction({
              action: "updatePackage",
              packageType: "module",
              id: pkg.id,
            })
          }
        >
          <Icon name="arrow-up" />
          {update}
        </button>
      ) : null}
    </>
  );
}

function Tags(props: { readonly id: string }) {
  const { state, t } = useUi();
  const { library } = state.data;
  const ids = library.modules[props.id]?.tags ?? [];
  const tags = library.tags.filter((tag) => ids.includes(tag.id));
  const more = tags.slice(MAX_TAGS);
  return (
    <span class="tg">
      {tags.slice(0, MAX_TAGS).map((tag) => (
        <span key={tag.id} class="mll-tag" style={{ "--ml-c": tag.color }}>
          <i class="ml-dot" aria-hidden="true" />
          {tag.name}
        </span>
      ))}
      {more.length ? (
        <span class="mll-tag" title={more.map((m) => m.name).join(", ")}>
          {t("lib.moreTags", { n: more.length })}
        </span>
      ) : null}
    </span>
  );
}

/** The name opens the details; in select mode it is plain text. */
function CardTitle(props: {
  readonly pkg: PackageInfo;
  readonly selecting: boolean;
  readonly open: boolean;
  readonly onOpen: (id: string) => void;
}) {
  const { pkg } = props;
  if (props.selecting) return <span class="t">{pkg.title}</span>;
  return (
    <button
      type="button"
      class="t"
      aria-expanded={props.open}
      onClick={() => props.onOpen(pkg.id)}
    >
      {pkg.title}
    </button>
  );
}

/** "v0.11.0 · on in 3 worlds"; the version in yellow when it is a risk. */
function Meta(props: {
  readonly pkg: PackageInfo;
  readonly core: CoreVersion;
  readonly worlds: number | undefined;
}) {
  const { t } = useUi();
  const n = props.worlds;
  return (
    <span class="meta">
      <span class={isRisk(props.pkg, props.core) ? "uv" : ""}>
        v{props.pkg.version}
      </span>{" "}
      · {n ? plural(t, "lib.inWorlds", n) : t("lib.inNoWorld")}
    </span>
  );
}

export function LibCard(props: {
  readonly pkg: PackageInfo;
  readonly core: CoreVersion;
  readonly worlds: number | undefined;
  readonly selecting: boolean;
  readonly open: boolean;
  readonly onOpen: (id: string) => void;
}) {
  const { state, store, t } = useUi();
  const { pkg } = props;
  const selected = state.selection.includes(pkg.id);
  const toggle = (): void => {
    store.set((s) => ({ selection: toggled(s.selection, pkg.id) }));
  };
  return (
    <li
      class={`mll-card${selected ? " selected" : ""}${props.open ? " viewing" : ""}${isRisk(pkg, props.core) ? " risk" : ""}`}
      data-module={pkg.id}
    >
      <div class="l1">
        {props.selecting ? (
          <input
            type="checkbox"
            checked={selected}
            aria-label={t("lib.selectModule", { module: pkg.title })}
            onChange={toggle}
          />
        ) : null}
        <CardTitle
          pkg={pkg}
          selecting={props.selecting}
          open={props.open}
          onOpen={props.onOpen}
        />
        {state.data.fresh.includes(pkg.id) ? (
          <span class="mls-newtag">{t("lib.new")}</span>
        ) : null}
        <Marks pkg={pkg} />
      </div>
      <Line pkg={pkg} core={props.core} />
      <div class="l3">
        <Tags id={pkg.id} />
        <Meta pkg={pkg} core={props.core} worlds={props.worlds} />
      </div>
    </li>
  );
}
