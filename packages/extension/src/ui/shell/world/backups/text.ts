// How a backup reads: its note or date, when it was taken, and Foundry's
// version badge.
import type { BackupInfo } from "../../../../page-backups.ts";
import { ago, type Translate } from "../../../i18n.ts";
import { age } from "../../../model/worlds.ts";

export const backupDate = (ms: number): string =>
  new Date(ms).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

export const backupTime = (ms: number): string =>
  new Date(ms).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

/** The backup's name: Foundry's note, else the day it was taken. */
export const backupLabel = (b: BackupInfo): string =>
  b.note ?? backupDate(b.createdAt);

/** "3 days ago". */
export const agoMs = (t: Translate, ms: number): string =>
  ago(t, age(new Date(ms).toISOString(), Date.now()));

export const backupAge = (t: Translate, b: BackupInfo): string =>
  agoMs(t, b.createdAt);

/** Foundry's badge for an older generation: restoring brings that data back. */
export function olderCore(b: BackupInfo, generation: number | undefined) {
  const major = Number.parseInt(b.verified ?? "", 10);
  return (
    generation !== undefined && Number.isFinite(major) && major < generation
  );
}

/** A reason as a hover text: none when there is no reason, or it is blank. */
export const tip = (reason: string | null): string | undefined =>
  reason === null || reason === "" ? undefined : reason;
