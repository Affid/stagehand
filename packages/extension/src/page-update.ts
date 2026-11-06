// Updating Foundry from the new Setup page (package 7): the UI asks with
// UPDATE (check a channel, or download and install, maybe after a snapshot);
// the page world runs Foundry's own update requests against its /update
// route, as Foundry's update screen does, and answers UPDATE_DONE. The
// release's notes cross as HTML and are cleaned in the UI before anything is
// shown; its download link never crosses. Checked both ways.
import { parsePreview, type Preview } from "./page-compat.ts";

type Loose = Readonly<Record<string, unknown>>;

export const UPDATE_OPS = ["check", "download", "preview"] as const;
export type UpdateOp = (typeof UPDATE_OPS)[number];

export interface UpdateRequest {
  readonly requestId: string;
  readonly op: UpdateOp;
  readonly channel: string;
  /** Foundry's "Force update": the latest on the channel, even if not newer. */
  readonly force: boolean;
  /** download: take a snapshot first, and stop if it fails. */
  readonly snapshot: boolean;
  /** download: the version it installs, for the snapshot's note; preview: the release checked. */
  readonly version?: string;
}

export interface Release {
  readonly version: string;
  readonly generation: number;
  readonly build: number;
  readonly channel: string;
  /** "Stable 12". */
  readonly suffix: string;
  /** Milliseconds since 1970. */
  readonly time: number;
  /** Foundry's release notes, HTML from foundryvtt.com (cleaned in the UI). */
  readonly notes: string;
  /** Can't be installed from Setup: a new generation or a full reinstall. */
  readonly manual: boolean;
}

export interface UpdateReply {
  readonly requestId: string;
  readonly release?: Release;
  /** Foundry's answer without a release, as an i18n key: "SETUP.UpdateNotAvailable". */
  readonly info?: string;
  /** download: installed; Foundry now shuts down (or restarts, on the desktop app). */
  readonly installed?: boolean;
  /** preview: Foundry's compatibility preview for the release. */
  readonly preview?: Preview;
  readonly error?: string;
}

const REQUEST_ID = /^[a-z0-9-]{1,64}$/i;
const CHANNEL = /^[a-z]{1,20}$/;
const I18N_KEY = /^[A-Za-z0-9_.]{1,200}$/;
const VERSION = /^\d{1,4}\.\d{1,6}$/;
const MAX_NOTES = 400_000;
const MAX_TEXT = 200;
const MAX_ERROR = 2000;

const isObject = (v: unknown): v is Loose =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const isText = (v: unknown, max: number): v is string =>
  typeof v === "string" && v.length <= max;
const isCount = (v: unknown): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= 0;

export function parseUpdateRequest(p: Loose): UpdateRequest | undefined {
  const { requestId, op, channel, force, snapshot, version } = p;
  if (typeof requestId !== "string" || !REQUEST_ID.test(requestId))
    return undefined;
  if (!(UPDATE_OPS as readonly unknown[]).includes(op)) return undefined;
  if (typeof channel !== "string" || !CHANNEL.test(channel)) return undefined;
  if (typeof force !== "boolean" || typeof snapshot !== "boolean")
    return undefined;
  if (snapshot && op !== "download") return undefined;
  if (op === "preview" && version === undefined) return undefined;
  if (
    version !== undefined &&
    !(typeof version === "string" && VERSION.test(version))
  )
    return undefined;
  return {
    requestId,
    op: op as UpdateOp,
    channel,
    force,
    snapshot,
    ...(version === undefined ? {} : { version }),
  };
}

export function release(v: unknown): Release | undefined {
  if (!isObject(v)) return undefined;
  const { version, generation, build, channel, suffix, time, notes, manual } =
    v;
  if (!isText(version, MAX_TEXT) || !VERSION.test(version)) return undefined;
  if (!isCount(generation) || !isCount(build) || !isCount(time))
    return undefined;
  if (!isText(channel, MAX_TEXT) || !isText(suffix, MAX_TEXT)) return undefined;
  if (!isText(notes, MAX_NOTES) || typeof manual !== "boolean")
    return undefined;
  return { version, generation, build, channel, suffix, time, notes, manual };
}

export function parseUpdateReply(p: Loose): UpdateReply | undefined {
  const { requestId, info, installed, error } = p;
  if (typeof requestId !== "string" || !REQUEST_ID.test(requestId))
    return undefined;
  if (info !== undefined && !(typeof info === "string" && I18N_KEY.test(info)))
    return undefined;
  if (installed !== undefined && installed !== true) return undefined;
  if (error !== undefined && !isText(error, MAX_ERROR)) return undefined;
  const r = p.release === undefined ? undefined : release(p.release);
  if (p.release !== undefined && !r) return undefined;
  const preview = p.preview === undefined ? undefined : parsePreview(p.preview);
  if (p.preview !== undefined && !preview) return undefined;
  return {
    requestId,
    ...(r ? { release: r } : {}),
    ...(info === undefined ? {} : { info }),
    ...(installed ? { installed } : {}),
    ...(preview ? { preview } : {}),
    ...(error === undefined ? {} : { error }),
  };
}
