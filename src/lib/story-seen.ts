import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "kidiplus.story.seen.v1";

export async function loadSeenStoryIds(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is string => typeof id === "string"));
  } catch {
    return new Set();
  }
}

export async function markStoriesSeen(ids: string[]): Promise<Set<string>> {
  const next = await loadSeenStoryIds();
  for (const id of ids) {
    if (id) next.add(id);
  }
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify([...next]));
  } catch {
    /* ignore quota */
  }
  return next;
}
