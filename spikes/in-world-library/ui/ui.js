// The spike's on-demand chunk: a Preact component drawn into Foundry's
// window, to measure that a module can load Preact lazily and render cards
// there. Built into ../module/ui.js by vite.config.mjs.
import { h, render } from "preact";

function Card({ m }) {
  return h(
    "li",
    { class: `st-spike-card ${m.active ? "on" : "off"}`, "data-id": m.id },
    h("input", {
      type: "checkbox",
      class: "st-spike-switch",
      checked: m.active,
      "aria-label": `${m.title} on in this world`,
    }),
    h("span", { class: "t" }, m.title),
  );
}

function App({ total, on, titles, core }) {
  return h(
    "div",
    { class: "st-spike-view" },
    h(
      "p",
      { class: "st-spike-head" },
      `Stagehand view (spike) · Foundry ${core} · ${on} of ${total} on`,
    ),
    h(
      "ol",
      { class: "st-spike-grid" },
      titles.map((m) => h(Card, { key: m.id, m })),
    ),
    h(
      "footer",
      { class: "form-footer" },
      h(
        "button",
        { type: "submit", class: "st-spike-save" },
        "Save Module Settings",
      ),
    ),
  );
}

export function mount(host, data) {
  render(h(App, data), host);
}
