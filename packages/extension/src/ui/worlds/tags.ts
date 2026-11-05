// One tag on each of Foundry's world cards, in Foundry's own tag style: what
// the world's status is at a glance. It opens the world's sheet. If Foundry's
// markup changes, the tag goes missing; nothing else depends on it.
import type { Adapter } from "../../adapters/config.ts";
import { ago, plural, type Translate } from "../i18n.ts";
import { age, type WorldRow } from "../model/worlds.ts";

export type Tone = "ok" | "info" | "warn" | "error" | "muted";

export interface TagView {
  readonly tone: Tone;
  readonly icon: string;
  readonly label: string;
  readonly tooltip: string;
}

const CLASS = "ml-world-tag";
/** World-reported errors are shown as plain text, and kept short. */
const MAX_TOOLTIP = 300;

const short = (text: string): string =>
  text.length > MAX_TOOLTIP ? `${text.slice(0, MAX_TOOLTIP - 1)}…` : text;

export function tagView(row: WorldRow, t: Translate, now: number): TagView {
  const { pending, attention, snapshot } = row;
  // An outdated companion can't apply anything queued: say that first.
  if (pending.length > 0 && attention !== "outdated")
    return {
      tone: "info",
      icon: "hourglass-half",
      label: t("tag.queued", { n: pending.length }),
      tooltip: plural(t, "tag.queued.tip", pending.length),
    };
  switch (attention) {
    case "failed":
      return {
        tone: "error",
        icon: "circle-xmark",
        label: t("tag.failed"),
        tooltip: short(row.recent.at(-1)?.error ?? t("worlds.reason.failed")),
      };
    case "outdated":
    case "stale":
      return {
        tone: "warn",
        icon:
          attention === "stale" ? "clock-rotate-left" : "triangle-exclamation",
        label: t(`tag.${attention}`),
        tooltip: t(`worlds.reason.${attention}`),
      };
    case "no-companion":
      return {
        tone: "muted",
        icon: "plug-circle-xmark",
        label: t("tag.untracked"),
        tooltip: t("worlds.reason.no-companion"),
      };
    default:
      return {
        tone: "ok",
        icon: "circle-check",
        label: String(snapshot?.active.length ?? 0),
        tooltip: t("tag.ok.tip", {
          n: snapshot?.active.length ?? 0,
          age: snapshot ? ago(t, age(snapshot.takenAt, now)) : "",
        }),
      };
  }
}

function render(
  tag: HTMLButtonElement,
  view: TagView,
  title: string,
  t: Translate,
): void {
  const icon = tag.ownerDocument.createElement("i");
  icon.className = `fa-solid fa-${view.icon} fa-fw`;
  icon.setAttribute("inert", "");
  tag.replaceChildren(icon, view.label);
  tag.className = `tag flexrow ${CLASS} ml-tone-${view.tone}`;
  // Foundry renders data-tooltip as HTML; data-tooltip-text as plain text.
  tag.dataset.tooltipText = view.tooltip;
  tag.setAttribute(
    "aria-label",
    t("tag.label", { label: view.label, world: title, status: view.tooltip }),
  );
}

function createTag(doc: Document, onOpen: (worldId: string) => void) {
  const tag = doc.createElement("button");
  tag.type = "button";
  // Our own listener: Foundry's card actions never see this click.
  tag.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const id = tag.dataset.world;
    if (id) onOpen(id);
  });
  return tag;
}

/** Adds, updates or removes our tag on every world card; idempotent. */
export function syncWorldTags(
  doc: Document,
  selectors: Adapter["selectors"],
  rows: readonly WorldRow[],
  t: Translate,
  onOpen: (worldId: string) => void,
): void {
  const byId = new Map(rows.map((r) => [r.world.id, r]));
  for (const card of doc.querySelectorAll<HTMLElement>(selectors.worldCard)) {
    const existing = card.querySelector<HTMLButtonElement>(`.${CLASS}`);
    const row = byId.get(card.dataset.packageId ?? "");
    const box = card.querySelector(selectors.worldTags);
    if (!row || !box) {
      existing?.remove();
      continue;
    }
    const tag = existing ?? createTag(doc, onOpen);
    tag.dataset.world = row.world.id;
    render(tag, tagView(row, t, Date.now()), row.world.title, t);
    if (box.firstElementChild !== tag) box.prepend(tag);
  }
}
