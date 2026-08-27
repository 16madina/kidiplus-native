import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import {
  ArrowDownToLine,
  Coins,
  Copy,
  KeyRound,
  Package,
  Share2,
  Sparkles,
  Users,
} from "lucide-react-native";
import { OverlayHeader, MockBanner } from "../components/OverlayHeader";
import { Press } from "../components/Press";
import { ReferralWalletCard } from "../components/referral/ReferralWalletCard";
import { ScratchCard } from "../components/referral/ScratchCard";
import { useAuth } from "../context/auth";
import { useAppTheme } from "../context/theme";
import { formatMoney, normalizeCurrency } from "../lib/money";
import {
  buildShareMessage,
  claimPromoCode,
  fetchMyPromoCodeRequest,
  fetchMyPromoCodes,
  fetchMyReferralBalance,
  fetchMyReferralEarnings,
  formatTotals,
  submitPromoCodeRequest,
  subscribeMyReferralBalance,
  type MyPromoCodeRequest,
  type PromoCodeStats,
  type ReferralBalance,
  type ReferralEarningRow,
} from "../lib/referrals";
import { GOLD, NAVY } from "../theme";

export function ReferralScreen() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const [codes, setCodes] = useState<PromoCodeStats[] | null>(null);
  const [earnings, setEarnings] = useState<ReferralEarningRow[]>([]);
  const [balance, setBalance] = useState<ReferralBalance | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const fallbackCurrency = user?.walletCurrency ?? "EUR";

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  };

  const reload = async () => {
    const [c, e, b] = await Promise.all([
      fetchMyPromoCodes(),
      fetchMyReferralEarnings(50),
      user ? fetchMyReferralBalance(user.id) : Promise.resolve(null),
    ]);
    setCodes(c);
    setEarnings(e);
    setBalance(b);
  };

  useEffect(() => {
    setCodes(null);
    void reload();
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    return subscribeMyReferralBalance(user.id, () => {
      void reload();
    });
  }, [user?.id]);

  const copy = async (text: string) => {
    try {
      await Share.share({ message: text });
      flash(t("common.copied"));
    } catch {
      flash(t("common.copied"));
    }
  };

  const shareCode = async (code: string) => {
    const msg = buildShareMessage(code, i18n.language);
    try {
      await Share.share({ message: msg, title: "KiDi+" });
    } catch {
      flash(t("common.copied"));
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <OverlayHeader title={t("referral.title")} />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {codes === null ? (
          <View style={styles.loader}>
            <ActivityIndicator color={GOLD} />
          </View>
        ) : codes.length === 0 ? (
          <ClaimBlock onClaimed={reload} onToast={flash} />
        ) : (
          <>
            <ReferralWalletCard balance={balance} fallbackCurrency={fallbackCurrency} />
            <Press
              disabled={!balance || balance.available <= 0}
              onPress={() => flash(t("referral.wallet.withdrawWeb"))}
              style={[styles.withdraw, (!balance || balance.available <= 0) && { opacity: 0.5 }]}
            >
              <ArrowDownToLine size={15} color={NAVY} />
              <Text style={styles.withdrawTxt}>
                {balance && balance.available > 0
                  ? t("referral.wallet.withdraw")
                  : t("referral.wallet.withdrawEmpty")}
              </Text>
            </Press>
            <Text style={[styles.intro, { color: colors.mutedForeground }]}>{t("referral.intro")}</Text>
            {codes.map((c) => (
              <View key={c.id} style={styles.codeCard}>
                <View style={styles.codePad}>
                  <Text style={styles.codeLbl}>{t("referral.myCode")}</Text>
                  <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
                    <Text style={styles.code}>{c.code}</Text>
                    {!c.active ? <Text style={styles.inactive}>{t("referral.inactive")}</Text> : null}
                  </View>
                  <View style={styles.codeBtns}>
                    <Press onPress={() => void copy(c.code)} style={styles.copyBtn}>
                      <Copy size={14} color="#fff" />
                      <Text style={styles.copyTxt}>{t("common.copy")}</Text>
                    </Press>
                    <Press onPress={() => void shareCode(c.code)} style={styles.shareBtn}>
                      <Share2 size={14} color={NAVY} />
                      <Text style={styles.shareTxt}>{t("common.share")}</Text>
                    </Press>
                  </View>
                </View>
                <View style={styles.stats}>
                  <Stat icon={<Users size={14} color="#fff" />} label={t("referral.signups")} value={String(c.signups)} />
                  <Stat
                    icon={<Package size={14} color="#fff" />}
                    label={t("referral.ordersCredited")}
                    value={String(c.orders_credited)}
                  />
                  <Stat
                    icon={<Coins size={14} color="#fff" />}
                    label={t("referral.totals")}
                    value={formatTotals(c.totals, i18n.language)}
                  />
                </View>
              </View>
            ))}
            <Text style={[styles.recent, { color: colors.foreground }]}>{t("referral.recent")}</Text>
            {earnings.length === 0 ? (
              <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>{t("referral.noEarnings")}</Text>
            ) : (
              <View style={[styles.earnBox, { borderColor: colors.border }]}>
                {earnings.map((e, i) => (
                  <View
                    key={e.id}
                    style={[styles.earnRow, i > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border } : null]}
                  >
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[styles.earnName, { color: colors.foreground }]} numberOfLines={1}>
                        {e.referred_name || e.referred_handle || "—"}
                      </Text>
                      <Text style={{ color: colors.mutedForeground, fontSize: 11 }} numberOfLines={1}>
                        {e.item_name || "—"} · {new Date(e.created_at).toLocaleDateString(i18n.language)}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.earnAmt,
                        { color: colors.foreground },
                        e.status === "reversed" ? { color: colors.mutedForeground, textDecorationLine: "line-through" } : null,
                      ]}
                    >
                      +{formatMoney(e.amount, normalizeCurrency(e.currency), i18n.language)}
                    </Text>
                  </View>
                ))}
              </View>
            )}
            <Text style={[styles.hint, { color: colors.mutedForeground }]}>{t("referral.walletHint")}</Text>
          </>
        )}
      </ScrollView>
      <MockBanner text={toast} />
    </View>
  );
}

