// Which build of the extension is running: "0.2.0 · a4a2214 · 2026-11-06
// 15:40", set by build.ts. Tests and tools see "dev".
declare const __ML_BUILD__: string | undefined;

export const BUILD: string =
  typeof __ML_BUILD__ === "string" ? __ML_BUILD__ : "dev";
