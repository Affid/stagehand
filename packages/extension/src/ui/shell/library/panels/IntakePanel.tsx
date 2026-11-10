// New modules since the Library was last sorted, as the prototype's panel:
// each with its folder, tags and worlds, a suggestion from its family, and
// Done; Later closes, Done with all marks every one sorted.
import type { PackageInfo } from "@stagehand/shared/package";
import { Icon } from "../../../common/widgets.tsx";
import { useUi } from "../../../context.ts";
import { plural } from "../../../i18n.ts";
import { IntakeWorlds, useWorldsOn } from "./IntakeWorlds.tsx";
import { PanelFrame } from "./PanelFrame.tsx";
import { type Suggestion, suggestFor } from "./suggest.ts";

function Folder(props: { readonly pkg: PackageInfo; readonly s?: Suggestion }) {
  const { state, actions, t, canChange } = useUi();
  const { library } = state.data;
  const current = library.modules[props.pkg.id]?.folderId ?? "";
  return (
    <select
      aria-label={t("mp.folder")}
      value={current}
      disabled={!canChange}
      onChange={(e) => {
        const v = e.currentTarget.value;
        void actions.op({
          op: "module.setFolder",
          moduleIds: [props.pkg.id],
          folderId: v === "" ? null : v,
        });
      }}
    >
      <option value="">{t("folder.none")}</option>
      {library.folders.map((f) => (
        <option key={f.id} value={f.id}>
          {f.name}
          {props.s?.folderId === f.id ? ` ${t("intake.suggested")}` : ""}
        </option>
      ))}
    </select>
  );
}

function Tags(props: { readonly pkg: PackageInfo; readonly s?: Suggestion }) {
  const { state, actions, canChange } = useUi();
  const { library } = state.data;
  const mine = library.modules[props.pkg.id]?.tags ?? [];
  return (
    <div class="chips">
      {library.tags.map((tag) => {
        const on = mine.includes(tag.id);
        const sug = !on && (props.s?.tags.includes(tag.id) ?? false);
        return (
          <button
            type="button"
            key={tag.id}
            class={`st-chip sts-tchip${on ? " on" : ""}${sug ? " sug" : ""}`}
            aria-pressed={on}
            disabled={!canChange}
            onClick={() =>
              void actions.op({
                op: "module.setTags",
                moduleIds: [props.pkg.id],
                add: on ? [] : [tag.id],
                remove: on ? [tag.id] : [],
              })
            }
          >
            <i
              class="st-dot"
              style={{ "--st-c": tag.color }}
              aria-hidden="true"
            />
            {tag.name}
          </button>
        );
      })}
    </div>
  );
}

/** "Same family as X. X is on in 2 worlds." and Use suggestions. */
function Hint(props: { readonly pkg: PackageInfo; readonly s: Suggestion }) {
  const { actions, t, canChange } = useUi();
  const { s, pkg } = props;
  const near = useWorldsOn(s.from.id).filter((w) => w.on);
  const use = (): void => {
    if (s.folderId)
      void actions.op({
        op: "module.setFolder",
        moduleIds: [pkg.id],
        folderId: s.folderId,
      });
    if (s.tags.length)
      void actions.op({
        op: "module.setTags",
        moduleIds: [pkg.id],
        add: [...s.tags],
        remove: [],
      });
    for (const w of near) void actions.flip(w.id, pkg.id, true);
  };
  return (
    <div class="sts-sug">
      <Icon name="lightbulb" />
      <span>
        {t(`intake.why.${s.why}`, { title: s.from.title })}{" "}
        {plural(t, "intake.onIn", near.length, { title: s.from.title })}
      </span>
      {canChange ? (
        <button type="button" class="st-link" onClick={use}>
          {t("intake.use")}
        </button>
      ) : null}
    </div>
  );
}

function Item(props: { readonly pkg: PackageInfo; readonly s?: Suggestion }) {
  const { store, actions, t, canChange } = useUi();
  const { pkg, s } = props;
  const near = useWorldsOn(s?.from.id ?? "").filter((w) => w.on);
  const author = pkg.authors.map((a) => a.name).join(", ");
  return (
    <div class="sts-intake-item" data-module={pkg.id}>
      <div class="hd">
        <strong>{pkg.title}</strong>
        <span class="st-muted">
          {author ? `${author} · ` : ""}v{pkg.version}
        </span>
      </div>
      {s ? <Hint pkg={pkg} s={s} /> : null}
      <div class="sts-kv">
        <span>{t("mp.folder")}</span>
        <Folder pkg={pkg} {...(s ? { s } : {})} />
        <span>{t("mp.tags")}</span>
        <Tags pkg={pkg} {...(s ? { s } : {})} />
        <span>{t("intake.turnOn")}</span>
        <IntakeWorlds pkg={pkg} suggested={new Set(near.map((w) => w.id))} />
      </div>
      <div class="acts">
        <button
          type="button"
          class="st-link"
          onClick={() => store.set({ panel: pkg.id, side: null })}
        >
          {t("intake.details")}
        </button>
        {canChange ? (
          <button
            type="button"
            aria-label={t("intake.doneWith", { module: pkg.title })}
            onClick={() => void actions.markSorted([pkg.id])}
          >
            <Icon name="check" />
            {t("intake.done")}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function IntakePanel() {
  const { state, store, actions, t, canChange } = useUi();
  const fresh = new Set(state.data.fresh);
  const all = state.data.setup?.modules ?? [];
  const items = all.filter((m) => fresh.has(m.id));
  const footer = (
    <>
      <button type="button" onClick={() => store.set({ side: null })}>
        {t("intake.later")}
      </button>
      <button
        type="button"
        class="bright"
        disabled={!canChange || !items.length}
        onClick={() => {
          store.set({ side: null });
          void actions.markSorted([...fresh]);
        }}
      >
        <Icon name="check-double" />
        {t("intake.all")}
      </button>
    </>
  );
  return (
    <PanelFrame
      title={t("intake.titleN", { n: String(items.length) })}
      label={t("intake.title")}
      footer={footer}
    >
      <p class="lead">{t(items.length ? "intake.lead" : "intake.allSorted")}</p>
      {items.map((m) => {
        const s = suggestFor(m, all, state.data.library, fresh);
        return <Item key={m.id} pkg={m} {...(s ? { s } : {})} />;
      })}
    </PanelFrame>
  );
}
