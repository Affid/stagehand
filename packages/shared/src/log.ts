// The one place that writes to the browser console, prefixed so admins can
// tell Module Library's messages apart.
const PREFIX = "Module Library |";

export function logError(context: string, error: unknown): void {
  // eslint-disable-next-line no-console
  console.error(PREFIX, context, error);
}
