// @vitest-environment happy-dom
// A world's Backups tab as the prototype: the nudge while changes wait, an
// empty state, the summary head with Select, rows with the latest pill and
// Foundry's version badge, Foundry's progress, and its lock.
import type { Command, Snapshot } from "@module-library/shared/world";
import { cleanup, fireEvent, waitFor, within } from "@testing-library/preact";
import { afterEach, describe, expect, test } from "vitest";
import type { SetupState } from "../../src/messages.ts";
import type { BackupInfo } from "../../src/page-backups.ts";
import { formatSize } from "../../src/ui/common/size.ts";
import { el, renderUi } from "./harness.tsx";

afterEach(cleanup);

const DAY = 864e5;
const LIST: BackupInfo[] = [
  {
    id: "b2",
    createdAt: Date.now() - 3 * DAY,
    size: 441 * 1024 * 1024,
    note: "Session 31",
    snapshot: false,
    verified: "14.369",
  },
  {
    id: "b3",
    createdAt: Date.now() - 10 * DAY,
    size: 420 * 1024 * 1024,
    snapshot: false,
    verified: "13.351",
  },
  {
    id: "b1",
    createdAt: Date.now() - 40 * DAY,
    size: 412 * 1024 * 1024,
    snapshot: true,
  },
];

const snap: Snapshot = {
  worldId: "w1",
  title: "Strahd",
  system: { id: "dnd5e", version: "5" },
  coreVersion: "14.369",
  active: ["module-library", "a"].map((id) => ({ id, version: "1.0.0" })),
  companionVersion: "0.1.0",
  takenAt: new Date(Date.now() - 20 * DAY).toISOString(),
};

const queued = (createdAt: number): Command => ({
  id: "c1",
  scope: "world",
  worldId: "w1",
  type: "preset.apply",
  payload: { mode: "add", presetIds: [], modules: ["b"] },
  createdAt: new Date(createdAt).toISOString(),
  baseSnapshotAt: null,
  status: "pending",
});

async function backups(
  list: BackupInfo[] = LIST,
  data: Partial<SetupState> = {},
) {
  // Listed once when the world's page opens (the tab shows the count).
  const r = renderUi("shell", {
    state: { route: { kind: "world", worldId: "w1" } },
    data: { snapshots: { w1: snap }, ...data },
    backups: list,
  });
  fireEvent.click(r.getByRole("tab", { name: /^Backups/ }));
  await waitFor(() => {
    expect(r.container.querySelector(".mlw-backups")).toBeTruthy();
  });
  return r;
}

const row = (c: ParentNode, id: string): HTMLElement => {
  const found = c.querySelector<HTMLElement>(
    `.mlw-blist li[data-backup="${id}"]`,
  );
  if (!found) throw new Error(`no row ${id}`);
  return found;
};

