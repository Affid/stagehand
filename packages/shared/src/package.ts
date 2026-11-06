// Package data as the library uses it, extracted the same way from Setup's
// and a world's live Foundry package objects, and validated at boundaries.
import { z } from "zod";

const optionalText = z.string().optional();

export const CompatibilitySchema = z.object({
  minimum: optionalText,
  verified: optionalText,
  maximum: optionalText,
});

export const RelationSchema = z.object({
  id: z.string().min(1),
  type: z.string(),
  compatibility: CompatibilitySchema.optional(),
  reason: optionalText,
});

export const AuthorSchema = z.object({
  name: z.string(),
  url: optionalText,
  discord: optionalText,
});

export const PackageInfoSchema = z.object({
  id: z.string().min(1).max(200),
  title: z.string(),
  version: z.string(),
  authors: z.array(AuthorSchema),
  url: optionalText,
  bugs: optionalText,
  library: z.boolean(),
  hasPacks: z.boolean(),
  hasCode: z.boolean(),
  compatibility: CompatibilitySchema,
  requires: z.array(RelationSchema),
  recommends: z.array(RelationSchema),
  conflicts: z.array(RelationSchema),
  systems: z.array(RelationSchema),
});

export type Compatibility = z.infer<typeof CompatibilitySchema>;
export type Relation = z.infer<typeof RelationSchema>;
export type Author = z.infer<typeof AuthorSchema>;
export type PackageInfo = z.infer<typeof PackageInfoSchema>;

export { toPackageInfo } from "./package-read.ts";