function ClaimBlock({
  onClaimed,
  onToast,
}: {
  onClaimed: () => void | Promise<void>;
  onToast: (msg: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const { colors } = useAppTheme();
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);

  const onChange = (v: string) => {
    const cleaned = v.toUpperCase().replace(/[^A-Z0-9]/g, "");
    const body = cleaned.startsWith("KIDI") ? cleaned.slice(4) : cleaned;
    const raw = body.slice(0, 8);
    setToken(raw.length > 4 ? `${raw.slice(0, 4)}-${raw.slice(4)}` : raw);
  };

  const submit = async () => {
    if (!/^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(token)) {
      onToast(t("referral.claim.badFormat"));
      return;
    }
    setBusy(true);
    const res = await claimPromoCode(`KIDI-${token}`);
    setBusy(false);
    if (!res.ok) {
      const map: Record<string, string> = {
        invalid_token: t("referral.claim.errInvalid"),
        already_claimed: t("referral.claim.errClaimed"),
        unauthorized: t("referral.claim.errAuth"),
      };
      onToast(map[res.error] ?? res.error);
      return;
    }
    const totals = res.backfilled_totals ?? {};
    const totalStr = formatTotals(totals, i18n.language);
    onToast(
      totalStr !== "—"
        ? t("referral.claim.okWithBackfill", { code: res.code, amount: totalStr })
        : t("referral.claim.ok", { code: res.code }),
    );
    void onClaimed();
  };

  return (
    <View>
      <Text style={[styles.claimTitle, { color: colors.foreground }]}>{t("referral.claim.scratchTitle")}</Text>
      <Text style={[styles.claimSub, { color: colors.mutedForeground }]}>{t("referral.claim.scratchSubtitle")}</Text>
      <ScratchCard
        brandLabel={t("referral.claim.partnerLabel")}
        scratchLabel={t("referral.claim.scratchHint")}
        skipLabel={t("referral.claim.scratchSkip")}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <KeyRound size={12} color="#6B7289" />
          <Text style={{ fontSize: 12, fontWeight: "700", color: "#6B7289" }}>{t("referral.claim.tokenLabel")}</Text>
        </View>
        <View style={styles.tokenRow}>
          <View style={styles.kidi}>
            <Text style={styles.kidiTxt}>KIDI-</Text>
          </View>
          <TextInput
            value={token}
            onChangeText={onChange}
            placeholder="XXXX-XXXX"
            placeholderTextColor="#9AA0B4"
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={9}
            style={styles.tokenInput}
          />
        </View>
        <Press disabled={busy} onPress={() => void submit()} style={[styles.claimCta, busy && { opacity: 0.55 }]}>
          {busy ? <ActivityIndicator color={GOLD} /> : <Text style={styles.claimCtaTxt}>{t("referral.claim.cta")}</Text>}
        </Press>
      </ScratchCard>

      <View style={styles.orRow}>
        <View style={[styles.orLine, { backgroundColor: colors.border }]} />
        <Text style={[styles.orTxt, { color: colors.mutedForeground }]}>{t("common.or")}</Text>
        <View style={[styles.orLine, { backgroundColor: colors.border }]} />
      </View>

      <RequestCodeBlock onToast={onToast} />
      <Text style={[styles.hint, { color: colors.mutedForeground }]}>{t("referral.claim.notInfluencer")}</Text>
    </View>
  );
}

function RequestCodeBlock({ onToast }: { onToast: (msg: string) => void }) {
  const { t } = useTranslation();
  const { colors, dark } = useAppTheme();
  const [req, setReq] = useState<MyPromoCodeRequest | null | undefined>(undefined);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => setReq(await fetchMyPromoCodeRequest());
  useEffect(() => {
    void load();
  }, []);

  const submit = async () => {
    setBusy(true);
    const res = await submitPromoCodeRequest(message);
    setBusy(false);
    if (!res.ok) {
      const map: Record<string, string> = {
        already_pending: t("referral.claim.request.errPending"),
        already_has_code: t("referral.claim.request.errHasCode"),
        unauthorized: t("referral.claim.errAuth"),
      };
      onToast(map[res.error] ?? res.error);
      return;
    }
    onToast(t("referral.claim.request.sent"));
    setMessage("");
    await load();
  };

  if (req === undefined) return null;
  const isPending = req?.status === "pending";
  const isRejected = req?.status === "rejected";

  return (
    <View style={[styles.reqBox, { borderColor: colors.border }]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Sparkles size={13} color={GOLD} />
        <Text style={[styles.reqTitle, { color: colors.foreground }]}>{t("referral.claim.request.title")}</Text>
      </View>
      {isPending ? (
        <View style={styles.pending}>
          <Text style={styles.pendingTitle}>⏳ {t("referral.claim.request.pendingBadge")}</Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 4 }}>
            {t("referral.claim.request.pendingHint")}
          </Text>
          {req?.message ? (
            <Text style={{ color: colors.mutedForeground, fontSize: 11, fontStyle: "italic", marginTop: 8 }}>
              “{req.message}”
            </Text>
          ) : null}
        </View>
      ) : (
        <>
          {isRejected ? (
            <View style={styles.rejected}>
              <Text style={styles.rejectedTitle}>✕ {t("referral.claim.request.rejectedBadge")}</Text>
              <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 4 }}>
                {t("referral.claim.request.rejectedHint")}
              </Text>
              {req?.admin_note ? (
                <Text style={{ fontSize: 11, marginTop: 8, color: colors.foreground }}>
                  {t("referral.claim.request.reason")} {req.admin_note}
                </Text>
              ) : null}
            </View>
          ) : null}
          <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 12 }}>
            {t("referral.claim.request.intro")}
          </Text>
          <TextInput
            value={message}
            onChangeText={(v) => setMessage(v.slice(0, 500))}
            placeholder={t("referral.claim.request.placeholder")}
            placeholderTextColor={colors.mutedForeground}
            multiline
            style={[
              styles.msg,
              {
                color: colors.foreground,
                borderColor: colors.border,
                backgroundColor: dark ? "rgba(255,255,255,0.04)" : "#fff",
              },
            ]}
          />
          <Text style={{ textAlign: "right", fontSize: 10, color: colors.mutedForeground }}>{message.length}/500</Text>
          <Press disabled={busy} onPress={() => void submit()} style={[styles.send, busy && { opacity: 0.55 }]}>
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.sendTxt}>{t("referral.claim.request.cta")}</Text>
            )}
          </Press>
        </>
      )}
    </View>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <View style={styles.statLbl}>
        {icon}
        <Text style={styles.statLblTxt}>{label}</Text>
      </View>
      <Text style={styles.statVal} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { padding: 16, paddingBottom: 48, gap: 12 },
  loader: { height: 160, alignItems: "center", justifyContent: "center" },
  withdraw: {
    height: 44,
    borderRadius: 16,
    backgroundColor: GOLD,
    flexDirection: "row",
    gap: 8,
  },
  withdrawTxt: { color: NAVY, fontWeight: "800", fontSize: 14 },
  intro: { fontSize: 13, lineHeight: 18 },
  codeCard: { borderRadius: 24, overflow: "hidden", backgroundColor: NAVY },
  codePad: { padding: 20 },
  codeLbl: { color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: "700", letterSpacing: 1.6, textTransform: "uppercase" },
  code: { color: GOLD, fontSize: 28, fontWeight: "900", letterSpacing: 1, marginTop: 4 },
  inactive: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "800",
    backgroundColor: "rgba(255,255,255,0.1)",
    overflow: "hidden",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  codeBtns: { flexDirection: "row", gap: 8, marginTop: 16 },
  copyBtn: {
    flex: 1,
    height: 40,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.1)",
    flexDirection: "row",
    gap: 6,
  },
  copyTxt: { color: "#fff", fontWeight: "700", fontSize: 13 },
  shareBtn: { flex: 1, height: 40, borderRadius: 16, backgroundColor: GOLD, flexDirection: "row", gap: 6 },
  shareTxt: { color: NAVY, fontWeight: "800", fontSize: 13 },
  stats: { flexDirection: "row" },
  stat: { flex: 1, backgroundColor: "#141B34", padding: 12 },
  statLbl: { flexDirection: "row", alignItems: "center", gap: 4, opacity: 0.7 },
  statLblTxt: { color: "#fff", fontSize: 10, fontWeight: "700", textTransform: "uppercase" },
  statVal: { color: "#fff", fontSize: 13, fontWeight: "800", marginTop: 4 },
  recent: { fontSize: 15, fontWeight: "800", marginTop: 8 },
  earnBox: { borderWidth: 1, borderRadius: 16, overflow: "hidden" },
  earnRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
  earnName: { fontSize: 13, fontWeight: "700" },
  earnAmt: { fontSize: 13, fontWeight: "800", fontVariant: ["tabular-nums"] },
  hint: { fontSize: 11, textAlign: "center", marginTop: 8, lineHeight: 16 },
  claimTitle: { fontSize: 20, fontWeight: "900", textAlign: "center" },
  claimSub: { fontSize: 12, textAlign: "center", marginTop: 4, marginBottom: 12 },
  tokenRow: {
    marginTop: 8,
    flexDirection: "row",
    overflow: "hidden",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: "rgba(255,255,255,0.7)",
  },
  kidi: {
    paddingHorizontal: 12,
    justifyContent: "center",
    backgroundColor: "rgba(212,175,55,0.18)",
  },
  kidiTxt: { color: "#8A6A1F", fontSize: 16, fontWeight: "900", letterSpacing: 2 },
  tokenInput: {
    flex: 1,
    minHeight: 48,
    textAlign: "center",
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 4,
    color: "#1A130A",
  },
  claimCta: { marginTop: 12, height: 44, borderRadius: 16, backgroundColor: NAVY },
  claimCtaTxt: { color: GOLD, fontWeight: "800", fontSize: 14 },
  orRow: { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 16 },
  orLine: { flex: 1, height: StyleSheet.hairlineWidth },
  orTxt: { fontSize: 11, fontWeight: "800", letterSpacing: 1.6, textTransform: "uppercase" },
  reqBox: { borderWidth: 1, borderRadius: 16, padding: 16 },
  reqTitle: { fontSize: 13, fontWeight: "800" },
  pending: { marginTop: 12, borderRadius: 12, backgroundColor: "rgba(245,158,11,0.12)", padding: 12 },
  pendingTitle: { color: "#B45309", fontWeight: "800", fontSize: 12 },
  rejected: { marginTop: 12, borderRadius: 12, backgroundColor: "rgba(239,68,68,0.1)", padding: 12 },
  rejectedTitle: { color: "#B91C1C", fontWeight: "800", fontSize: 12 },
  msg: {
    marginTop: 8,
    minHeight: 96,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    textAlignVertical: "top",
  },
  send: { marginTop: 8, height: 44, borderRadius: 16, backgroundColor: NAVY },
  sendTxt: { color: "#fff", fontWeight: "800", fontSize: 14 },
});
