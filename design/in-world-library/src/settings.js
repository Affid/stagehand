// Foundry's Configure Settings window (SettingsConfig, a CategoryBrowser in
// 14.370, its content a standard-form: templates/category-browser/sidebar.hbs, main.hbs and
// templates/settings/config-category.hbs), with Stagehand's one setting:
// "Library view in Module Management", per user, on by default. Other categories are
// drawn as tabs only.

const CATEGORIES = [
  ["core", "Core", 24], ["dnd5e", "Dungeons & Dragons Fifth Edition", 18], ["dice-so-nice", "Dice So Nice!", 9],
  ["fxmaster", "FXMaster", 3], ["health-estimate", "Health Estimate", 7], ["stagehand", "Stagehand", 1],
];
const settingsView = { tab: "stagehand", structured: true, bbmmEnhanced: true };
const categories = () => S.bbmm ? [...CATEGORIES.slice(0, 1), ["bbmm", "Big Bad Module Manager", 12], ...CATEGORIES.slice(1)] : CATEGORIES;

function settingsTabsHtml() {
  return categories().map(([id, label, n]) => `<button type="button" data-action="settingsTab" data-tab="${id}" class="plain${settingsView.tab === id ? " active" : ""}">
      <span>${esc(label)}</span><span class="count" data-count>[${n}]</span></button>`).join("");
}

function settingsCategoryHtml() {
  if (settingsView.tab === "bbmm") return bbmmSettingHtml();
  if (settingsView.tab !== "stagehand") return `<p class="hint">Mockup: only Stagehand's settings are drawn.</p>`;
  const shift = bbmmTakesButton() ? " With BBMM's enhanced module management on, Shift-click Module Management to open it." : "";
  return `<div class="form-group">
      <label for="settings-config-stagehand.libraryView">Library view in Module Management</label>
      <div class="form-fields"><input type="checkbox" id="settings-config-stagehand.libraryView" name="stagehand.libraryView"${settingsView.structured ? " checked" : ""}></div>
      <p class="hint">Modules appear as cards in the library's folders, with each module's details, presets and a review before saving. Turn this off for Foundry's own list, for example if another module adds to that window. This applies to you only.${shift}</p>
    </div>`;
}

/** BBMM's own setting, as it registers it (world, GM only, needs a reload); the rest of its tab isn't drawn. */
function bbmmSettingHtml() {
  return `<div class="form-group">
      <label for="settings-config-bbmm.enableModuleManagement">Enable enhanced module management</label>
      <div class="form-fields"><input type="checkbox" id="settings-config-bbmm.enableModuleManagement" name="bbmm.enableModuleManagement"${settingsView.bbmmEnhanced ? " checked" : ""}></div>
      <p class="hint">When enabled, BBMM replaces the stock Manage Modules list with the compact layout and notes UI for all users. Only a GM can change this.</p>
    </div>
    <p class="hint">Mockup: BBMM's other settings aren't drawn.</p>`;
}

function settingsHtml() {
  return `<form id="settings-config" class="application category-browser" autocomplete="off">
    <header class="window-header">
      <i class="window-icon fa-fw fa-solid fa-gears" inert></i>
      <h1 class="window-title">Game Settings</h1>
      <button type="button" class="header-control icon fa-solid fa-xmark" data-tooltip-text="Close Window" aria-label="Close Window" data-action="closeSettings"></button>
    </header>
    <section class="window-content standard-form">
      <aside class="flexcol" data-application-part="sidebar">
        <search><input type="search" placeholder="&#xf002;" aria-label="Filter" autocomplete="off" spellcheck="false"></search>
        <nav class="tabs vertical scrollable">${settingsTabsHtml()}</nav>
        <footer class="form-footer"><button type="button" class="reset-defaults" data-action="resetSettings"><i class="fa-solid fa-arrow-rotate-left" inert></i> Reset Defaults</button></footer>
      </aside>
      <div class="main flexcol" data-application-part="main">
        <div class="categories flexcol"><section class="tab scrollable active" data-tab="${settingsView.tab}">${settingsCategoryHtml()}</section></div>
        <footer class="form-footer"><button type="submit"><i class="fa-solid fa-floppy-disk" inert></i> Save Changes</button></footer>
      </div>
    </section>
  </form>`;
}

function openSettings() {
  settingsView.structured = S.structured;
  settingsView.bbmmEnhanced = S.bbmmEnhanced;
  closeSettings();
  document.getElementById("windows").insertAdjacentHTML("beforeend", settingsHtml());
  const win = document.getElementById("settings-config");
  win.addEventListener("click", (e) => {
    const el = e.target.closest("[data-action]");
    if (!el) return;
    e.preventDefault();
    if (el.dataset.action === "closeSettings") closeSettings();
    if (el.dataset.action === "resetSettings") { settingsView.structured = true; redrawSettings(); }
    if (el.dataset.action === "settingsTab") { settingsView.tab = el.dataset.tab; redrawSettings(); }
  });
  win.addEventListener("change", (e) => {
    if (e.target.name === "stagehand.libraryView") settingsView.structured = e.target.checked;
    if (e.target.name === "bbmm.enableModuleManagement") settingsView.bbmmEnhanced = e.target.checked;
  });
  win.addEventListener("submit", (e) => { e.preventDefault(); saveSettingsConfig(); });
}

function redrawSettings() {
  const win = document.getElementById("settings-config");
  win.querySelector("nav.tabs").innerHTML = settingsTabsHtml();
  win.querySelector(".categories > .tab").innerHTML = settingsCategoryHtml();
}

function closeSettings() {
  document.getElementById("settings-config")?.remove();
}

/** Foundry saves the setting; Stagehand's onChange draws Module Management again if it is open. */
function saveSettingsConfig() {
  const changed = settingsView.structured !== S.structured;
  const bbmmChanged = settingsView.bbmmEnhanced !== S.bbmmEnhanced;
  S.structured = settingsView.structured;
  store("structured", S.structured);
  S.bbmmEnhanced = settingsView.bbmmEnhanced;
  store("bbmmEnhanced", S.bbmmEnhanced);
  closeSettings();
  updateSidebarButton();
  if (bbmmChanged) { closeWindow(); closeBbmmWindow(); reloadWorld(); return; }
  if (changed && document.getElementById("module-management")) { S.search = ""; openWindow(); }
}
