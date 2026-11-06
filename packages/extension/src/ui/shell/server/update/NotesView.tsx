// "What's new", as the prototype's notes reader (_update.js updNotes):
// Foundry's release notes with a search, a developer notes switch, jump
// links with counts, sections that fold (Breaking Changes, New Features and
// Bug Fixes open), and each entry's issue number as a link to GitHub.
import { useMemo, useState } from "preact/hooks";
import type { Release } from "../../../../page-update.ts";
import { Icon } from "../../../common/widgets.tsx";
import { cleanChildren } from "../../../common/rich-text.tsx";
import { useUi } from "../../../context.ts";
import { plural } from "../../../i18n.ts";
import {
  type NoteArea,
  type NoteEntry,
  type NoteSection,
  type Notes,
  parseNotes,
} from "./notes.ts";

const OPEN_FIRST = ["Breaking Changes", "New Features", "Bug Fixes"];

/** The words a jump link uses, by Foundry's section heading. */
const JUMP_KEYS: Readonly<Record<string, string>> = {
  "Breaking Changes": "up.j.breaking",
  "New Features": "up.j.features",
  "API Improvements": "up.j.api",
  "Bug Fixes": "up.j.bugs",
  "Documentation Improvements": "up.j.docs",
};

export interface Filter {
  readonly q: string;
  readonly dev: boolean;
}

const isDev = (s: NoteSection, a?: NoteArea): boolean =>
  s.kind === "dev" || a?.dev === true;

export function shownItems(
  f: Filter,
  s: NoteSection,
  a?: NoteArea,
): readonly NoteEntry[] {
  if (!f.dev && isDev(s, a)) return [];
  const q = f.q.trim().toLowerCase();
  return (a ?? s).items.filter(
    (i) =>
      !q ||
      i.text.toLowerCase().includes(q) ||
      String(i.issue ?? "").includes(q),
  );
}

export const shownCount = (f: Filter, s: NoteSection): number =>
  shownItems(f, s).length +
  s.areas.reduce((n, a) => n + shownItems(f, s, a).length, 0);

const anchor = (h: string): string => `mlu-${h.replace(/\W+/g, "-")}`;

const ISSUES = "https://github.com/foundryvtt/foundryvtt/issues/";

