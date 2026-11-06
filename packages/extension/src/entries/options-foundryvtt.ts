// Options page: the optional permission to read foundryvtt.com, for the
// Update page's Release history (background/releases.ts). Asked here,
// because a permission request needs the user's click on an extension page.
import { FOUNDRY_ORIGIN } from "../background/releases.ts";

const origins = { origins: [FOUNDRY_ORIGIN] };

export function setUpFoundryvtt(doc: Document): void {
  const allow = doc.querySelector<HTMLButtonElement>("#allow-foundryvtt");
  const remove = doc.querySelector<HTMLButtonElement>("#remove-foundryvtt");
  const status = doc.querySelector<HTMLOutputElement>("#foundryvtt-status");
  if (!allow || !remove || !status) return;
  const show = async (): Promise<void> => {
    const granted = await chrome.permissions.contains(origins);
    allow.hidden = granted;
    remove.hidden = !granted;
    status.value = granted
      ? "Allowed. Go back to the Update page and open Release history again."
      : "";
  };
  const run = (work: () => Promise<unknown>): void => {
    work()
      .then(show)
      .catch((error: unknown) => {
        status.value = error instanceof Error ? error.message : String(error);
      });
  };
  allow.addEventListener("click", () => {
    run(() => chrome.permissions.request(origins));
  });
  remove.addEventListener("click", () => {
    run(() => chrome.permissions.remove(origins));
  });
  run(() => Promise.resolve());
  if (doc.location.hash === "#foundryvtt")
    doc.querySelector("#foundryvtt")?.scrollIntoView();
}
