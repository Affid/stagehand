// Whether Stagehand draws its library view in Module Management: only where
// it is sure of the window (Foundry 13 or 14, with its content part), for a
// Gamemaster (Assistant included) who hasn't turned the setting off, on a
// server with a library. Anything else keeps Foundry's own window.

export interface TakeOverCheck {
  readonly isGM: boolean;
  readonly settingOn: boolean;
  /** Foundry's major version. */
  readonly generation: number;
  readonly hasLibrary: boolean;
  /** The window has the content part the view replaces. */
  readonly hasContent: boolean;
}

const KNOWN_GENERATIONS: ReadonlySet<number> = new Set([13, 14]);

export const takesOver = (c: TakeOverCheck): boolean =>
  c.isGM &&
  c.settingOn &&
  c.hasLibrary &&
  c.hasContent &&
  KNOWN_GENERATIONS.has(c.generation);
