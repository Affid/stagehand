// The Update page's state: the channel and what Foundry was started with
// (from its configuration), the release Foundry's update check found on that
// channel, the latest snapshot, and an update while it runs. Foundry checks
// again whenever the page opens or the channel changes, as its own update
// screen resets on a channel change.
import { useEffect, useRef, useState } from "preact/hooks";
import type { Choice } from "../../../../page-config.ts";
import type { Release } from "../../../../page-update.ts";
import { useUi } from "../../../context.ts";

export type Phase =
  | { readonly kind: "checking" }
  | { readonly kind: "release"; readonly release: Release }
  /** Foundry found nothing newer on the channel. */
  | { readonly kind: "none" }
  | { readonly kind: "error"; readonly error: string };

export interface Env {
  readonly electron: boolean;
  readonly noBackups: boolean;
  readonly channels: readonly Choice[];
}

export type Job =
  | { readonly kind: "running"; readonly snapshot: boolean }
  | { readonly kind: "installed"; readonly version: string }
  | { readonly kind: "failed"; readonly error: string };

/** The channels Foundry's own update screen offers (it drops "prototype"). */
const CHANNELS = ["stable", "testing", "development"];

/** Without Foundry's configuration, its three channels by our own names. */
const FALLBACK_CHANNELS: readonly Choice[] = CHANNELS.map((value) => ({
  value,
  label: value.charAt(0).toUpperCase() + value.slice(1),
}));

function useEnv() {
  const { page, state } = useUi();
  // Foundry's own update check names the channel too (Setup data).
  const known = state.data.setup?.coreUpdate?.channel;
  const [env, setEnv] = useState<Env>({
    electron: false,
    noBackups: false,
    channels: [],
  });
  const [channel, setChannel] = useState<string | null>(null);
  const [lastSnapshot, setLast] = useState<number | null>(null);
  useEffect(() => {
    void page.config("read").then((r) => {
      const s = r.settings;
      const listed = (r.choices?.channels ?? []).filter((c) =>
        CHANNELS.includes(c.value),
      );
      // A failed read still leaves a usable page (review): Foundry's channel,
      // and a snapshot offered (Foundry refuses one if backups are off, and
      // then nothing is installed).
      setEnv({
        electron: s?.electron ?? false,
        noBackups: s?.noBackups ?? false,
        channels: listed.length ? listed : FALLBACK_CHANNELS,
      });
      setChannel(s?.updateChannel ?? (known?.length ? known : "stable"));
    });
    void page.serverBackups("list", []).then((r) => {
      const times = (r.listing?.snapshots ?? []).map((x) => x.createdAt);
      setLast(times.length ? Math.max(...times) : null);
    });
  }, []);
  return { env, channel, setChannel, lastSnapshot };
}

/** Foundry's update check on the channel, again whenever it changes. */
function useCheck(channel: string | null) {
  const { page } = useUi();
  const [phase, setPhase] = useState<Phase>({ kind: "checking" });
  // Only the latest check counts: a slower earlier one is dropped (review).
  const latest = useRef(0);
  const check = async (on: string): Promise<void> => {
    const n = ++latest.current;
    setPhase({ kind: "checking" });
    const r = await page.update({ op: "check", channel: on, force: false });
    if (n !== latest.current) return;
    setPhase(
      r.release
        ? { kind: "release", release: r.release }
        : r.info
          ? { kind: "none" }
          : { kind: "error", error: r.error ?? "" },
    );
  };
  useEffect(() => {
    if (channel) void check(channel);
  }, [channel]);
  return {
    phase,
    check: () => (channel ? check(channel) : Promise.resolve()),
  };
}

export function useUpdate() {
  const { page } = useUi();
  const { env, channel, setChannel, lastSnapshot } = useEnv();
  const { phase, check } = useCheck(channel);
  const [job, setJob] = useState<Job | null>(null);
  const install = async (
    release: Release,
    snapshot: boolean,
    force: boolean,
  ): Promise<void> => {
    if (!channel || job?.kind === "running") return;
    setJob({ kind: "running", snapshot });
    const r = await page.update({
      op: "download",
      channel,
      force,
      snapshot,
      version: release.version,
    });
    setJob(
      r.installed
        ? { kind: "installed", version: release.version }
        : { kind: "failed", error: r.error ?? "" },
    );
  };
  return {
    env,
    channel,
    setChannel,
    lastSnapshot,
    phase,
    job,
    check,
    install,
  };
}

export type UpdateState = ReturnType<typeof useUpdate>;
