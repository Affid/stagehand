// Writes the native rules' answers for the Kotlin app's tests
// (packages/extension/test/app/contract-vectors.ts).
// Usage: node scripts/android/contract-vectors.ts
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  VECTORS_PATH,
  vectorsText,
} from "../../packages/extension/test/app/contract-vectors.ts";

const file = join(import.meta.dirname, "..", "..", VECTORS_PATH);
mkdirSync(dirname(file), { recursive: true });
writeFileSync(file, vectorsText());
console.log(`Wrote ${VECTORS_PATH}`);
