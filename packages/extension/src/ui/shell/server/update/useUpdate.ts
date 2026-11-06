// The Update page's state: the channel and what Foundry was started with
// (from its configuration), the release Foundry's update check found on that
// channel, the latest snapshot, and an update while it runs. Foundry checks
// again whenever the page opens or the channel changes, as its own update
// screen resets on a channel change.
import { useEffect, useState } from "preact/hooks";
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

function useEnv() {
  const { page } = useUi();
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
      setEnv({
        electron: s?.electron ?? false,
        noBackups: s?.noBackups ?? false,
        channels: (r.choices?.channels ?? []).filter((c) =>
          CHANNELS.includes(c.value),
        ),
      });
      setChannel(s?.updateChannel ?? "stable");
    });
    void page.serverBackups("list", []).then((r) => {
      const times = (r.listing?.snapshots ?? []).map((x) => x.createdAt);
      setLast(times.length ? Math.max(...times) : null);
    });
  }, []);
  return { env, channel, setChannel, lastSnapshot };
}

export function useUpdate() {
  const { page } = useUi();
  const { env, channel, setChannel, lastSnapshot } = useEnv();
  const [phase, setPhase] = useState<Phase>({ kind: "checking" });
  const [job, setJob] = useState<Job | null>(null);
  const check = async (on: string): Promise<void> => {
    setPhase({ kind: "checking" });
    const r = await page.update({ op: "check", channel: on, force: false });
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
    check: () => (channel ? check(channel) : Promise.resolve()),
    install,
  };
}

export type UpdateState = ReturnType<typeof useUpdate>;
