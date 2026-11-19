// The user's Group by and folded sections, kept in this browser per user.
// Storage can be missing or refused (private windows, blocked site data):
// then the view works and simply starts fresh next time.
import type { Prefs, SavedPrefs } from "./store.ts";

export function localPrefs(
  storage: () => Storage | undefined,
  userId: string,
): Prefs {
  const key = `stagehand.moduleView.${userId}`;
  return {
    load: (): SavedPrefs => {
      try {
        const raw = storage()?.getItem(key);
        const parsed: unknown = raw ? JSON.parse(raw) : undefined;
        return typeof parsed === "object" &&
          parsed !== null &&
          !Array.isArray(parsed)
          ? parsed
          : {};
      } catch {
        // Unreadable or no storage: start with the defaults.
        return {};
      }
    },
    save: (prefs) => {
      try {
        storage()?.setItem(key, JSON.stringify(prefs));
      } catch {
        // No storage: the choice lasts while the page is open.
      }
    },
  };
}