function Items(props: { readonly items: readonly NoteEntry[] }) {
  const { t } = useUi();
  return (
    <ul>
      {props.items.map((i, n) => (
        <li key={n}>
          {cleanChildren(i.node)}
          {i.issue ? (
            <>
              {" "}
              <a
                class="mlu-issue"
                href={`${ISSUES}${String(i.issue)}`}
                target="_blank"
                rel="noopener noreferrer"
                title={t("up.issue", { n: i.issue })}
              >
                #{i.issue}
              </a>
            </>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function Intro(props: { readonly blocks: readonly Element[] }) {
  return (
    <>
      {props.blocks.map((b, n) => (
        <div class="mlu-p" key={n}>
          {cleanChildren(b)}
        </div>
      ))}
    </>
  );
}

function DevPill() {
  const { t } = useUi();
  return <span class="mlw-pill">{t("up.developers")}</span>;
}

function Body(props: {
  readonly s: NoteSection;
  readonly f: Filter;
  readonly searching: boolean;
}) {
  const { s, f, searching } = props;
  return (
    <>
      {searching ? null : <Intro blocks={s.intro} />}
      {s.items.length ? <Items items={shownItems(f, s)} /> : null}
      {s.areas.map((a) => {
        const items = shownItems(f, s, a);
        if (!items.length) return null;
        return (
          <div key={a.h}>
            <h4>
              {a.h} {a.dev && s.kind !== "dev" ? <DevPill /> : null}
            </h4>
            {searching ? null : <Intro blocks={a.intro} />}
            <Items items={items} />
          </div>
        );
      })}
    </>
  );
}

function Section(props: {
  readonly s: NoteSection;
  readonly f: Filter;
  readonly open: boolean;
  readonly onToggle: () => void;
}) {
  const { s, f } = props;
  const n = shownCount(f, s);
  if (!n) return null;
  const searching = f.q.trim() !== "";
  const open = props.open || searching;
  return (
    <section class={`mlu-sec ${s.kind}`} id={anchor(s.h)}>
      <h3>
        <button type="button" aria-expanded={open} onClick={props.onToggle}>
          <Icon name={open ? "chevron-down" : "chevron-right"} />
          {s.kind === "breaking" ? <Icon name="triangle-exclamation" /> : null}
          {s.h} <span class="c">{n}</span>
          {s.kind === "dev" ? <DevPill /> : null}
        </button>
      </h3>
      {open ? <Body s={s} f={f} searching={searching} /> : null}
    </section>
  );
}

function Jump(props: {
  readonly sections: readonly NoteSection[];
  readonly f: Filter;
  readonly onJump: (h: string) => void;
}) {
  const { t } = useUi();
  return (
    <nav class="mlu-jump" aria-label={t("up.jumpTo")}>
      {props.sections.map((s) => {
        const n = shownCount(props.f, s);
        if (!n) return null;
        const key = JUMP_KEYS[s.h];
        return (
          <button
            type="button"
            key={s.h}
            class={s.kind === "breaking" ? "brk" : ""}
            onClick={() => {
              props.onJump(s.h);
            }}
          >
            <b>{n}</b> {key ? plural(t, key, n) : s.h}
          </button>
        );
      })}
    </nav>
  );
}

function Banner(props: { readonly notes: Notes }) {
  const b = props.notes.banner;
  if (!b) return null;
  return (
    <figure class="mlu-banner">
      <img
        src={b.src}
        alt={b.alt}
        loading="lazy"
        referrerpolicy="no-referrer"
      />
      {b.caption ? <figcaption>{cleanChildren(b.caption)}</figcaption> : null}
    </figure>
  );
}

function useOpen(notes: Notes) {
  const [open, setOpen] = useState<ReadonlySet<string>>(
    () => new Set(OPEN_FIRST),
  );
  const all = notes.sections.map((s) => s.h);
  const allOpen = all.every((h) => open.has(h));
  const toggle = (h: string): void => {
    setOpen((o) =>
      o.has(h) ? new Set([...o].filter((x) => x !== h)) : new Set([...o, h]),
    );
  };
  const toggleAll = (): void => {
    setOpen(allOpen ? new Set() : new Set(all));
  };
  const jump = (h: string): void => {
    setOpen((o) => new Set([...o, h]));
    requestAnimationFrame(() => {
      document.getElementById(anchor(h))?.scrollIntoView({ block: "start" });
    });
  };
  return { open, allOpen, toggle, toggleAll, jump };
}

function Tools(props: {
  readonly f: Filter;
  readonly setF: (f: Filter) => void;
  readonly allOpen: boolean;
  readonly toggleAll: () => void;
}) {
  const { t } = useUi();
  const { f, setF } = props;
  return (
    <div class="mlu-tools">
      <input
        type="search"
        value={f.q}
        placeholder={t("up.search")}
        aria-label={t("up.search")}
        onInput={(e) => {
          setF({ ...f, q: e.currentTarget.value });
        }}
      />
      <label>
        <input
          type="checkbox"
          checked={f.dev}
          onChange={() => {
            setF({ ...f, dev: !f.dev });
          }}
        />
        {t("up.devNotes")}
      </label>
      <span class="ml-spacer" />
      <button type="button" class="mlu-link ml-link" onClick={props.toggleAll}>
        {props.allOpen ? t("up.collapseAll") : t("up.expandAll")}
      </button>
    </div>
  );
}

export const releaseDate = (ms: number): string =>
  new Date(ms).toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

function NotesHead(props: {
  readonly release: Release;
  readonly title: string;
  readonly onHistory: (() => void) | undefined;
}) {
  const { t } = useUi();
  const r = props.release;
  return (
    <div class="mlu-nhead">
      <h3>
        {t("up.notesTitle", {
          title: props.title || `Version ${String(r.generation)} ${r.suffix}`,
        })}
      </h3>
      <span>
        {t("up.notesSub", { version: r.version, date: releaseDate(r.time) })}
        {props.onHistory ? (
          <>
            {" · "}
            <button
              type="button"
              class="mlu-link ml-link"
              onClick={props.onHistory}
            >
              {t("up.allNotes")}
            </button>
          </>
        ) : null}
      </span>
    </div>
  );
}

export function NotesView(props: {
  readonly release: Release;
  readonly onHistory?: () => void;
}) {
  const { t } = useUi();
  const r = props.release;
  const notes = useMemo(() => parseNotes(r.notes), [r.notes]);
  const [f, setF] = useState<Filter>({ q: "", dev: true });
  const o = useOpen(notes);
  const sections = notes.sections.filter((s) => f.dev || s.kind !== "dev");
  const searching = f.q.trim() !== "";
  const body = sections.map((s) => (
    <Section
      key={s.h}
      s={s}
      f={f}
      open={o.open.has(s.h)}
      onToggle={() => {
        o.toggle(s.h);
      }}
    />
  ));
  const any = sections.some((s) => shownCount(f, s) > 0);
  return (
    <div class="mlu-notes">
      <NotesHead release={r} title={notes.title} onHistory={props.onHistory} />
      <Tools f={f} setF={setF} allOpen={o.allOpen} toggleAll={o.toggleAll} />
      <Jump sections={sections} f={f} onJump={o.jump} />
      {searching ? null : <Banner notes={notes} />}
      {searching ? null : <Intro blocks={notes.intro} />}
      <div class="mlu-body">
        {any ? body : <p class="ml-muted">{t("up.nothing")}</p>}
      </div>
    </div>
  );
}
