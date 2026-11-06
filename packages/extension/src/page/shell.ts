// Takes over Foundry's Setup layout for the new Setup page, and gives it back.
// CSS only: Foundry's apps stay rendered and running underneath, so their hidden
// buttons, menus, hooks and progress events keep working (docs/SETUP-SPIKE.md).
export const SHELL_CLASS = "ml-shell-on";
const STYLE_ID = "ml-shell-style";

export interface ShellSelectors {
  /** Must all exist, or the take-over is refused and nothing changes. */
  readonly required: readonly string[];
  /** Hidden while the new page is on. */
  readonly hide: readonly string[];
}

export const DEFAULT_SHELL: ShellSelectors = {
  required: ["#setup", "#setup-menu"],
  hide: ["#setup", "#setup-menu", "#main-header", "#watermark"],
};

export interface ShellState {
  readonly on: boolean;
  readonly error?: string;
}

function ensureStyle(doc: Document, sel: ShellSelectors): void {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `body.${SHELL_CLASS} :is(${sel.hide.join(", ")}) { display: none !important; }`;
  doc.head.append(style);
}

export function setShell(
  doc: Document,
  on: boolean,
  sel: ShellSelectors = DEFAULT_SHELL,
): ShellState {
  if (!on) {
    doc.body.classList.remove(SHELL_CLASS);
    return { on: false };
  }
  const missing = sel.required.filter((s) => !doc.querySelector(s));
  if (missing.length)
    return {
      on: false,
      error: `Foundry's Setup layout is missing ${missing.join(", ")}`,
    };
  ensureStyle(doc, sel);
  doc.body.classList.add(SHELL_CLASS);
  return { on: true };
}
