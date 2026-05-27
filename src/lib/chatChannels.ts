export const WORKSPACE_CHANNELS = [
  { id: "general", label: "general" },
  { id: "design-updates", label: "design-updates" },
  { id: "feature-requests", label: "feature-requests" },
] as const;

/** Stable thread id for a 1:1 DM (same for both participants). */
export function directMessageChannelId(userIdA: string, userIdB: string): string {
  const [first, second] =
    userIdA.localeCompare(userIdB) <= 0 ? [userIdA, userIdB] : [userIdB, userIdA];
  return `dm:${first}:${second}`;
}

/** Firestore `in` queries allow at most 10 values. */
export function chunkIds(ids: string[], size = 10): string[][] {
  const unique = [...new Set(ids.filter(Boolean))];
  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += size) {
    chunks.push(unique.slice(i, i + size));
  }
  return chunks;
}
