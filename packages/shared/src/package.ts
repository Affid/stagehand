// Package data as the library uses it, extracted the same way from Setup's
// and a world's live Foundry package objects, and validated at boundaries.
import { z } from "zod";

const optionalText = z.string().optional();

/** Bounds for what Setup reads from a manifest (package-read.ts cuts to these). */
export const MAX_DESCRIPTION = 400;
export const MAX_LINK = 500;
export const MAX_LABEL = 100;
export const MAX_LIST = 50;

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
  /** The manifest's description as plain text, cut to a card's worth. */
  description: z.string().max(MAX_DESCRIPTION).optional(),
  /** Foundry's own star (core.setupPackageFavorites). */
  favorite: z.boolean().optional(),
  /** Foundry's lock: skipped by Update All. */
  locked: z.boolean().optional(),
  readme: z.string().max(MAX_LINK).optional(),
  changelog: z.string().max(MAX_LINK).optional(),
  license: z.string().max(MAX_LINK).optional(),
  /** Compendium packs, by label. */
  packs: z.array(z.string().max(MAX_LABEL)).max(MAX_LIST).optional(),
  /** Languages, by name. */
  languages: z.array(z.string().max(MAX_LABEL)).max(MAX_LIST).optional(),
});

export type Compatibility = z.infer<typeof CompatibilitySchema>;
export type Relation = z.infer<typeof RelationSchema>;
export type Author = z.infer<typeof AuthorSchema>;
export type PackageInfo = z.infer<typeof PackageInfoSchema>;

export { toPackageInfo } from "./package-read.ts";
