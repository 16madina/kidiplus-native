import type { VitrineStory } from "./vitrine-stories";

export type StoryCardTone = "live" | "unread" | "read";

export function storyCardTone(unread: boolean, live: boolean): StoryCardTone {
  if (live) return "live";
  return unread ? "unread" : "read";
}

export function storyCardBadge(tone: StoryCardTone): "live" | "new" | null {
  if (tone === "live") return "live";
  if (tone === "unread") return "new";
  return null;
}

export type HomeStoryCard = {
  userId: string;
  displayName: string;
  previewUrl: string | null;
  avatarUrl: string | null;
  unread: boolean;
  items: VitrineStory[];
};

/** One card per seller — newest story is the preview. */
export function groupStoriesBySeller(stories: VitrineStory[]): HomeStoryCard[] {
  const cards: HomeStoryCard[] = [];
  const indexByUser = new Map<string, number>();
  for (const s of stories) {
    const existing = indexByUser.get(s.userId);
    if (existing == null) {
      indexByUser.set(s.userId, cards.length);
      cards.push({
        userId: s.userId,
        displayName: s.displayName,
        previewUrl: s.posterUrl || s.avatarUrl || s.mediaUrl,
        avatarUrl: s.avatarUrl,
        unread: s.unread,
        items: [s],
      });
      continue;
    }
    const card = cards[existing];
    card.items.push(s);
    if (s.unread) card.unread = true;
  }
  return cards;
}

export function applySeenFlags(stories: VitrineStory[], seenIds: Set<string>): VitrineStory[] {
  return stories.map((s) => ({ ...s, unread: !seenIds.has(s.id) }));
}

export function splitOwnStories(stories: VitrineStory[], userId: string | null | undefined) {
  if (!userId) return { own: [] as VitrineStory[], others: stories };
  return {
    own: stories.filter((s) => s.userId === userId),
    others: stories.filter((s) => s.userId !== userId),
  };
}

export function firstUnreadIndex(items: VitrineStory[]): number {
  const idx = items.findIndex((s) => s.unread);
  return idx >= 0 ? idx : 0;
}
