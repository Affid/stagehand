// The one place that writes to the browser console, prefixed so admins can
// tell Stagehand's messages apart.
const PREFIX = "Stagehand |";

export function logError(context: string, error: unknown): void {
  // eslint-disable-next-line no-console
  console.error(PREFIX, context, error);
}
