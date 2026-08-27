import { formatMoney, normalizeCurrency, type Currency } from "./money";
import { supabase } from "./supabase";
import { formatRelative } from "./time";

export type WalletRow = {
  user_id: string;
  balance: number;
  currency: string;
  updated_at?: string;
};

export type WalletTxType = "topup" | "purchase" | "refund" | "adjustment" | "gift" | "withdrawal";

export type WalletTxView = {
  id: string;
  type: WalletTxType;
  amount: number;
  currency: Currency;
  time: string;
};

export async function fetchMyWallet(userId: string): Promise<WalletRow | null> {
  const { data, error } = await supabase
    .from("wallets")
    .select("user_id, balance, currency, updated_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return data as WalletRow;
}

export async function fetchMyWalletTransactions(userId: string, limit = 50): Promise<WalletTxView[]> {
  const { data, error } = await supabase
    .from("wallet_transactions")
    .select("id, type, amount, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  const wallet = await fetchMyWallet(userId);
  const currency = normalizeCurrency(wallet?.currency);
  return (data as Array<{ id: string; type: WalletTxType; amount: number; created_at: string }>).map((row) => ({
    id: row.id,
    type: row.type,
    amount: Number(row.amount) || 0,
    currency,
    time: formatRelative(row.created_at),
  }));
}

export function formatWalletAmount(amount: number, currency: string): string {
  const abs = formatMoney(Math.abs(amount), currency);
  if (amount > 0) return `+${abs}`;
  if (amount < 0) return `-${abs}`;
  return abs;
}
