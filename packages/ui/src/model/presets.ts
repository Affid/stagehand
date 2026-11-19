// Whether a preset is active in a world (owner, 2026-11-18): every module
// in it that the server has is on, unsaved changes included. Modules the
// server lacks aren't counted; a preset with none installed is never active.

export interface PresetState {
  readonly installed: number;
  readonly on: number;
  /** Modules in the preset the server doesn't have. */
  readonly missing: number;
  readonly active: boolean;
}

export function presetState(
  preset: { readonly modules: readonly string[] },
  installed: ReadonlySet<string>,
  on: ReadonlySet<string>,
): PresetState {
  const here = preset.modules.filter((id) => installed.has(id));
  const onHere = here.filter((id) => on.has(id)).length;
  return {
    installed: here.length,
    on: onHere,
    missing: preset.modules.length - here.length,
    active: here.length > 0 && onHere === here.length,
  };
}
