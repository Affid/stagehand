// Redrawing Foundry's own Setup after we changed its data. Our page replaces
// that screen, so the redraw is a courtesy: on WebViews older than Foundry
// supports (Android's, before Chromium 146) its render throws on
// `RegExp.escape`, and a change already saved must not read as failed.
import { logError } from "@stagehand/shared/log";

interface RedrawGlobals {
  readonly ui?: { readonly setupPackages?: unknown } | undefined;
}

/** Foundry's Setup redrawn; its failure is logged, never thrown. */
export async function redrawSetup(
  page: RedrawGlobals,
  what: string,
): Promise<void> {
  const setup = page.ui?.setupPackages as
    { render?: () => unknown } | undefined;
  try {
    await setup?.render?.();
  } catch (error: unknown) {
    logError(`${what} redraw`, error);
  }
}
