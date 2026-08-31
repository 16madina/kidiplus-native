export const YT_CHAT_COLOR = "#E24B4B";
export const FB_CHAT_COLOR = "#4B7BE5";

const seenExternalIds = new Set<string>();

export function markSocialSeen(key: string) {
  seenExternalIds.add(key);
  if (seenExternalIds.size > 500) {
    const keep = Array.from(seenExternalIds).slice(-250);
    seenExternalIds.clear();
    for (const k of keep) seenExternalIds.add(k);
  }
}

export type SocialChatEvt = {
  id: string;
  user: string;
  text: string;
  system?: boolean;
  isHost?: boolean;
  source?: "youtube" | "facebook" | "kidi";
  color?: string;
  externalId?: string;
};

export type SocialMsg = { id: string; authorName: string; text: string };

export function socialPromoText(productName: string | null, auctionActive: boolean): string {
  if (auctionActive && productName) {
    return `🔥 Enchère en cours sur KiDi+ : ${productName} — ouvre le lien dans la description pour enchérir !`;
  }
  if (productName) {
    return `🛍 En vedette sur KiDi+ : ${productName} — lien dans la description pour acheter !`;
  }
  return "🛍 Live shopping KiDi+ — ouvre le lien dans la description pour rejoindre et acheter !";
}

export function socialMessagesToEvents(body: {
  youtube: { messages: SocialMsg[] };
  facebook: { messages: SocialMsg[] };
}): SocialChatEvt[] {
  const out: SocialChatEvt[] = [];
  for (const m of body.youtube.messages) {
    const key = `yt:${m.id}`;
    if (seenExternalIds.has(key)) continue;
    markSocialSeen(key);
    out.push({
      id: key,
      user: m.authorName,
      text: m.text,
      source: "youtube",
      color: YT_CHAT_COLOR,
      externalId: m.id,
    });
  }
  for (const m of body.facebook.messages) {
    const key = `fb:${m.id}`;
    if (seenExternalIds.has(key)) continue;
    markSocialSeen(key);
    out.push({
      id: key,
      user: m.authorName,
      text: m.text,
      source: "facebook",
      color: FB_CHAT_COLOR,
      externalId: m.id,
    });
  }
  return out;
}
