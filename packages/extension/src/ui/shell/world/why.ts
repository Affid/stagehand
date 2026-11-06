// The words, icon and fix for a card's "why" line (SETUP-REDESIGN.md: world
// page cards). Pure, so the card stays a plain view.
import { unverifiedText } from "../../model/unverified.ts";
import type { Translate } from "../../i18n.ts";
import { plural } from "../../i18n.ts";
import type { WorldModuleRow } from "../../model/world-modules.ts";

export interface Fix {
  readonly label: string;
  readonly moduleId: string;
  readonly on: boolean;
}

export interface WhyLine {
  /** "warn" and "dep" draw the card's problem edge; "desc" is quiet. */
  readonly tone: "" | "warn" | "dep" | "note" | "desc";
  readonly icon: string;
  readonly text: string;
  readonly fix?: Fix;
  /** Extra detail, e.g. which modules need it. */
  readonly title?: string;
}

export interface WhyContext {
  readonly t: Translate;
  /** A module's title, or its id when it isn't installed. */
  readonly name: (id: string) => string;
  /** 14: a risk is not verified for the running generation. */
  readonly coreGeneration: number | undefined;
}

function problemLine(row: WorldModuleRow, c: WhyContext): WhyLine | undefined {
  const { t, name } = c;
  const id = row.pkg.id;
  const { why } = row;
  switch (why.kind) {
    case "blocked":
      return {
        tone: "warn",
        icon: "ban",
        text: why.ids.length
          ? t("wp.why.blocked", { names: why.ids.map(name).join(", ") })
          : t("wp.why.incompatible"),
        fix: { label: t("wp.fix.undo"), moduleId: id, on: false },
      };
    case "needs":
      return {
        tone: "dep",
        icon: "link-slash",
        text: t("wp.why.needs", { name: name(why.id) }),
        fix: { label: t("wp.fix.turnOn"), moduleId: why.id, on: true },
      };
    case "conflict":
      return {
        tone: "warn",
        icon: "ban",
        text: t("wp.why.conflict", { name: name(why.id) }),
        fix: { label: t("wp.fix.turnOff"), moduleId: id, on: false },
      };
    case "neededBy":
      return row.problem
        ? {
            tone: "warn",
            icon: "link-slash",
            text: plural(t, "wp.why.neededBy", why.ids.length),
            title: why.ids.map(name).join(", "),
            fix: { label: t("wp.fix.turnOn"), moduleId: id, on: true },
          }
        : undefined;
    default:
      return undefined;
  }
}

export function whyLine(row: WorldModuleRow, c: WhyContext): WhyLine {
  const problem = problemLine(row, c);
  if (problem) return problem;
  const { t, name } = c;
  const { why } = row;
  switch (why.kind) {
    case "companion":
      return { tone: "", icon: "lock", text: t("wp.why.companion") };
    case "neededBy":
      return {
        tone: "",
        icon: "link",
        text: plural(t, "wp.why.neededBy", why.ids.length),
        title: why.ids.map(name).join(", "),
      };
    case "preset":
      return {
        tone: "",
        icon: "layer-group",
        text: t("wp.why.preset", { name: why.name }),
      };
    case "unverified":
      return {
        tone: "warn",
        icon: "code-branch",
        text: unverifiedText(t, c.coreGeneration),
      };
    case "note":
      return { tone: "note", icon: "note-sticky", text: why.text };
    case "authors":
      return {
        tone: "desc",
        icon: "",
        text: why.text ? t("wp.why.authors", { authors: why.text }) : "",
      };
    default:
      return { tone: "", icon: "", text: "" };
  }
}
