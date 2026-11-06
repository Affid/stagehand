// Foundry's prose-mirror editor, mounted by the page world into a host our
// page draws (page-editor.ts). Saves go through editWorld like every About
// field; Foundry cleans the HTML when it saves.
import type { PageGlobals } from "./globals.ts";
import { saveWorld } from "./save-world.ts";

interface EditorElement extends HTMLElement {
  value: string;
}

interface EditorClass {
  create(options: {
    name: string;
    value: string;
    toggled: boolean;
    collaborate?: boolean;
  }): EditorElement;
}

type EditorGlobals = Pick<PageGlobals, "game" | "ui" | "foundry">;

const editorIn = (doc: Document, hostId: string): EditorElement | null =>
  doc
    .getElementById(hostId)
    ?.querySelector<EditorElement>("[data-ml-editor]") ?? null;

/** Mounts the editor, editing at once; an error message, or undefined. */
export function openEditor(
  doc: Document,
  page: EditorGlobals,
  hostId: string,
  value: string,
): string | undefined {
  const host = doc.getElementById(hostId);
  if (!host) return `No editor host ${hostId}`;
  const Editor = page.foundry?.applications?.elements
    ?.HTMLProseMirrorElement as EditorClass | undefined;
  if (!Editor) return "Foundry's editor is missing";
  host.replaceChildren();
  const el = Editor.create({ name: "description", value, toggled: false });
  el.dataset.mlEditor = "";
  host.append(el);
  return undefined;
}

export function closeEditor(doc: Document, hostId: string): void {
  editorIn(doc, hostId)?.remove();
}

/** The editor's HTML as the world's description, through editWorld. */
export async function saveFromEditor(
  doc: Document,
  page: EditorGlobals,
  hostId: string,
  worldId: string,
): Promise<string | undefined> {
  const el = editorIn(doc, hostId);
  if (!el) return "The editor is not open";
  return saveWorld(page, worldId, { description: el.value });
}
