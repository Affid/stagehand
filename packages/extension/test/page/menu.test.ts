// @vitest-environment happy-dom
import { describe, expect, test, vi } from "vitest";
import type { ContextMenuLike, MenuEntry } from "../../src/page/globals.ts";
import { installWorldMenu } from "../../src/page/menu.ts";

const CARD = "li.package.world[data-package-id]";

function fakeMenuClass() {
  const rendered: MenuEntry[][] = [];
  const proto: ContextMenuLike = {
    menuItems: [],
    render(this: ContextMenuLike) {
      rendered.push(this.menuItems);
      return Promise.resolve();
    },
  };
  const open = async (target: HTMLElement): Promise<MenuEntry[]> => {
    const menu = Object.create(proto) as ContextMenuLike;
    menu.menuItems = [
      { label: "Launch World", icon: "fa-play", onClick: () => undefined },
    ];
    await menu.render(target);
    return rendered.at(-1) ?? [];
  };
  return { proto, open };
}

const card = (id: string, cls = "package world"): HTMLElement => {
  const li = document.createElement("li");
  li.className = cls;
  li.dataset.packageId = id;
  return li;
};

describe("Foundry's world card menu", () => {
  test("adds our entries after Foundry's, which post the action", async () => {
    const { proto, open } = fakeMenuClass();
    const post = vi.fn();
    const configure = installWorldMenu(proto, post);
    expect((await open(card("w1"))).map((e) => e.label)).toEqual([
      "Launch World",
    ]);
    configure({
      labels: { details: "Details", apply: "Apply" },
      worldCard: CARD,
    });
    const items = await open(card("w1"));
    expect(items.map((e) => e.label)).toEqual([
      "Launch World",
      "Details",
      "Apply",
    ]);
    items[2]?.onClick();
    expect(post).toHaveBeenCalledWith({
      type: "MENU_ACTION",
      payload: { action: "apply", worldId: "w1" },
    });
  });

  test("leaves other packages alone, and read-only gets details only", async () => {
    const { proto, open } = fakeMenuClass();
    const configure = installWorldMenu(proto, vi.fn());
    configure({ labels: { details: "Details" }, worldCard: CARD });
    expect(await open(card("m1", "package module"))).toHaveLength(1);
    expect((await open(card("w1"))).map((e) => e.label)).toEqual([
      "Launch World",
      "Details",
    ]);
  });

  test("wraps once, and a bad selector never breaks Foundry's menu", async () => {
    const { proto, open } = fakeMenuClass();
    const first = installWorldMenu(proto, vi.fn());
    const render = proto.render;
    const again = installWorldMenu(proto, vi.fn());
    expect(proto.render).toBe(render);
    again({ labels: { details: "D" }, worldCard: "::bad(" });
    expect(await open(card("w1"))).toHaveLength(1);
    first(null);
    expect(await open(card("w1"))).toHaveLength(1);
  });
});

describe("menu: review fixes", () => {
  test("our entries never linger on a non-world menu", async () => {
    const { proto } = fakeMenuClass();
    const configure = installWorldMenu(proto, vi.fn());
    configure({ labels: { details: "D" }, worldCard: CARD });
    const menu = Object.create(proto) as ContextMenuLike;
    menu.menuItems = [];
    await menu.render(card("w1"));
    expect(menu.menuItems).toHaveLength(1);
    await menu.render(card("m1", "package module"));
    expect(menu.menuItems).toHaveLength(0);
  });
});
