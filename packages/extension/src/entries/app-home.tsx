// The app's home screen (home.html on the app's own origin): the saved
// servers, Release history and the build, over native (ui/app-home).
import "@stagehand/shared/zod-config";
import { logError } from "@stagehand/shared/log";
import { render } from "preact";
import { createNativeBridge } from "../app/bridge.ts";
import { BACK } from "../app/native-api.ts";
import { takeBridge } from "../app/page.ts";
import { nativeSettingsPlatform } from "../app/platform.ts";
import { BUILD } from "../build-info.ts";
import { AppHome } from "../ui/app-home/AppHome.tsx";
import { createBackStack } from "../ui/app-home/back.ts";

const port = takeBridge(window);
const root = document.getElementById("root");
const bridge = port ? createNativeBridge(port) : undefined;
const platform = bridge ? nativeSettingsPlatform(bridge, BUILD) : undefined;
if (bridge && platform?.app && root) {
  const back = createBackStack();
  // Android's Back closes the open sheet first (native asks, as on Setup).
  bridge.handle(BACK, () => ({ handled: back.press() }));
  render(
    <AppHome
      platform={platform}
      app={platform.app}
      back={back}
      open={(href) => {
        window.location.assign(href);
      }}
    />,
    root,
  );
} else logError("home", new Error("No bridge to native"));
