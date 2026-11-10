// Tags for the selected modules (prototype tagsPop): each tag is on for all,
// some or none of them; a click cycles all, none, then back; Apply sends the
// adds and removes at once.
import type { Tag } from "@stagehand/shared/library/schema";
import { useState } from "preact/hooks";
import { useDisclosure } from "../../../common/disclosure.ts";
import { Icon } from "../../../common/widgets.tsx";
import { useUi } from "../../../context.ts";
import { plural } from "../../../i18n.ts";

type TagState = "all" | "some" | "none";

function stateOf(
  ids: readonly string[],
  has: (id: string) => boolean,
): TagState {
  const n = ids.filter(has).length;
  return n === 0 ? "none" : n === ids.length ? "all" : "some";
}

/** all, none, back to how it was (when that was "some"). */
const cycle = (was: TagState, now: TagState): TagState =>
  now === "all" ? "none" : now === "none" && was === "some" ? "some" : "all";

function TagRow(props: {
  readonly tag: Tag;
  readonly ids: readonly string[];
  readonly staged: TagState | undefined;
  readonly onStage: (st: TagState | null) => void;
}) {
  const { state, t } = useUi();
  const { tag, ids } = props;
  const has = (m: string): boolean =>
    state.data.library.modules[m]?.tags.includes(tag.id) ?? false;
  const was = stateOf(ids, has);
  const st = props.staged ?? was;
  const note =
    was === "all"
      ? t("sel.tagAll", { n: String(ids.length) })
      : was === "some"
        ? t("sel.tagSome", {
            n: String(ids.filter(has).length),
            of: String(ids.length),
          })
        : "";
  return (
    <li class={st === was ? "" : "st-changed"}>
      <label>
        <input
          type="checkbox"
          checked={st === "all"}
          ref={(el) => {
            if (el) el.indeterminate = st === "some";
          }}
          onChange={() => {
            const next = cycle(was, st);
            // Back to how it was: nothing to send (review).
            props.onStage(next === was ? null : next);
          }}
        />
        <i class="st-dot" style={{ "--st-c": tag.color }} aria-hidden="true" />
        <span class="st-name">{tag.name}</span>
        {st === was ? (
          <span class="st-muted">{note}</span>
        ) : (
          <span class={`st-delta ${st === "all" ? "st-plus" : "st-minus"}`}>
            {t(st === "all" ? "sel.add" : "sel.remove")}
          </span>
        )}
      </label>
    </li>
  );
}

function Body(props: {
  readonly ids: readonly string[];
  readonly staged: Readonly<Record<string, TagState>>;
  readonly onStage: (id: string, st: TagState | null) => void;
  readonly onCancel: () => void;
  readonly onApply: () => void;
}) {
  const { state, t } = useUi();
  const title = t("sel.tagsTitle", {
    n: plural(t, "sel.modules", props.ids.length),
  });
  const vals = Object.values(props.staged);
  const add = vals.filter((v) => v === "all").length;
  const remove = vals.filter((v) => v === "none").length;
  return (
    <section class="st-pop st-tagpop" role="region" aria-label={title}>
      <header>
        <strong>{title}</strong>
      </header>
      <ul class="st-checklist">
        {state.data.library.tags.map((tag) => (
          <TagRow
            key={tag.id}
            tag={tag}
            ids={props.ids}
            staged={props.staged[tag.id]}
            onStage={(st) => props.onStage(tag.id, st)}
          />
        ))}
      </ul>
      <footer>
        <span class="st-muted">
          {add || remove
            ? t("sel.pending", { add: String(add), remove: String(remove) })
            : t("sel.cycleHint")}
        </span>
        <button type="button" class="st-small-btn" onClick={props.onCancel}>
          {t("about.cancel")}
        </button>
        <button
          type="button"
          class="st-small-btn bright"
          onClick={props.onApply}
        >
          {t("sel.apply")}
        </button>
      </footer>
    </section>
  );
}

/** The staged tags as one module.setTags: all is add, none is remove. */
function sendStaged(
  actions: ReturnType<typeof useUi>["actions"],
  ids: readonly string[],
  staged: Readonly<Record<string, TagState>>,
): void {
  const keys = Object.keys(staged);
  const add = keys.filter((k) => staged[k] === "all");
  const remove = keys.filter((k) => staged[k] === "none");
  if (add.length || remove.length)
    void actions.op({ op: "module.setTags", moduleIds: [...ids], add, remove });
}

export function TagsPop(props: { readonly ids: readonly string[] }) {
  const { actions, t } = useUi();
  const d = useDisclosure<HTMLSpanElement>();
  const [staged, setStaged] = useState<Readonly<Record<string, TagState>>>({});
  const apply = (): void => {
    sendStaged(actions, props.ids, staged);
    setStaged({});
    d.close(true);
  };
  return (
    <span class="sts-popwrap" ref={d.wrap} onFocusOut={d.onFocusOut}>
      <button
        type="button"
        ref={d.trigger}
        disabled={!props.ids.length}
        aria-expanded={d.open}
        aria-haspopup="true"
        onClick={() => {
          setStaged({});
          d.setOpen(!d.open);
        }}
      >
        <Icon name="tags" />
        {t("sel.tags")}
      </button>
      {d.open ? (
        <Body
          ids={props.ids}
          staged={staged}
          onStage={(id, st) =>
            setStaged((x) =>
              st === null
                ? Object.fromEntries(
                    Object.entries(x).filter(([k]) => k !== id),
                  )
                : { ...x, [id]: st },
            )
          }
          onCancel={() => d.close(true)}
          onApply={apply}
        />
      ) : null}
    </span>
  );
}
