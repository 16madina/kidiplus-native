/**
 * Fast, deterministic first-pass moderation for user-authored text.
 *
 * This is intentionally conservative and only blocks high-confidence severe
 * content. The same rules are mirrored by a Postgres trigger so a modified
 * client cannot bypass them. Reports and human review remain the appeal path.
 */

export type ContentModerationReason =
  | "sexual_minors"
  | "sexual_explicit"
  | "hate"
  | "violent_threat"
  | "self_harm"
  | "illegal_goods"
  | "fraud";

export type ContentModerationResult =
  | { allowed: true }
  | { allowed: false; reason: ContentModerationReason };

export const CONTENT_BLOCKED_ERROR = "content_blocked";

type Rule = { reason: ContentModerationReason; patterns: RegExp[] };

const RULES: Rule[] = [
  {
    reason: "sexual_minors",
    patterns: [
      /\b(?:child|kid|minor|underage)\s+(?:porn|nudes?|sex)\b/,
      /\b(?:porn|nudes?|sex)\s+(?:with\s+)?(?:a\s+)?(?:child|kid|minor|underage)\b/,
      /\b(?:porno|nue?|sexe)\s+(?:avec\s+)?(?:un\s+)?(?:enfant|mineur)e?s?\b/,
      /\b(?:enfant|mineur)e?s?\s+(?:porno|nue?s?|sexe)\b/,
    ],
  },
  {
    reason: "sexual_explicit",
    patterns: [
      /\b(?:childporn|pornography|pornographique|pornographie|revengeporn)\b/,
      /\b(?:send|envoie)\s+(?:me\s+|moi\s+)?(?:your\s+|tes?\s+)?nudes?\b/,
      /\b(?:sexual services?|services? sexuels?)\b/,
    ],
  },
  {
    reason: "hate",
    patterns: [
      /\b(?:white power|heil hitler|race war|ethnic cleansing)\b/,
      /\b(?:suprematie blanche|nettoyage ethnique|mort aux (?:juifs|musulmans|noirs|arabes|gays))\b/,
      /\b(?:gas|exterminate|kill)\s+(?:all\s+)?(?:jews|muslims|blacks|arabs|gays)\b/,
    ],
  },
  {
    reason: "violent_threat",
    patterns: [
      /\b(?:i will|i m going to|im going to)\s+(?:kill|murder|shoot|stab)\s+you\b/,
      /\b(?:je vais|j vais)\s+(?:te\s+)?(?:tuer|abattre|poignarder)\b/,
      /\b(?:death threat|menace de mort)\b/,
    ],
  },
  {
    reason: "self_harm",
    patterns: [
      /\b(?:kill yourself|go kill yourself|you should kill yourself)\b/,
      /\b(?:suicide toi|va te suicider|tue toi)\b/,
    ],
  },
  {
    reason: "illegal_goods",
    patterns: [
      /\b(?:cocaine|heroin|fentanyl|methamphetamine)\s+(?:for sale|a vendre|livraison)\b/,
      /\b(?:gun|firearm|arme a feu|pistolet)\s+(?:for sale|a vendre|sans permis)\b/,
      /\b(?:fake passport|stolen passport|faux passeport|passeport vole)\b/,
    ],
  },
  {
    reason: "fraud",
    patterns: [
      /\b(?:stolen credit card|stolen card|carte bancaire volee|carte volee)\b/,
      /\b(?:buy|sell|acheter|vendre)\s+(?:a\s+|une?\s+)?(?:verified\s+)?(?:bank|paypal|stripe)\s+account\b/,
      /\b(?:guaranteed profit|profit garanti|double ton argent|double your money)\b/,
    ],
  },
];

export function normalizeModerationText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[@]/g, "a")
    .replace(/[€3]/g, "e")
    .replace(/[1|]/g, "i")
    .replace(/[0]/g, "o")
    .replace(/[$5]/g, "s")
    .replace(/[7]/g, "t")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function moderateUserText(value: string | null | undefined): ContentModerationResult {
  const normalized = normalizeModerationText(value ?? "");
  if (!normalized) return { allowed: true };
  for (const rule of RULES) {
    if (rule.patterns.some((pattern) => pattern.test(normalized))) {
      return { allowed: false, reason: rule.reason };
    }
  }
  return { allowed: true };
}

export function assertUserTextAllowed(...values: Array<string | null | undefined>): void {
  for (const value of values) {
    const result = moderateUserText(value);
    if (!result.allowed) {
      throw new Error(`${CONTENT_BLOCKED_ERROR}:${result.reason}`);
    }
  }
}

export function isContentBlockedError(value: unknown): boolean {
  const message =
    value instanceof Error
      ? value.message
      : typeof value === "string"
        ? value
        : typeof value === "object" && value !== null && "message" in value
          ? String((value as { message?: unknown }).message ?? "")
          : "";
  return message.includes(CONTENT_BLOCKED_ERROR);
}
