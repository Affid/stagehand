// Shuts down the world the demo server is running, back to Setup. Foundry
// 14 takes the administrator password with the request itself; its admin
// login is closed while a world runs. Run on its own, or used by listing.ts.
import { request } from "@playwright/test";
import { env } from "./browser.ts";

export async function shutdown(): Promise<void> {
  const api = await request.newContext({ baseURL: env.url });
  try {
    const res = await api.post("/setup", {
      data: { action: "worldShutdown", adminPassword: env.adminPassword },
      headers: { Origin: env.url },
      maxRedirects: 0,
    });
    console.log(`World shutdown: HTTP ${res.status()}`);
  } finally {
    await api.dispose();
  }
}

if (import.meta.main) await shutdown();
