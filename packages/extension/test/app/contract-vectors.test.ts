/// <reference types="vite/client" />
// The Kotlin app's copy of the native rules' answers is up to date.
import { describe, expect, it } from "vitest";
import stored from "../../../android/app/src/test/resources/contract-vectors.json?raw";
import { vectorsText } from "./contract-vectors.ts";

describe("contract vectors", () => {
  it("match the TypeScript (else: node scripts/android/contract-vectors.ts)", () => {
    expect(stored).toBe(vectorsText());
  });
});