describe("a world's Backups tab", () => {
  test("rows: the note or date, when, latest, Foundry's version badge and size", async () => {
    const { container, page } = await backups();
    expect(page.backups).toHaveBeenCalledWith("w1", "list", []);
    await waitFor(() => row(container, "b2"));
    const latest = row(container, "b2");
    expect(latest.classList.contains("latest")).toBe(true);
    expect(latest.textContent).toContain("Session 31");
    expect(latest.textContent).toContain("3 days ago");
    expect(latest.textContent).toContain("latest");
    expect(latest.textContent).toContain("441 MB");
    expect(el(latest, ".core").textContent).toContain("14.369");
    expect(el(latest, ".core").classList.contains("warn")).toBe(false);
    expect(el(row(container, "b3"), ".core").classList.contains("warn")).toBe(
      true,
    );
    expect(row(container, "b1").textContent).toContain("part of a snapshot");
  });

  test("the head sums them up and offers Select and Take a backup", async () => {
    const { container } = await backups();
    await waitFor(() => row(container, "b2"));
    const head = el(container, ".mlw-bhead");
    expect(head.textContent).toContain("3 backups");
    expect(head.textContent).toContain("latest 3 days ago");
    expect(head.textContent).toContain("1.2 GB in all");
    expect(within(head).getByRole("button", { name: "Select" })).toBeTruthy();
    expect(
      within(head).getByRole("button", { name: "Take a backup" }),
    ).toBeTruthy();
  });

  test("none yet: an empty state with Take the first backup", async () => {
    const { container, getByRole, page } = await backups([]);
    await waitFor(() => {
      expect(container.textContent).toContain("No backups of Strahd yet");
    });
    fireEvent.click(getByRole("button", { name: "Take the first backup" }));
    await waitFor(() => {
      expect(page.backups).toHaveBeenCalledWith("w1", "create", []);
    });
  });

  test("Restore… and Delete go to Foundry's own dialogs", async () => {
    const { container, getByRole, page } = await backups();
    await waitFor(() => row(container, "b2"));
    fireEvent.click(getByRole("button", { name: "Take a backup" }));
    await waitFor(() => {
      expect(page.backups).toHaveBeenCalledWith("w1", "create", []);
    });
    fireEvent.click(
      within(row(container, "b2")).getByRole("button", { name: "Restore…" }),
    );
    await waitFor(() => {
      expect(page.backups).toHaveBeenCalledWith("w1", "restore", ["b2"]);
    });
    fireEvent.click(
      within(row(container, "b2")).getByRole("button", {
        name: "Delete Session 31",
      }),
    );
    await waitFor(() => {
      expect(page.backups).toHaveBeenCalledWith("w1", "delete", ["b2"]);
    });
  });

  test("a snapshot's backup can't be deleted or picked alone, and says why", async () => {
    const { container, getByRole } = await backups();
    await waitFor(() => row(container, "b1"));
    const del = within(row(container, "b1")).getByRole<HTMLButtonElement>(
      "button",
      { name: /part of a snapshot/ },
    );
    expect(del.disabled).toBe(true);
    expect(del.closest("[title]")?.getAttribute("title")).toMatch(/snapshot/i);
    fireEvent.click(getByRole("button", { name: "Select" }));
    const pick = within(row(container, "b1")).getByRole<HTMLInputElement>(
      "checkbox",
    );
    expect(pick.disabled).toBe(true);
  });

  test("Select: pick some or All, see what deleting frees, Delete them at once", async () => {
    const { container, getByRole, page } = await backups();
    await waitFor(() => row(container, "b2"));
    fireEvent.click(getByRole("button", { name: "Select" }));
    expect(el(container, ".mlw-bhead").textContent).toContain(
      "Select backups to delete",
    );
    fireEvent.click(
      within(row(container, "b3")).getByRole("checkbox", {
        name: /^Select/,
      }),
    );
    expect(el(container, ".mlw-bhead").textContent).toContain(
      "1 backup selected · deleting frees 420 MB",
    );
    fireEvent.click(getByRole("button", { name: "All" }));
    expect(el(container, ".mlw-bhead").textContent).toContain(
      "2 backups selected",
    );
    fireEvent.click(getByRole("button", { name: "Delete 2…" }));
    await waitFor(() => {
      expect(page.backups).toHaveBeenCalledWith("w1", "delete", ["b2", "b3"]);
    });
    await waitFor(() => {
      expect(container.querySelector(".mlw-bhead.sel")).toBe(null);
    });
  });

  test("an error from Foundry is shown, and a failure keeps the list", async () => {
    const { container, getByRole, page } = await backups();
    await waitFor(() => row(container, "b2"));
    page.backups.mockResolvedValueOnce({ error: "Backup failed" });
    fireEvent.click(getByRole("button", { name: "Take a backup" }));
    await waitFor(() => {
      expect(container.textContent).toContain("Backup failed");
    });
    expect(row(container, "b2")).toBeTruthy();
  });

  test("the footnote links to all the server's backups", async () => {
    const { container, getByRole, store } = await backups();
    await waitFor(() => row(container, "b2"));
    expect(el(container, ".mlw-backups .hint").textContent).toContain(
      "These are Foundry's own backups.",
    );
    fireEvent.click(
      getByRole("button", { name: "All backups on this server" }),
    );
    expect(store.get().route).toEqual({ kind: "server", page: "backups" });
  });

  test("leaving the tab and coming back keeps its state (no second list)", async () => {
    const r = await backups();
    await waitFor(() => row(r.container, "b2"));
    fireEvent.click(r.getByRole("tab", { name: /^About/ }));
    fireEvent.click(r.getByRole("tab", { name: /^Backups/ }));
    expect(row(r.container, "b2")).toBeTruthy();
    expect(r.page.backups).toHaveBeenCalledTimes(1);
  });

  test("sizes read as KB, MB or GB", () => {
    expect(formatSize(300)).toBe("1 KB");
    expect(formatSize(0)).toBe("0 KB");
    expect(formatSize(80 * 1024)).toBe("80 KB");
    expect(formatSize(441 * 1024 * 1024)).toBe("441 MB");
    expect(formatSize(3 * 1024 * 1024 * 1024)).toBe("3.0 GB");
  });
});

