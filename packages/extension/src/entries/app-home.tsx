// The app's home screen (home.html on the app's own origin): the settings
// panel with its servers and Release history, over native.
import "@module-library/shared/zod-config";
import { logError } from "@module-library/shared/log";
import { render } from "preact";
import { createNativeBridge } from "../app/bridge.ts";
import { takeBridge } from "../app/page.ts";
import { nativeSettingsPlatform } from "../app/platform.ts";
import { BUILD } from "../build-info.ts";
import { SettingsPanel } from "../ui/settings/SettingsPanel.tsx";

const port = takeBridge(window);
const root = document.getElementById("root");
if (port && root)
  render(
    <SettingsPanel
      platform={nativeSettingsPlatform(createNativeBridge(port), BUILD)}
    />,
    root,
  );
else logError("home", new Error("No bridge to native"));
