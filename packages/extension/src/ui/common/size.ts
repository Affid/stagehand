// Sizes as people read them: KB, MB or GB.
const MB = 1024 * 1024;
const GB = 1024 * MB;

export function formatSize(bytes: number): string {
  if (bytes >= GB) return `${(bytes / GB).toFixed(1)} GB`;
  if (bytes >= MB) return `${Math.round(bytes / MB)} MB`;
  // Anything above nothing is at least 1 KB; nothing is 0 KB.
  return `${bytes > 0 ? Math.max(1, Math.round(bytes / 1024)) : 0} KB`;
}
