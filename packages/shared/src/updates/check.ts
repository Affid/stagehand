// What our own check of one package found (docs/UPDATES-PLAN.md): Foundry's
// checkPackage answer, cut to what the Updates tab shows and judges. The
// manifest to install from stays in the page world; this crosses to the UI
// and is kept per server by the background, so it is checked on each side.
import { z } from "zod";

export const PACKAGE_ID = /^[A-Za-z0-9_-]{1,200}$/;
const MAX_VERSION = 60;
const MAX_ERROR = 500;
const MAX_RELATIONS = 100;

const Version = z.string().min(1).max(MAX_VERSION);
const Id = z.string().regex(PACKAGE_ID);

export const RangeSchema = z.object({
  minimum: Version.optional(),
  verified: Version.optional(),
  maximum: Version.optional(),
});

/** A package the remote version declares, with the versions it accepts. */
export const NeedSchema = z.object({
  id: Id,
  minimum: Version.optional(),
  maximum: Version.optional(),
});

export const CHECK_STATES = [
  /** No newer version. */
  "current",
  /** A newer version Foundry would install here. */
  "update",
  /** A newer version that needs another Foundry (availability 7 to 10). */
  "core",
  /** The manifest refused access (401 or 403): a membership may have ended. */
  "denied",
  /** Premium content on foundryvtt.com this license doesn't own. */
  "notOwned",
  /** No answer, or one Foundry couldn't read. */
  "error",
] as const;

export type CheckState = (typeof CHECK_STATES)[number];

export const PackageCheckSchema = z.object({
  id: Id,
  type: z.enum(["module", "system"]),
  state: z.enum(CHECK_STATES),
  /** The remote version, when Foundry read one. */
  version: Version.optional(),
  /** Foundry's availability code for the remote version (1 verified). */
  availability: z.number().int().min(0).max(20).optional(),
  /** The remote version's Foundry range. */
  compatibility: RangeSchema.optional(),
  /** Modules the remote version requires. */
  requires: z.array(NeedSchema).max(MAX_RELATIONS).optional(),
  /** Systems the remote version declares. */
  systems: z.array(NeedSchema).max(MAX_RELATIONS).optional(),
  /** The HTTP status behind an error (401, 403, 404, 500). */
  errorCode: z.number().int().min(100).max(599).optional(),
  error: z.string().max(MAX_ERROR).optional(),
  /** Milliseconds since 1970. */
  checkedAt: z.number().int().min(0),
});

export type PackageCheck = z.infer<typeof PackageCheckSchema>;
export type Need = z.infer<typeof NeedSchema>;
