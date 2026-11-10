// The bar over Foundry's admin login in the app (owner, 2026-11-09; mockup:
// design/app-screens, "Foundry's login", A): "‹ Servers" back to the app's
// server list, and which server this is. A plain link to the app's home
// page: native opens the server list for a tapped link there, so the page
// gets no new rights.

const BAR = "st-login-bar";
const STYLE = "st-login-style";

const CSS = `
#${BAR} { position: fixed; top: 0; left: 0; right: 0; z-index: 2147483000; height: 48px; display: flex; align-items: center; gap: 8px; padding: 0 12px 0 4px; box-sizing: border-box; background: rgb(11 10 19 / 94%); border-bottom: 1px solid #353042; font: 600 14px/1 Signika, system-ui, sans-serif; color: #efe9dd; }
#${BAR} a { display: inline-flex; align-items: center; gap: 4px; height: 44px; padding: 0 10px; color: inherit; text-decoration: none; border-radius: 8px; }
#${BAR} a:focus-visible { outline: 2px solid #ee9b3a; }
#${BAR} .st-host { margin-left: auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 400; font-size: 13px; color: #b5aec2; }
#${BAR} .st-plain { color: #e88a6a; }
body:has(#${BAR}) { padding-top: 48px !important; box-sizing: border-box; }
`;

/** Adds the bar once; the page's body must exist. */
export function addLoginBar(
  doc: Document,
  server: string,
  serversHref: string,
): void {
  if (doc.getElementById(BAR)) return;
  if (!doc.getElementById(STYLE)) {
    const style = doc.createElement("style");
    style.id = STYLE;
    style.textContent = CSS;
    // At document start the head may not be there yet.
    ((doc.head as HTMLHeadElement | null) ?? doc.documentElement).append(style);
  }
  const bar = doc.createElement("nav");
  bar.id = BAR;
  bar.setAttribute("aria-label", "Stagehand");
  const link = doc.createElement("a");
  link.href = serversHref;
  link.textContent = "‹ Servers";
  const host = doc.createElement("span");
  host.className = "st-host";
  if (server.startsWith("http:")) {
    const plain = doc.createElement("span");
    plain.className = "st-plain";
    plain.textContent = "Not encrypted · ";
    host.append(plain);
  }
  host.append(server.replace(/^https?:\/\//, ""));
  bar.append(link, host);
  doc.body.prepend(bar);
}
