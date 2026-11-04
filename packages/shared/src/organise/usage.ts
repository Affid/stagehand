// How many known worlds each module is active in (W-3, G-7).

export interface ActiveList {
  readonly active: readonly { readonly id: string }[];
}

export function usageCounts(
  snapshots: readonly ActiveList[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const s of snapshots)
    for (const { id } of s.active) counts[id] = (counts[id] ?? 0) + 1;
  return counts;
}
