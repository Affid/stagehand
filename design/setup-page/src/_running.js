// ---------- "?phone=1&running=<world>": the app opens while a world is running ----------
// Foundry has no Setup then (it sends everyone to /join), so the app shows which world is running
// and one way out: Return to Setup. Seen live on 14.370: /api/status gives the world, its system,
// how many users are connected and the uptime; POST /setup {action: "worldShutdown"} closes the
// world without a password when the session is already logged in as admin (the app's is).
const RUN = { id: Q.get("running"), people: Number(Q.get("people") ?? 2), uptime: "1 h 40 min", closing: false };
const CLOSE_MS = 1600;

const runPeople = (n) => (n === 1 ? "1 person" : `${n} people`);

function runScreen() {
  const w = WORLDS_X.find((x) => x.id === RUN.id) ?? WORLDS_X[0];
  const n = RUN.people;
  const who = n ? `${runPeople(n)} in the game` : "Nobody in the game";
  const button = RUN.closing
    ? `<button type="button" class="bright mlp-runbtn" disabled><i class="fa-solid fa-spinner fa-spin-pulse"></i>Closing ${esc(w.title)}…</button>`
    : `<button type="button" class="bright mlp-runbtn" data-act="runreturn"><i class="fa-solid fa-door-open"></i>Return to Setup</button>`;
  return `<div class="mlp-run">
    <header class="mlp-top"><span class="logo" aria-hidden="true"></span><h1>Foundry VTT</h1><span class="ml-spacer"></span>${phVersionChip()}
      <button type="button" class="icon mlp-menu${ST.pop?.kind === "pmenu" ? " ml-on" : ""}" data-act="pmenu" aria-label="Log out or shut down"><i class="fa-solid fa-power-off"></i></button></header>
    <div class="mlp-runhero" style="--img:url(${IMG[w.img]});--pos:${w.pos}">
      <span class="live"><i aria-hidden="true"></i>Running now</span>
      <h2>${esc(w.title)}</h2>
      <div class="meta"><span><i class="fa-solid fa-dice-d20"></i>${esc(w.system)}</span><span><i class="fa-solid fa-users"></i>${who}</span><span><i class="fa-solid fa-clock"></i>For ${RUN.uptime}</span></div>
    </div>
    <div class="mlp-runbody">
      <p>Setup, the Library and backups come back once the world is closed.</p>
      ${button}
      <p class="hint">Foundry saves the world and closes it${n ? `; ${n === 1 ? "the person" : `the ${n} people`} in the game are disconnected` : ""}.</p>
      <button type="button" class="mlp-runjoin" data-act="foundry" data-what="Open Foundry's join page for ${esc(w.title)}, to join the game">Join the game</button>
    </div>
  </div>`;
}

/** With people in the game, Return to Setup asks first, as Foundry does from inside a world. */
function runDialog() {
  if (ST.dialog !== "runreturn") return "";
  const w = WORLDS_X.find((x) => x.id === RUN.id) ?? WORLDS_X[0];
  const body = `<div class="mls-launch-body"><p>${runPeople(RUN.people)} ${RUN.people === 1 ? "is" : "are"} in ${esc(w.title)}. Returning to Setup disconnects ${RUN.people === 1 ? "them" : "everyone"}; Foundry saves the world first.</p></div>`;
  const footer = `<button type="button" data-act="closedialog">Cancel</button><button type="button" class="bright" data-act="runclose"><i class="fa-solid fa-door-open"></i>Disconnect and return</button>`;
  return `<div class="mls-backdrop" data-act="closedialog"></div>${fwindow({ title: "Return to Setup?", icon: "fa-solid fa-door-open", x: 0, y: 0, w: 420, body, footer, cls: "mls-dialog" })}`;
}

A.runreturn = () => { if (RUN.people) { ST.dialog = "runreturn"; render(); } else A.runclose(); };
A.runclose = () => {
  const w = WORLDS_X.find((x) => x.id === RUN.id) ?? WORLDS_X[0];
  ST.dialog = null; RUN.closing = true; render();
  setTimeout(() => {
    RUN.id = null; RUN.closing = false; ST.world = w.id; ST.page = "world";
    render(); notify(`${esc(w.title)} is closed. This is Setup again.`);
  }, CLOSE_MS);
};

if (PHONE && RUN.id) {
  const renderPhone = render;
  // eslint-disable-next-line no-func-assign
  render = function () {
    renderPhone();
    document.body.classList.toggle("mlp-running", !!RUN.id);
    if (RUN.id) document.body.insertAdjacentHTML("beforeend", runScreen() + runDialog());
  };
}
