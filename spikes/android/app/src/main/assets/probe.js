// Phase 0 spike probe (docs/ANDROID-APP-PLAN.md, spike questions). Added by
// the app at document start for the server's origin; reports to the native
// side through the `mlApp` bridge object. Throwaway code.
(() => {
  const bridge = window.mlApp;
  const report = (o) => {
    try {
      bridge?.postMessage(
        JSON.stringify({ t: Math.round(performance.now()), ...o }),
      );
    } catch (e) {
      // Nothing to report through.
    }
  };

  // Q2: a veil before the first paint.
  const style = document.createElement("style");
  style.textContent =
    "html.ml-probe-wait body { visibility: hidden !important; }";
  document.documentElement.classList.add("ml-probe-wait");
  document.documentElement.appendChild(style);

  // Q5: keep the bridge, try to take its global name away.
  let deleted;
  try {
    deleted = delete window.mlApp;
  } catch (e) {
    deleted = `throws: ${String(e)}`;
  }
  report({
    kind: "start",
    path: location.pathname,
    readyState: document.readyState,
    scriptsBefore: document.scripts.length,
    bridge: Boolean(bridge),
    deleted,
    afterDelete: typeof window.mlApp,
  });
  if (bridge)
    bridge.onmessage = (e) => report({ kind: "reply", data: String(e.data) });

  requestAnimationFrame(() =>
    report({
      kind: "first-frame",
      bodyVisibility: document.body
        ? getComputedStyle(document.body).visibility
        : "no body yet",
      styleConnected: style.isConnected,
    }),
  );
  setTimeout(() => {
    document.documentElement.classList.remove("ml-probe-wait");
    report({ kind: "veil-lifted" });
  }, 1500);

  addEventListener("load", () => {
    // Q5: what a later page script sees.
    const s = document.createElement("script");
    s.textContent = "window.__mlProbeSees = typeof window.mlApp;";
    document.head.appendChild(s);
    report({
      kind: "page-sees",
      value: window.__mlProbeSees,
      title: document.title,
    });
    // Q8: fonts from the server.
    document.fonts.ready.then(() =>
      report({
        kind: "fonts",
        loaded: [...document.fonts]
          .filter((f) => f.status === "loaded")
          .map((f) => f.family)
          .filter((v, i, a) => a.indexOf(v) === i),
      }),
    );
  });

  // Q4: the companion module's HELLO on a world's page.
  if (location.pathname.startsWith("/game")) {
    addEventListener("message", (e) => {
      const d = e.data;
      if (d && d.ns === "stagehand")
        report({ kind: "game-msg", from: d.from, type: d.type });
    });
  }
})();
