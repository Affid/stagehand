// Opens real Foundry windows (ApplicationV2) that host the isolated UI: the
// window frame, dragging, resizing and closing are Foundry's own. The UI
// renders into an empty element inside; the window never renders anything.
import {
  type PageToUi,
  type WindowSpec,
  windowHostId,
} from "../page-protocol.ts";
import type { AppClass, AppInstance } from "./globals.ts";

export interface WindowHost {
  open(spec: WindowSpec): Promise<void>;
  close(id: string): Promise<void>;
}

interface HostApp extends AppInstance {
  mlId: string;
  rendering: Promise<unknown> | undefined;
}

type Ctor = new (options: object) => AppInstance & {
  _onClose?(options: unknown): void;
};

function windowClass(base: AppClass, onClosed: (id: string) => void) {
  const Base = base as unknown as Ctor;
  return class ModuleLibraryWindow extends Base implements HostApp {
    mlId = "";
    rendering: Promise<unknown> | undefined;

    _renderHTML(): Promise<null> {
      return Promise.resolve(null);
    }

    _replaceHTML(_result: unknown, content: HTMLElement): void {
      const id = windowHostId(this.mlId);
      if (content.querySelector(`#${id}`)) return;
      const host = content.ownerDocument.createElement("div");
      host.id = id;
      host.className = "ml-app ml-win";
      content.append(host);
    }

    /**
     * No detaching into a separate browser window: our stylesheet and the
     * dialogs these windows open (confirmations, Apply) stay in this page.
     */
    _canDetach(): boolean {
      return false;
    }

    override _onClose(options: unknown): void {
      super._onClose?.(options);
      onClosed(this.mlId);
    }
  };
}

const options = (spec: WindowSpec): object => ({
  id: `ml-window-${spec.id}`,
  classes: ["ml-window"],
  window: { title: spec.title, icon: spec.icon, resizable: true },
  position: {
    width: spec.width,
    height: spec.height,
    ...(spec.left === undefined ? {} : { left: spec.left }),
    ...(spec.top === undefined ? {} : { top: spec.top }),
  },
});

export function createWindowHost(
  base: AppClass,
  post: (message: PageToUi) => void,
): WindowHost {
  const open = new Map<string, HostApp>();
  const Window = windowClass(base, (id) => {
    if (!open.delete(id)) return;
    post({ type: "WINDOW_CLOSED", payload: { id } });
  });
  return {
    async open(spec) {
      const existing = open.get(spec.id);
      if (existing) {
        existing.bringToFront?.();
        post({ type: "WINDOW_READY", payload: { id: spec.id } });
        return;
      }
      const app = new Window(options(spec));
      app.mlId = spec.id;
      open.set(spec.id, app);
      app.rendering = app.render({ force: true });
      await app.rendering;
      // Closed while rendering: nothing is waiting for it any more.
      if (open.get(spec.id) === app)
        post({ type: "WINDOW_READY", payload: { id: spec.id } });
    },
    async close(id) {
      const app = open.get(id);
      if (!app) return;
      open.delete(id);
      // Closing mid-render could leave an untracked window behind.
      await app.rendering?.catch(() => undefined);
      await app.close();
    },
  };
}
