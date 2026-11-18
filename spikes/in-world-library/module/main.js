// Spike (in-world library plan, phase 1): Stagehand's view inside Foundry's
// Module Management. For Gamemasters it widens the window, replaces its
// content with a host, loads a small Preact chunk on demand into it, and
// blocks Foundry's own form save, which would read our content as an empty
// module list. Everything it sees goes to globalThis.__stSpike for the runner.

const WIDTH = 1160;
const S = (globalThis.__stSpike = {
  renders: 0,
  firstRenders: 0,
  takes: 0,
  mounts: 0,
  submitsBlocked: 0,
  importMs: null,
  cssLoaded: false,
  errors: [],
});

function loadCss() {
  if (document.getElementById("st-spike-css")) return;
  const link = document.createElement("link");
  link.id = "st-spike-css";
  link.rel = "stylesheet";
  link.href = new URL("./ui.css", import.meta.url).href;
  link.addEventListener("load", () => {
    S.cssLoaded = true;
  });
  document.head.append(link);
}

/** Foundry's handler saves the form's named fields as the whole module list; ours has none. */
function guardSubmit(app, element) {
  if (app._stSpikeGuarded) return;
  app._stSpikeGuarded = true;
  element.addEventListener(
    "submit",
    (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      S.submitsBlocked++;
    },
    { capture: true },
  );
}

function summary() {
  const mods = [...game.modules];
  return {
    total: mods.length,
    on: mods.filter((m) => m.active).length,
    titles: mods.map((m) => ({ id: m.id, title: m.title, active: m.active })),
    core: game.version,
  };
}

async function take(app, element, options) {
  S.takes++;
  guardSubmit(app, element);
  loadCss();
  element.classList.add("st-spike-cards");
  if (options?.isFirstRender) {
    app.setPosition({
      width: WIDTH,
      left: Math.max(0, (window.innerWidth - WIDTH) / 2),
    });
  }
  const content = element.querySelector(".window-content");
  const host = document.createElement("div");
  host.className = "st-spike-host";
  content.replaceChildren(host);
  const t0 = performance.now();
  const { mount } = await import("./ui.js");
  S.importMs ??= Math.round(performance.now() - t0);
  mount(host, summary());
  S.mounts++;
}

Hooks.on("renderModuleManagement", (app, element, _context, options) => {
  S.renders++;
  if (options?.isFirstRender) S.firstRenders++;
  if (!game.user.isGM) return;
  take(app, element, options).catch((error) => {
    S.errors.push(String(error?.stack ?? error));
  });
});
