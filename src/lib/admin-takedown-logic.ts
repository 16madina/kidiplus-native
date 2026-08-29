export const CONTENT_REPORT_KINDS = ["vitrine_post", "vitrine_story", "live"] as const;
export type ContentReportKind = (typeof CONTENT_REPORT_KINDS)[number];

export type ContentReportRef = {
  kind: ContentReportKind;
  contentId: string;
};

const UUID = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";
const TAGGED = new RegExp(`\\[kidiContent:(vitrine_post|vitrine_story|live):(${UUID})\\]`, "i");
const LEGACY_POST = new RegExp(`Vitrine post:\\s*(${UUID})`, "i");
const LEGACY_STORY = new RegExp(`Vitrine story:\\s*(${UUID})`, "i");

export function isUuid(value: string | null | undefined): boolean {
  return !!value && new RegExp(`^${UUID}$`).test(value.trim());
}

export function encodeContentReportNote(kind: ContentReportKind, contentId: string, extra?: string): string {
  const tag = `[kidiContent:${kind}:${contentId}]`;
  const rest = extra?.trim();
  return rest ? `${tag} ${rest}` : tag;
}

export function parseReportContentRef(input: {
  target_type?: string | null;
  target_id?: string | null;
  note?: string | null;
}): ContentReportRef | null {
  const note = input.note ?? "";
  const tagged = note.match(TAGGED);
  if (tagged?.[1] && tagged[2]) {
    return { kind: tagged[1].toLowerCase() as ContentReportKind, contentId: tagged[2] };
  }
  const post = note.match(LEGACY_POST);
  if (post?.[1]) return { kind: "vitrine_post", contentId: post[1] };
  const story = note.match(LEGACY_STORY);
  if (story?.[1]) return { kind: "vitrine_story", contentId: story[1] };
  if ((input.target_type ?? "").toLowerCase() === "live" && isUuid(input.target_id)) {
    return { kind: "live", contentId: input.target_id!.trim() };
  }
  const type = (input.target_type ?? "").toLowerCase();
  if ((type === "vitrine_post" || type === "vitrine_story") && isUuid(input.target_id)) {
    return { kind: type, contentId: input.target_id!.trim() };
  }
  return null;
}

export function takedownCopy(
  kind: ContentReportKind,
  media: "video" | "photo" | "story" | "live",
  lang: "fr" | "en" = "fr",
): { title: string; body: string } {
  if (lang === "en") {
    const title =
      media === "live" ? "Live removed" : media === "story" ? "Story removed" : "Content removed";
    const what =
      media === "live"
        ? "Your live was ended"
        : media === "story"
          ? "Your story was removed"
          : media === "video"
            ? "Your video was removed"
            : "Your photo was removed";
    return {
      title,
      body: `${what} because it does not meet KiDi+ community standards.`,
    };
  }
  const title =
    media === "live" ? "Live retiré" : media === "story" ? "Story retirée" : "Contenu retiré";
  const what =
    media === "live"
      ? "Ton live a été interrompu"
      : media === "story"
        ? "Ta story a été supprimée"
        : media === "video"
          ? "Ta vidéo a été supprimée"
          : "Ta photo a été supprimée";
  return {
    title,
    body: `${what} car ${media === "live" ? "il" : "elle"} ne respecte pas les normes de KiDi+.`,
  };
}

export function mediaFromKind(
  kind: ContentReportKind,
  mediaType?: string | null,
): "video" | "photo" | "story" | "live" {
  if (kind === "live") return "live";
  if (kind === "vitrine_story") return "story";
  if (mediaType === "video") return "video";
  return "photo";
}
