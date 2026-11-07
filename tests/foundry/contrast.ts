// Text contrast measured in the page, for the live suites and dev probes.
// axe can't measure text over Foundry's translucent panes on its background
// art. This lays every background colour behind an element over the art's
// two extremes, black and white, and keeps the worse ratio, so a pass holds
// whatever the art shows. The text's own alpha is laid over that backdrop.
// Not counted: background images and gradients, and `opacity` on ancestors.
// Colours must compute to rgb()/rgba(); anything else throws.
import type { Locator } from "@playwright/test";

export interface TextContrast {
  readonly text: string;
  readonly color: string;
  /** Unrounded: a 4.496 must not pass a 4.5 check. */
  readonly ratio: number;
}

/** Each visible element matched by `items`: its text, colour and contrast. */
export function contrasts(items: Locator): Promise<TextContrast[]> {
  return items.evaluateAll((els) => {
    type Rgba = readonly [number, number, number, number];
    const rgba = (s: string): Rgba => {
      if (!s.startsWith("rgb")) throw new Error(`Not an rgb colour: ${s}`);
      const [r = 0, g = 0, b = 0, a = 1] = (s.match(/[\d.]+/g) ?? []).map(
        Number,
      );
      return [r, g, b, a];
    };
    const lum = ([r, g, b]: Rgba): number => {
      const f = (v: number): number => {
        const c = v / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const over = (top: Rgba, under: Rgba): Rgba => {
      const mix = (t: number, u: number): number =>
        t * top[3] + u * (1 - top[3]);
      return [
        mix(top[0], under[0]),
        mix(top[1], under[1]),
        mix(top[2], under[2]),
        1,
      ];
    };
    const layers = (el: Element): Rgba[] => {
      const found: Rgba[] = [];
      for (let e: Element | null = el; e; e = e.parentElement) {
        const c = rgba(getComputedStyle(e).backgroundColor);
        if (c[3] > 0) found.push(c);
      }
      return found;
    };
    const ratio = (fg: Rgba, below: readonly Rgba[], art: Rgba): number => {
      const bg = below.reduceRight<Rgba>((u, t) => over(t, u), art);
      const [a, b] = [lum(over(fg, bg)), lum(bg)];
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    };
    return els
      .filter((e) => (e as HTMLElement).offsetParent && e.textContent.trim())
      .map((e) => {
        const color = getComputedStyle(e).color;
        const below = layers(e);
        return {
          text: e.textContent.trim().slice(0, 40),
          color,
          ratio: Math.min(
            ratio(rgba(color), below, [0, 0, 0, 1]),
            ratio(rgba(color), below, [255, 255, 255, 1]),
          ),
        };
      });
  });
}
