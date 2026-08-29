export const STORY_TTL_MS = 24 * 60 * 60 * 1000;
export const STORY_IMAGE_MS = 5500;

export function isStoryVideoUrl(url: string): boolean {
  return /\.(mp4|mov|webm|m4v)(\?|$)/i.test(url) || url.includes("video/");
}

export function storyExpiresAt(fromMs = Date.now()): string {
  return new Date(fromMs + STORY_TTL_MS).toISOString();
}

/** Hide the bubble row after the first TikTok-style slide. */
export function storiesHiddenByFeedIndex(index: number): boolean {
  return index > 0;
}

export function filterBlockedStories<T extends { userId: string }>(
  stories: T[],
  blockedIds: Set<string>,
): T[] {
  return stories.filter((s) => !blockedIds.has(s.userId));
}
