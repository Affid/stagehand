// BBMM in the same world, as its source does it (thejoester/bbmm 1.4.11):
// with its world setting "Enable enhanced module management" on, a click on
// the sidebar's Module Management button opens BBMM's own window, Shift-click
// opens Foundry's, and the button's tooltip says so; in Foundry's window BBMM
// adds a "BBMM" header button for its toolbox. Stagehand doesn't compete for
// the button: it asks the first Gamemaster once which view the world should use.

const BBMM_TIP = "Opens BBMM Module Manager (Shift-click for core)";
const bbmmTakesButton = () => S.bbmm && S.bbmmEnhanced;

/** BBMM's own window, a stand-in: what it shows is BBMM's business. */
function openBbmmWindow() {
  closeBbmmWindow();
  document.getElementById("windows").insertAdjacentHTML("beforeend", `<form id="bbmm-manager" class="application" autocomplete="off">
    <header class="window-header">
      <i class="window-icon fa-fw fa-solid fa-layer-group" inert></i>
      <h1 class="window-title">BBMM Module Manager</h1>
      <button type="button" class="header-control icon fa-solid fa-xmark" data-tooltip-text="Close Window" aria-label="Close Window" data-action="closeBbmm"></button>
    </header>
    <section class="window-content standard-form">
      <p class="hint">Mockup: BBMM's own module window, not drawn here. Stagehand leaves it alone.</p>
      <p class="hint">Shift-click Module Management in the sidebar for Foundry's window, where Stagehand's view lives.</p>
    </section>
  </form>`);
  document.querySelector('#bbmm-manager [data-action="closeBbmm"]').addEventListener("click", closeBbmmWindow);
}

function closeBbmmWindow() {
  document.getElementById("bbmm-manager")?.remove();
}

/** BBMM's header button in Foundry's window (its renderModuleManagement hook). */
function bbmmHeaderButton() {
  return S.bbmm
    ? `<button type="button" class="header-control bbmm-header-menu-btn" data-action="bbmmToolbox" aria-label="BBMM Toolbox" data-tooltip-text="BBMM Toolbox"><i class="fa-solid fa-layer-group" inert></i><span>BBMM</span></button>`
    : "";
}

/** The sidebar's Module Management button: BBMM catches the click unless Shift is held. */
function onModuleManagementClick(e) {
  if (bbmmTakesButton() && !e.shiftKey) { openBbmmWindow(); return; }
  closeBbmmWindow();
  openWindow();
}

function updateSidebarButton() {
  const btn = document.getElementById("open-modules");
  if (bbmmTakesButton()) btn.dataset.tooltipText = BBMM_TIP;
  else delete btn.dataset.tooltipText;
}

// ---------- Stagehand's question, once per world ----------

/** Asked of the first full Gamemaster, when both views compete and nobody has answered yet. */
const shouldAskAboutBbmm = () => bbmmTakesButton() && S.structured && S.library && S.role === "gm" && !S.bbmmAsked;

function openBbmmPrompt() {
  const body = `<p>BBMM and Stagehand each have their own Module Management view. Which one should Module Management open in this world?</p>
    <dl class="stagehand-choices">
      <dt>Use Stagehand's view</dt>
      <dd>Turns off BBMM's <em>Enable enhanced module management</em> for everyone in this world and reloads it. BBMM's other tools stay, and so does its toolbox button in the window.</dd>
      <dt>Keep BBMM's view</dt>
      <dd>Nothing changes. Shift-click Module Management to open Stagehand's view.</dd>
    </dl>
    <p class="hint">You can change this later in Configure Settings: BBMM's <em>Enable enhanced module management</em>, or Stagehand's <em>Library view in Module Management</em>.</p>`;
  const buttons = button("useStagehand", "fa-cubes", "Use Stagehand's View") + button("keepBbmm", "fa-layer-group", "Keep BBMM's View");
  showDialog(dialogFrame("stagehand-bbmm", "fa-cubes", "Stagehand: Two Module Views", body, buttons), {
    useStagehand: () => {
      S.bbmmAsked = true; store("bbmmAsked", true);
      S.bbmmEnhanced = false; store("bbmmEnhanced", false);
      closeDialogs();
      updateSidebarButton();
      reloadWorld("Stagehand: BBMM's enhanced module management is off. Module Management opens Stagehand's view.");
    },
    keepBbmm: () => {
      S.bbmmAsked = true; store("bbmmAsked", true);
      closeDialogs();
      notify("info", "Stagehand: BBMM's view stays. Shift-click Module Management to open Stagehand's view.");
    },
    cancel: closeDialogs,
  });
  // Neither answer is the default: Stagehand doesn't lean on a Gamemaster who chose BBMM.
  document.activeElement?.blur();
}
