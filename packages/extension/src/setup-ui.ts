// Isolated content script on Setup: receives package data from the main
// world, reports it to the background and mounts the (spike) panel.
// Builds DOM with textContent only: package data is never parsed as HTML.
import { logError } from "@module-library/shared/log";
import type { ApplyMode } from "@module-library/shared/apply";
import { isEnvelope } from "@module-library/shared/protocol";
import type { SetupData } from "./messages.ts";
import { send } from "./runtime.ts";

const PANEL_ID = "module-library-panel";

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> = {},
  children: readonly Node[] = [],
): HTMLElementTagNameMap[K] {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

function queueForm(data: SetupData): HTMLFormElement {
  const world = el(
    "select",
    { name: "world" },
    data.worlds.map((w) => el("option", { value: w.id, textContent: w.title })),
  );
  const mode = el(
    "select",
    { name: "mode" },
    ["add", "replace", "remove"].map((m) =>
      el("option", { value: m, textContent: m }),
    ),
  );
  const modules = el("input", { name: "modules", placeholder: "module ids" });
  const status = el("output", { name: "status" });
  const form = el("form", {}, [
    world,
    mode,
    modules,
    el("button", { type: "submit", textContent: "Queue" }),
    status,
  ]);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const ids = modules.value.split(/[\s,]+/).filter(Boolean);
    send<{ queued: string }>({
      kind: "queue-command",
      worldId: world.value,
      mode: mode.value as ApplyMode,
      modules: ids,
    }).then(
      (r) => (status.value = `Queued ${r.queued}`),
      (e: unknown) => (status.value = `Failed: ${String(e)}`),
    );
  });
  return form;
}

function mount(data: SetupData, adminVerified: boolean): void {
  document.getElementById(PANEL_ID)?.remove();
  const host = document.getElementById("setup-packages-worlds");
  if (!host) return;
  const summary = `Module Library: ${data.modules.length} modules, ${data.worlds.length} worlds, core ${data.coreVersion}, ${adminVerified ? "admin verified" : "not verified"}`;
  const panel = el("div", { id: PANEL_ID }, [
    el("p", { className: "summary", textContent: summary }),
    ...(adminVerified ? [queueForm(data)] : []),
  ]);
  host.prepend(panel);
}

window.addEventListener("message", (event: MessageEvent<unknown>) => {
  if (event.source !== window || event.origin !== location.origin) return;
  if (!isEnvelope(event.data, "setup-main")) return;
  if (event.data.type !== "SETUP_DATA") return;
  const data = event.data.payload as SetupData;
  send<{ adminVerified: boolean }>({ kind: "setup-seen", data }).then(
    (r) => {
      mount(data, r.adminVerified);
    },
    (error: unknown) => {
      logError("setup", error);
    },
  );
});
