// Options page: register a Foundry server (R-1). The permission request
// needs the user's click, so it runs here and not in the background.
import { BUILD } from "../build-info.ts";
import { send } from "../platform/runtime.ts";
import { normalizeServerUrl, permissionOrigin } from "../background/servers.ts";

const form = document.querySelector<HTMLFormElement>("#add-server");
const input = document.querySelector<HTMLInputElement>("#server-url");
const status = document.querySelector<HTMLOutputElement>("#status");
const build = document.querySelector<HTMLElement>("#build");
if (build) build.textContent = `Build ${BUILD}`;

form?.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!input || !status) return;
  const write = (text: string): void => {
    status.value = text;
  };
  let server: string;
  try {
    server = normalizeServerUrl(input.value);
  } catch (error: unknown) {
    write(error instanceof Error ? error.message : String(error));
    return;
  }
  chrome.permissions
    .request({ origins: [permissionOrigin(server)] })
    .then(async (granted) => {
      if (!granted) {
        write("Permission refused");
        return;
      }
      const r = await send<{ server: string }>({
        kind: "register-server",
        server,
      });
      write(`Registered ${r.server}`);
    })
    .catch((error: unknown) => {
      write(error instanceof Error ? error.message : String(error));
    });
});
