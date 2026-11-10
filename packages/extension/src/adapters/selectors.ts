// Setup's markup as our adapters select it (V14 builds 369 and 370, and
// Foundry 13, whose Setup markup is the same). Its own file so adapters can
// share it without importing the config that lists them.
import type { Adapter } from "./config.ts";

/** Setup markup of V14 builds 369 and 370; also the best guess in safe mode. */
export const V14_SELECTORS: Adapter["selectors"] = {
  worldsTab: "#setup-packages-worlds",
  modulesTab: "#setup-packages-modules",
  modulesList: "#modules-list",
  worldsList: "#worlds-list",
  worldCard: "#worlds-list > li.package.world[data-package-id]",
  worldTags: ".tags.right",
};
