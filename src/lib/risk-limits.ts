/**
 * Anti-fraud limits by risk tier.
 * Must stay aligned with kidiplus.com `src/lib/risk-limits.ts`
 * and SQL `risk_payout_caps` / `request_payout`.
 */

import { normalizeCurrency, type Currency } from "./money";

/** new = unverified · trusted = badge · kyc = ID verified · restricted = admin freeze */
export type RiskTier = "new" | "trusted" | "kyc" | "restricted";

/**
 * Payout caps (~USD tiers):
 * new: $500/day · $1,500/week
 * trusted: $1,000/day · $2,500/week
 * kyc: $2,000/day · $5,000/week
 */
const PAYOUT_DAILY: Record<"new" | "trusted" | "kyc", Record<Currency, number>> = {
  new: { EUR: 500, CAD: 500, XOF: 328_000, USD: 500, GBP: 450 },
  trusted: { EUR: 1_000, CAD: 1_000, XOF: 656_000, USD: 1_000, GBP: 900 },
  kyc: { EUR: 2_000, CAD: 2_000, XOF: 1_312_000, USD: 2_000, GBP: 1_800 },
};

const PAYOUT_WEEKLY: Record<"new" | "trusted" | "kyc", Record<Currency, number>> = {
  new: { EUR: 1_500, CAD: 1_500, XOF: 984_000, USD: 1_500, GBP: 1_350 },
  trusted: { EUR: 2_500, CAD: 2_500, XOF: 1_640_000, USD: 2_500, GBP: 2_250 },
  kyc: { EUR: 5_000, CAD: 5_000, XOF: 3_280_000, USD: 5_000, GBP: 4_500 },
};

function activeTier(tier: RiskTier): "new" | "trusted" | "kyc" | null {
  if (tier === "restricted") return null;
  if (tier === "kyc") return "kyc";
  if (tier === "trusted") return "trusted";
  return "new";
}

export function riskTierFromProfile(p: {
  isVerified?: boolean | null;
  is_verified?: boolean | null;
  kycVerified?: boolean | null;
  kyc_verified?: boolean | null;
  riskRestricted?: boolean | null;
  risk_restricted?: boolean | null;
} | null | undefined): RiskTier {
  if (!p) return "new";
  if (p.riskRestricted || p.risk_restricted) return "restricted";
  if (p.kycVerified || p.kyc_verified) return "kyc";
  if (p.isVerified || p.is_verified) return "trusted";
  return "new";
}

export function payoutDailyCap(tier: RiskTier, currency: string | null | undefined): number {
  const t = activeTier(tier);
  if (!t) return 0;
  return PAYOUT_DAILY[t][normalizeCurrency(currency)];
}

export function payoutWeeklyCap(tier: RiskTier, currency: string | null | undefined): number {
  const t = activeTier(tier);
  if (!t) return 0;
  return PAYOUT_WEEKLY[t][normalizeCurrency(currency)];
}
