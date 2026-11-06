// @vitest-environment happy-dom
import { cleanup, fireEvent, waitFor, within } from "@testing-library/preact";
import { afterEach, describe, expect, test } from "vitest";
import type { BackupInfo } from "../../src/page-backups.ts";
import { formatSize } from "../../src/ui/shell/world/BackupsTab.tsx";
import { renderUi } from "./harness.tsx";

afterEach(cleanup);

const LIST: BackupInfo[] = [
  {
    id: "b2",
    createdAt: Date.parse("2026-11-03T20:00:00Z"),
    size: 441 * 1024 * 1024,
    note: "Session 31",
    snapshot: false,
  },
  {
    id: "b1",
    createdAt: Date.parse("2026-03-14T10:00:00Z"),
    size: 412 * 1024 * 1024,
    snapshot: true,
  },
];

async function backups(list: BackupInfo[] = LIST) {
  const r = renderUi("shell", {
    state: { route: { kind: "world", worldId: "w1" } },
  });
  r.page.backups.mockResolvedValue({ backups: list });
  fireEvent.click(r.getByRole("tab", { name: "Backups" }));
  await waitFor(() => {
    expect(r.container.querySelector(".mlw-backups")).toBeTruthy();
  });
  return r;
}

const row = (c: ParentNode, id: string): HTMLElement => {
  const el = c.querySelector<HTMLElement>(`.mlw-blist li[data-backup="${id}"]`);
  if (!el) throw new Error(`no row ${id}`);
  return el;
};

describe("a world's Backups tab", () => {
  test("lists Foundry's backups with their date, note and size", async () => {
    const { container, page } = await backups();
    expect(page.backups).toHaveBeenCalledWith("w1", "list", []);
    await waitFor(() => {
      expect(row(container, "b2").textContent).toContain("Session 31");
    });
    expect(row(container, "b2").textContent).toContain("441 MB");
    expect(container.querySelector(".mlw-bhead")?.textContent).toContain(
      "2 backups",
    );
  });

  test("no backups says so", async () => {
    const { container } = await backups([]);
    await waitFor(() => {
      expect(container.textContent).toContain("No backups yet.");
    });
  });

  test("Take a backup, Restore and Delete go to Foundry's own dialogs", async () => {
    const { container, getByRole, page } = await backups();
    await waitFor(() => row(container, "b2"));
    fireEvent.click(getByRole("button", { name: "Take a backup" }));
    await waitFor(() => {
      expect(page.backups).toHaveBeenCalledWith("w1", "create", []);
    });
    fireEvent.click(
      within(row(container, "b2")).getByRole("button", { name: "Restore" }),
    );
    await waitFor(() => {
      expect(page.backups).toHaveBeenCalledWith("w1", "restore", ["b2"]);
    });
    fireEvent.click(
      within(row(container, "b2")).getByRole("button", { name: "Delete" }),
    );
    await waitFor(() => {
      expect(page.backups).toHaveBeenCalledWith("w1", "delete", ["b2"]);
    });
  });

  test("a snapshot's backup can't be deleted alone, and says why", async () => {
    const { container } = await backups();
    await waitFor(() => row(container, "b1"));
    const del = within(row(container, "b1")).getByRole<HTMLButtonElement>(
      "button",
      { name: "Delete" },
    );
    expect(del.disabled).toBe(true);
    expect(del.closest("[title]")?.getAttribute("title")).toMatch(/snapshot/i);
  });

  test("an error from Foundry is shown", async () => {
    const r = renderUi("shell", {
      state: { route: { kind: "world", worldId: "w1" } },
    });
    r.page.backups.mockResolvedValue({ error: "Backups are disabled" });
    fireEvent.click(r.getByRole("tab", { name: "Backups" }));
    await waitFor(() => {
      expect(r.container.textContent).toContain("Backups are disabled");
    });
  });

  test("sizes read as KB, MB or GB", () => {
    expect(formatSize(300)).toBe("1 KB");
    expect(formatSize(80 * 1024)).toBe("80 KB");
    expect(formatSize(441 * 1024 * 1024)).toBe("441 MB");
    expect(formatSize(3 * 1024 * 1024 * 1024)).toBe("3.0 GB");
  });

  test("a failed operation keeps the list and shows the error above it", async () => {
    const { container, getByRole, page } = await backups();
    await waitFor(() => row(container, "b2"));
    page.backups.mockResolvedValueOnce({ error: "Backup failed" });
    fireEvent.click(getByRole("button", { name: "Take a backup" }));
    await waitFor(() => {
      expect(container.textContent).toContain("Backup failed");
    });
    expect(row(container, "b2")).toBeTruthy();
  });

  test("leaving the tab and coming back keeps its state (no second list)", async () => {
    const r = await backups();
    await waitFor(() => row(r.container, "b2"));
    fireEvent.click(r.getByRole("tab", { name: "About" }));
    fireEvent.click(r.getByRole("tab", { name: "Backups" }));
    expect(row(r.container, "b2")).toBeTruthy();
    expect(r.page.backups).toHaveBeenCalledTimes(1);
  });
});
