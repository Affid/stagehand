// Foundry 13's way to close a running world, for the app's running page:
// 13 refuses an admin's /setup while a world runs (403), so POST /join
// "shutdown" with the admin password (or an admin session). It answers JSON
// with status "success", or its message as text when the password didn't do
// (checked in 13.351's code). Imported only by compat/quirks.ts.

export type JoinClose = "closing" | "password" | "failed";

/** Longer answers are a page, not Foundry's message. */
const MAX_ANSWER = 64_000;

const statusOf = (raw: string): unknown => {
  try {
    const value: unknown = JSON.parse(raw);
    return typeof value === "object" && value !== null
      ? (value as { status?: unknown }).status
      : undefined;
  } catch {
    return undefined;
  }
};

/** `post` sends a JSON body to Foundry's /join and answers its response. */
export async function closeWorldByJoin(
  post: (body: string) => Promise<Response>,
  password: string | undefined,
): Promise<JoinClose> {
  const res = await post(
    JSON.stringify({
      action: "shutdown",
      ...(password === undefined ? {} : { adminPassword: password }),
    }),
  );
  if (!res.ok) return "failed";
  const raw = (await res.text()).slice(0, MAX_ANSWER).trim();
  if (statusOf(raw) === "success") return "closing";
  // The password's refusal is Foundry's message as plain text; JSON, a
  // page or nothing at all is some other failure (review).
  return raw && !/^[{[<]/.test(raw) ? "password" : "failed";
}