describe("changes waiting for the next launch", () => {
  test("a nudge offers Back up now in place of Take a backup", async () => {
    const { container, page } = await backups(LIST, {
      commands: [queued(Date.now() - DAY)],
    });
    await waitFor(() => row(container, "b2"));
    const nudge = el(container, ".mlw-nudge");
    expect(nudge.textContent).toContain("1 change");
    expect(nudge.textContent).toContain("wait for the next launch");
    expect(
      within(el(container, ".mlw-bhead")).queryByRole("button", {
        name: "Take a backup",
      }),
    ).toBe(null);
    fireEvent.click(within(nudge).getByRole("button", { name: "Back up now" }));
    await waitFor(() => {
      expect(page.backups).toHaveBeenCalledWith("w1", "create", []);
    });
    expect(el(container, ".mlw-backups .hint").textContent).toContain(
      "Restoring keeps your 1 queued change",
    );
  });

  test("a backup newer than the changes says it's done, and which to restore", async () => {
    const { container } = await backups(LIST, {
      commands: [queued(Date.now() - 5 * DAY)],
    });
    await waitFor(() => row(container, "b2"));
    const nudge = el(container, ".mlw-nudge.done");
    expect(nudge.textContent).toContain("Backed up 3 days ago");
    expect(nudge.textContent).toContain("Session 31");
  });
});

describe("Foundry's progress and lock", () => {
  test("a running backup shows a progress row and locks Restore, Delete and Launch", async () => {
    const { container, emit, getByRole } = await backups();
    await waitFor(() => row(container, "b2"));
    emit({ type: "LOCK", payload: { locked: true } });
    emit({
      type: "PROGRESS",
      payload: {
        action: "createBackup",
        id: "world.w1.2026-11-06.1",
        packageId: "w1",
        type: "world",
        pct: 47,
      },
    });
    await waitFor(() => {
      expect(container.querySelector(".mlw-blist li.busy")).toBeTruthy();
    });
    const busy = el(container, ".mlw-blist li.busy");
    expect(busy.textContent).toContain("Backing up Strahd…");
    expect(busy.textContent).toContain("47%");
    expect(busy.getAttribute("role")).toBe("status");
    const restore = within(row(container, "b2")).getByRole<HTMLButtonElement>(
      "button",
      { name: "Restore…" },
    );
    expect(restore.disabled).toBe(true);
    expect(restore.closest("[title]")?.getAttribute("title")).toContain(
      "Wait for",
    );
    const launch = getByRole("button", {
      name: /^Launch/,
    }) as HTMLButtonElement;
    expect(launch.disabled).toBe(true);
    expect(launch.closest("[title]")?.getAttribute("title")).toContain(
      "Wait for",
    );
    emit({
      type: "PROGRESS",
      payload: {
        action: "createBackup",
        id: "world.w1.2026-11-06.1",
        step: "complete",
      },
    });
    emit({ type: "LOCK", payload: { locked: false } });
    await waitFor(() => {
      expect(container.querySelector(".mlw-blist li.busy")).toBe(null);
    });
    expect(launch.disabled).toBe(false);
  });

  test("another world's backup locks too, but draws no row here", async () => {
    const { container, emit } = await backups();
    await waitFor(() => row(container, "b2"));
    emit({ type: "LOCK", payload: { locked: true } });
    emit({
      type: "PROGRESS",
      payload: { action: "createBackup", id: "x", packageId: "w9", pct: 5 },
    });
    await waitFor(() => {
      expect(
        within(row(container, "b2")).getByRole<HTMLButtonElement>("button", {
          name: "Restore…",
        }).disabled,
      ).toBe(true);
    });
    expect(container.querySelector(".mlw-blist li.busy")).toBe(null);
  });
});

describe("select mode's reasons and counts (code review)", () => {
  test("Delete says to pick first; Select says why it waits", async () => {
    const { container, getByRole, emit } = await backups();
    await waitFor(() => row(container, "b2"));
    fireEvent.click(getByRole("button", { name: "Select" }));
    const del = getByRole("button", { name: "Delete…" });
    expect(del.closest("[title]")?.getAttribute("title")).toBe(
      "Pick what to delete first",
    );
    fireEvent.click(getByRole("button", { name: "Done" }));
    emit({ type: "LOCK", payload: { locked: true } });
    await waitFor(() => {
      const select = getByRole("button", { name: "Select" });
      expect(select.closest("[title]")?.getAttribute("title")).toContain(
        "Wait for",
      );
    });
  });
});
