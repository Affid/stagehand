// axe-core (WCAG 2.2 A and AA) on the new Setup page, for the live suites.
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

/**
 * Audits `scope` at rest (no hover) and records each finding softly, so one
 * run lists every page's findings.
 */
export async function audit(
  page: Page,
  name: string,
  scope = "#ml-shell-root",
): Promise<void> {
  await page.mouse.move(0, 0);
  // Let transitions (the News carousel, popovers) settle.
  await page.waitForTimeout(400);
  const r = await new AxeBuilder({ page })
    .include(scope)
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  const found = r.violations.flatMap((v) =>
    v.nodes.map(
      (n) =>
        `${v.id}: ${n.target.join(" ")} ${(n.any[0]?.message ?? "").slice(0, 140)}`,
    ),
  );
  expect.soft(found, `axe on ${name}`).toEqual([]);
}
