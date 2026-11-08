// What our Setup page needs from its host beyond the background: files,
// confirmations and links to other sites. The extension uses the browser's
// own (a download, a file input, `window.confirm`, a new tab); the app hands
// them to the native side (a system file picker, a native dialog, a Custom
// Tab).
import { downloadText, pickTextFile, safeUrl } from "./common/files.ts";

export interface FilesPort {
  /** Saves text as a file the user keeps (library export). */
  save(fileName: string, text: string): Promise<void>;
  /** A text file the user picks, or undefined when they pick none. */
  open(): Promise<string | undefined>;
}

export interface UiPorts {
  readonly files: FilesPort;
  /** Asks the user a yes or no question. */
  readonly confirm: (text: string) => Promise<boolean>;
  /**
   * A link to another site was followed: true when the host opened it
   * itself, false to let the browser follow the link.
   */
  readonly openExternal: (url: string) => boolean;
}

/** The extension: the browser's own download, picker, confirm and tabs. */
export function browserPorts(): UiPorts {
  return {
    files: {
      save(fileName, text) {
        downloadText(fileName, text);
        return Promise.resolve();
      },
      open: pickTextFile,
    },
    confirm: (text) => Promise.resolve(window.confirm(text)),
    openExternal: () => false,
  };
}

const MIDDLE_BUTTON = 1;

/** Whether the user clicked: in the app a page script shares the page and
 * could click our links to open sites (security review). */
const byUser = (event: Event): boolean => event.isTrusted;

/** The new-tab link a user's click came from, if any. */
function newTabLink(
  event: MouseEvent,
  isUser: (event: Event) => boolean,
): HTMLAnchorElement | null {
  if (event.defaultPrevented || !isUser(event)) return null;
  if (!(event.target instanceof Element)) return null;
  return event.target.closest<HTMLAnchorElement>('a[target="_blank"]');
}

/**
 * Hands every new-tab link clicked inside `host` to `open` (one listener
 * for all our links: news, release notes, package pages, descriptions).
 * Returns a function that stops watching.
 */
export function watchExternalLinks(
  host: HTMLElement,
  open: UiPorts["openExternal"],
  /** Tests stand in for the browser's isTrusted. */
  isUser: (event: Event) => boolean = byUser,
): () => void {
  const onClick = (event: MouseEvent): void => {
    if (event.type === "auxclick" && event.button !== MIDDLE_BUTTON) return;
    const link = newTabLink(event, isUser);
    if (!link) return;
    const url = safeUrl(link.href);
    // Anything but http(s) never opens a new window (we render none).
    if (url === undefined || open(url)) event.preventDefault();
  };
  host.addEventListener("click", onClick);
  host.addEventListener("auxclick", onClick);
  return () => {
    host.removeEventListener("click", onClick);
    host.removeEventListener("auxclick", onClick);
  };
}
