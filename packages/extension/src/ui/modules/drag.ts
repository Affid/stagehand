// Drag modules onto folders (S-1). Carries module ids only.
import type { TargetedDragEvent } from "preact";

export const DRAG_TYPE = "application/x-module-library-modules";

export function startDrag(
  e: TargetedDragEvent<HTMLElement>,
  ids: readonly string[],
): void {
  e.dataTransfer?.setData(DRAG_TYPE, JSON.stringify(ids));
  if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
}

export const isModuleDrag = (e: TargetedDragEvent<HTMLElement>): boolean =>
  e.dataTransfer?.types.includes(DRAG_TYPE) ?? false;

export function draggedIds(e: TargetedDragEvent<HTMLElement>): string[] {
  try {
    const value: unknown = JSON.parse(
      e.dataTransfer?.getData(DRAG_TYPE) ?? "[]",
    );
    return Array.isArray(value)
      ? value.filter((v): v is string => typeof v === "string")
      : [];
  } catch {
    return [];
  }
}
