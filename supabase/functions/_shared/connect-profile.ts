import type Stripe from "https://esm.sh/stripe@16.8.0?target=deno";

/** Same values as kidiplus.com `profiles.connect_status`. */
export type ConnectLedgerStatus = "none" | "pending" | "active" | "restricted";

/**
 * Mirror Stripe Express state the way kidiplus.com does.
 * `request_payout` only accepts stripe_connect when connect_status = 'active'.
 *
 * Test accounts must never be stored as `active`: the RPC would debit live
 * seller_balances, then a live Transfer on kidiplus.com would fail.
 */
export function connectStatusFromAccount(acc: {
  payouts_enabled?: boolean | null;
  details_submitted?: boolean | null;
  livemode?: boolean | null;
  requirements?: {
    disabled_reason?: string | null;
    currently_due?: string[] | null;
    past_due?: string[] | null;
  } | null;
}): ConnectLedgerStatus {
  const currentlyDue = acc.requirements?.currently_due ?? [];
  const pastDue = acc.requirements?.past_due ?? [];
  let status: ConnectLedgerStatus = "pending";
  if (acc.payouts_enabled) status = "active";
  else if (acc.details_submitted && currentlyDue.length === 0 && pastDue.length === 0) {
    status = "active";
  } else if (pastDue.length > 0 || acc.requirements?.disabled_reason) {
    status = "restricted";
  }
  if (acc.livemode === false && status === "active") return "pending";
  return status;
}

export function connectReadyPatch(account: Stripe.Account) {
  const status = connectStatusFromAccount(account);
  return {
    stripe_account_id: account.id,
    stripe_connect_id: account.id,
    stripe_payouts_enabled: Boolean(account.payouts_enabled) && account.livemode !== false,
    stripe_requirements_due: account.requirements?.currently_due ?? [],
    connect_status: status,
    connect_charges_enabled: Boolean(account.charges_enabled),
    connect_payouts_enabled: Boolean(account.payouts_enabled),
    connect_updated_at: new Date().toISOString(),
  };
}

export function connectClearPatch() {
  return {
    stripe_account_id: null,
    stripe_connect_id: null,
    stripe_payouts_enabled: false,
    stripe_requirements_due: null,
    connect_status: "none",
    connect_charges_enabled: false,
    connect_payouts_enabled: false,
    connect_updated_at: new Date().toISOString(),
  };
}

export function connectPendingPatch(accountId: string) {
  return {
    stripe_account_id: accountId,
    stripe_connect_id: accountId,
    stripe_payouts_enabled: false,
    connect_status: "pending",
    connect_charges_enabled: false,
    connect_payouts_enabled: false,
    connect_updated_at: new Date().toISOString(),
  };
}
