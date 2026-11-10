// The settings panel: the toolbar button's popup over any page, and the
// browser's options dialog (manifest: action.default_popup, options_ui).
import "@stagehand/shared/zod-config";
import { render } from "preact";
import { chromeSettingsPlatform } from "../ui/settings/platform.ts";
import { SettingsPanel } from "../ui/settings/SettingsPanel.tsx";

const root = document.getElementById("root");
if (root) render(<SettingsPanel platform={chromeSettingsPlatform()} />, root);
