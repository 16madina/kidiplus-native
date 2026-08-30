import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import {
  BadgeCheck,
  Bell,
  Clapperboard,
  CreditCard,
  Flag,
  HeartHandshake,
  LayoutDashboard,
  Radio,
  RefreshCw,
  Search,
  Shield,
  Users,
} from "lucide-react-native";
import { OverlayHeader, MockBanner } from "../components/OverlayHeader";
import { Press } from "../components/Press";
import { SurfaceCard } from "../components/SurfaceCard";
import { AdminPrelaunchSimPanel } from "../components/admin/AdminPrelaunchSimPanel";
import { AdminPushPanel } from "../components/admin/AdminPushPanel";
import { AdminTreasuryCard } from "../components/admin/AdminTreasuryCard";
import { PaymentsModeBadge } from "../components/admin/PaymentsModeBadge";
import { PayoutRiskBadge } from "../components/admin/PayoutRiskBadge";
import { useAuth } from "../context/auth";
import { useAppTheme } from "../context/theme";
import { GOLD, NAVY, initials } from "../theme";
import { formatMoney } from "../lib/money";
import { dispatchPaypalPayout } from "../lib/earnings";
import { countryFlag, countryName } from "../lib/countries";
import {
  adminActionReport,
  adminEndLive,
  adminIssueSanction,
  adminProcessPayout,
  adminResolveReport,
  adminSendMessage,
  fetchAdminLives,
  fetchAdminPayouts,
  fetchAdminReports,
  fetchAdminRiskAlerts,
  fetchAdminUsers,
  fetchOverviewStats,
  fetchPendingVerifications,
  firstCurrency,
  resolveAdminRiskAlert,
  reviewVerification,
  setAdminRiskRestricted,
  verificationHandle,
  adminSetVerified,
  type AdminLiveRow,
  type AdminPayoutRow,
  type AdminRiskAlertRow,
  type AdminUserRow,
  type OverviewStats,
  type PendingVerification,
  type ReportRow,
} from "../lib/admin";
import {
  adminCreatePromoCode,
  adminRenewPromoCredits,
  adminReviewPromoCodeRequest,
  adminSetPromoActive,
  buildInfluencerOnboardingMessage,
  fetchAdminPromoCodeRequests,
  fetchAdminPromoCodes,
  formatTotals,
  type AdminPromoCodeRequestRow,
  type AdminPromoCodeRow,
} from "../lib/referrals";

type Tab =
  | "overview"
  | "users"
  | "push"
  | "reports"
  | "risk"
  | "verify"
  | "payments"
  | "lives"
  | "sim"
  | "referral"
  | "media";

const TABS: Array<{ id: Tab; labelKey: string; fallback: string; Icon: typeof LayoutDashboard }> = [
  { id: "overview", labelKey: "admin.tabs.overview", fallback: "Vue", Icon: LayoutDashboard },
  { id: "users", labelKey: "admin.tabs.users", fallback: "Users", Icon: Users },
  { id: "push", labelKey: "admin.tabs.push", fallback: "Push", Icon: Bell },
  { id: "reports", labelKey: "admin.tabs.reports", fallback: "Reports", Icon: Flag },
  { id: "risk", labelKey: "admin.tabs.risk", fallback: "Risque", Icon: Shield },
  { id: "verify", labelKey: "admin.tabs.verify", fallback: "Certifs", Icon: BadgeCheck },
  { id: "payments", labelKey: "admin.tabs.payments", fallback: "Paiements", Icon: CreditCard },
  { id: "lives", labelKey: "admin.tabs.lives", fallback: "Lives", Icon: Radio },
  { id: "sim", labelKey: "admin.tabs.sim", fallback: "Simu", Icon: Clapperboard },
  { id: "referral", labelKey: "admin.tabs.referral", fallback: "Parrainage", Icon: HeartHandshake },
  { id: "media", labelKey: "admin.tabs.media", fallback: "Vidéos", Icon: RefreshCw },
];

export function AdminDashboardScreen() {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("overview");
  const [toast, setToast] = useState<string | null>(null);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };

  if (!user?.isAdmin) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <OverlayHeader title={t("admin.title")} />
        <Text style={{ color: colors.mutedForeground, textAlign: "center", marginTop: 40, paddingHorizontal: 24 }}>
          {t("admin.onlyAdmins")}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <OverlayHeader title={t("admin.title")} />
      <PaymentsModeBadge />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
        {TABS.map((x) => {
          const active = tab === x.id;
          return (
            <Press key={x.id} onPress={() => setTab(x.id)} style={styles.tabBtn}>
              <View style={[styles.tabPill, active ? styles.tabOn : { backgroundColor: colors.muted }]}>
                <x.Icon size={13} color={active ? "#fff" : colors.foreground} />
                <Text style={{ fontWeight: "800", fontSize: 12, color: active ? "#fff" : colors.foreground }}>
                  {t(x.labelKey, { defaultValue: x.fallback })}
                </Text>
              </View>
            </Press>
          );
        })}
      </ScrollView>
      <ScrollView contentContainerStyle={styles.body}>
        {tab === "overview" ? <OverviewTab onGo={setTab} /> : null}
        {tab === "users" ? <UsersTab flash={flash} /> : null}
        {tab === "reports" ? <ReportsTab flash={flash} /> : null}
        {tab === "risk" ? <RiskTab flash={flash} /> : null}
        {tab === "verify" ? <VerifyTab flash={flash} /> : null}
        {tab === "payments" ? <PaymentsTab flash={flash} /> : null}
        {tab === "lives" ? <LivesTab flash={flash} /> : null}
        {tab === "sim" ? <AdminPrelaunchSimPanel flash={flash} /> : null}
        {tab === "referral" ? <ReferralAdminTab flash={flash} /> : null}
        {tab === "push" ? <AdminPushPanel flash={flash} /> : null}
        {tab === "media" ? (
          <SurfaceCard>
            <Text style={{ color: colors.foreground, fontWeight: "600" }}>{t("admin.webOnly")}</Text>
          </SurfaceCard>
        ) : null}
      </ScrollView>
      <MockBanner text={toast} />
    </View>
  );
}

function SectionTitle({ text }: { text: string }) {
  const { colors } = useAppTheme();
  return (
    <Text
      style={{
        fontSize: 11,
        fontWeight: "700",
        letterSpacing: 0.6,
        textTransform: "uppercase",
        color: colors.mutedForeground,
        marginBottom: 8,
        marginTop: 4,
      }}
    >
      {text}
    </Text>
  );
}

function StatTile({
  label,
  value,
  onPress,
  accent,
}: {
  label: string;
  value: string;
  onPress?: () => void;
  accent?: string;
}) {
  const { colors } = useAppTheme();
  return (
    <SurfaceCard onPress={onPress} style={{ flexGrow: 1, flexBasis: "46%", minWidth: "46%" }}>
      <Text style={{ fontSize: 22, fontWeight: "800", color: accent || colors.foreground }}>{value}</Text>
      <Text style={{ fontSize: 11, color: colors.mutedForeground, marginTop: 2 }}>{label}</Text>
    </SurfaceCard>
  );
}

function OverviewTab({ onGo }: { onGo: (t: Tab) => void }) {
  const { t, i18n } = useTranslation();
  const { colors } = useAppTheme();
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [openReports, setOpenReports] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void Promise.all([fetchOverviewStats(), fetchAdminReports("open")]).then(([s, reports]) => {
      setStats(s);
      setOpenReports(reports.length);
      setLoading(false);
    });
  }, []);

  if (loading) return <ActivityIndicator color={GOLD} />;
  if (!stats) {
    return <Text style={{ color: colors.mutedForeground }}>{t("admin.empty")}</Text>;
  }

  const gmv = firstCurrency(stats.gmv);
  const payouts = stats.pending_payouts?.count ?? 0;
  const fmt = (n: number) => {
    try {
      return new Intl.NumberFormat(i18n.language).format(n);
    } catch {
      return String(n);
    }
  };

  return (
    <View style={{ gap: 12 }}>
      <AdminTreasuryCard />
      <View>
        <SectionTitle text={t("admin.toDo.title")} />
        <View style={styles.grid}>
          <StatTile
            label={t("admin.toDo.reports")}
            value={fmt(openReports)}
            accent={openReports > 0 ? "#C62828" : undefined}
            onPress={() => onGo("reports")}
          />
          <StatTile
            label={t("admin.toDo.payouts")}
            value={fmt(payouts)}
            accent={payouts > 0 ? "#B45309" : undefined}
            onPress={() => onGo("payments")}
          />
        </View>
      </View>
      <View>
        <SectionTitle text={t("admin.kpi.gmv")} />
        <SurfaceCard>
          <Text style={{ fontSize: 22, fontWeight: "800", color: colors.foreground }}>
            {formatMoney(gmv.amount, gmv.currency, i18n.language)}
          </Text>
        </SurfaceCard>
      </View>
      <View style={styles.grid}>
        <StatTile label={t("admin.kpi.users")} value={fmt(stats.counts.users_total)} onPress={() => onGo("users")} />
        <StatTile label={t("admin.kpi.sellers")} value={fmt(stats.counts.sellers)} />
        <StatTile label={t("admin.kpi.livesLive")} value={fmt(stats.counts.lives_live)} onPress={() => onGo("lives")} />
        <StatTile label={t("admin.kpi.ordersPaid")} value={fmt(stats.counts.orders_paid)} />
      </View>
    </View>
  );
}

function UsersTab({ flash }: { flash: (s: string) => void }) {
  const { t, i18n } = useTranslation();
  const { colors } = useAppTheme();
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (search: string) => {
    setLoading(true);
    const res = await fetchAdminUsers(search.trim() || null);
    setRows(res.rows);
    setLoading(false);
  }, []);

  useEffect(() => {
    const id = setTimeout(() => void load(q), 280);
    return () => clearTimeout(id);
  }, [q, load]);

  const sanction = (u: AdminUserRow, type: "warning" | "ban") => {
    const title = type === "warning" ? t("moderation.userDetail.warn") : t("moderation.userDetail.ban");
    Alert.alert(title, `@${u.handle}`, [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: title,
        style: "destructive",
        onPress: () => {
          void adminIssueSanction(
            u.id,
            type,
            type === "warning" ? "Avertissement admin" : "Bannissement admin",
          ).then(() => flash("OK"));
        },
      },
    ]);
  };

  return (
    <View style={{ gap: 10 }}>
      <View style={[styles.search, { borderColor: colors.border, backgroundColor: colors.card }]}>
        <Search size={14} color={colors.mutedForeground} />
        <TextInput
          value={q}
          onChangeText={setQ}
          onSubmitEditing={() => void load(q)}
          placeholder={t("admin.users.searchPh")}
          placeholderTextColor={colors.mutedForeground}
          autoCapitalize="none"
          style={[styles.searchInput, { color: colors.foreground }]}
        />
      </View>
      {loading ? <ActivityIndicator color={GOLD} /> : null}
      {!loading && rows.length === 0 ? (
        <Text style={{ color: colors.mutedForeground, textAlign: "center", marginTop: 16 }}>{t("admin.users.empty")}</Text>
      ) : null}
      {rows.map((u) => {
        const flag = countryFlag(u.country);
        const cname = countryName(u.country, i18n.language) || u.country || "—";
        return (
          <SurfaceCard key={u.id}>
            <View style={styles.userRow}>
              <View style={[styles.avatar, { backgroundColor: colors.muted }]}>
                <Text style={{ fontWeight: "800", color: colors.foreground }}>{initials(u.display_name || u.handle)}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={{ fontWeight: "700", fontSize: 14, color: colors.foreground }}>
                  {u.display_name}
                </Text>
                <Text numberOfLines={1} style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 1 }}>
                  @{u.handle}
                </Text>
                <Text style={{ color: colors.mutedForeground, fontSize: 11, marginTop: 4 }}>
                  {u.is_seller ? t("admin.kpi.sellers") : "Acheteur"}
                  {u.is_admin ? " · ADMIN" : ""}
                  {" · "}
                  {flag ? `${flag} ` : ""}
                  {cname}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={{ fontSize: 12, fontWeight: "700", color: colors.foreground }}>
                  {formatMoney(Number(u.wallet_balance), u.wallet_currency || "EUR", i18n.language)}
                </Text>
                <Text style={{ fontSize: 10, color: colors.mutedForeground }}>
                  {u.orders_count} / {u.sales_count}
                </Text>
              </View>
            </View>
            <View style={styles.rowBtns}>
              <ActionPill label={t("moderation.userDetail.warn")} onPress={() => sanction(u, "warning")} />
              <ActionPill label={t("moderation.userDetail.ban")} danger onPress={() => sanction(u, "ban")} />
              <ActionPill
                label={t("admin.users.grantVerify")}
                onPress={() => {
                  void adminSetVerified(u.id, true).then((ok) => flash(ok ? "✓" : t("common.error", "Erreur")));
                }}
              />
              <ActionPill
                label={t("admin.users.revokeVerify")}
                danger
                onPress={() => {
                  void adminSetVerified(u.id, false).then((ok) => flash(ok ? "OK" : t("common.error", "Erreur")));
                }}
              />
            </View>
          </SurfaceCard>
        );
      })}
    </View>
  );
}

function ReportsTab({ flash }: { flash: (s: string) => void }) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const [rows, setRows] = useState<ReportRow[]>([]);
  useEffect(() => {
    void fetchAdminReports("open").then(setRows);
  }, []);
  return (
    <View style={{ gap: 10 }}>
      {rows.length === 0 ? <Text style={{ color: colors.mutedForeground }}>{t("admin.empty")}</Text> : null}
      {rows.map((r) => (
        <SurfaceCard key={r.id}>
          <Text style={{ fontWeight: "800", color: colors.foreground }}>
            {r.target_type} · {r.reason}
          </Text>
          <Text style={{ color: colors.mutedForeground, marginTop: 4, fontSize: 12 }}>
            @{r.reporter_handle || "?"} → {r.target_label || r.target_type}
          </Text>
          {r.note ? (
            <Text style={{ color: colors.mutedForeground, marginTop: 4, fontSize: 12 }} numberOfLines={3}>
              {r.note}
            </Text>
          ) : null}
          <View style={styles.rowBtns}>
            <ActionPill
              label={t("admin.dismiss", { defaultValue: "Classer" })}
              onPress={async () => {
                await adminResolveReport(r.id, "dismissed");
                setRows((prev) => prev.filter((x) => x.id !== r.id));
                flash("OK");
              }}
            />
            <ActionPill
              label={t("admin.approveRemove", { defaultValue: "Approuver et supprimer" })}
              danger
              onPress={async () => {
                const res = await adminActionReport(r);
                if (!res.ok) {
                  flash(res.error === "need_sql" ? t("admin.takedownNeedSql") : res.error || "Erreur");
                  return;
                }
                setRows((prev) => prev.filter((x) => x.id !== r.id));
                flash(
                  res.removed
                    ? t("admin.takedownDone")
                    : res.error === "need_sql"
                      ? t("admin.takedownNeedSql")
                      : t("admin.takedownMarked"),
                );
              }}
            />
            {r.target_user_id ? (
              <ActionPill
                label={t("moderation.userDetail.warn")}
                onPress={async () => {
                  await adminIssueSanction(r.target_user_id!, "warning", r.reason);
                  flash("OK");
                }}
              />
            ) : null}
          </View>
        </SurfaceCard>
      ))}
    </View>
  );
}

function RiskTab({ flash }: { flash: (s: string) => void }) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const [rows, setRows] = useState<AdminRiskAlertRow[]>([]);
  useEffect(() => {
    void fetchAdminRiskAlerts("open").then(setRows);
  }, []);
  return (
    <View style={{ gap: 10 }}>
      {rows.length === 0 ? <Text style={{ color: colors.mutedForeground }}>{t("admin.risk.empty")}</Text> : null}
      {rows.map((r) => (
        <SurfaceCard key={r.id}>
          <Text style={{ fontWeight: "800", color: colors.foreground }}>{r.kind}</Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>@{r.user_handle || "—"}</Text>
          <View style={styles.rowBtns}>
            <ActionPill
              label={t("admin.risk.resolve")}
              onPress={async () => {
                await resolveAdminRiskAlert(r.id);
                setRows((prev) => prev.filter((x) => x.id !== r.id));
                flash(t("admin.risk.resolved"));
              }}
            />
            {r.user_id ? (
              <ActionPill
                label={r.risk_restricted ? t("admin.risk.unfreeze") : t("admin.risk.freeze")}
                danger={!r.risk_restricted}
                onPress={async () => {
                  await setAdminRiskRestricted(r.user_id!, !r.risk_restricted);
                  flash("OK");
                }}
              />
            ) : null}
          </View>
        </SurfaceCard>
      ))}
    </View>
  );
}

function VerifyTab({ flash }: { flash: (s: string) => void }) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const [rows, setRows] = useState<PendingVerification[]>([]);
  useEffect(() => {
    void fetchPendingVerifications().then(setRows);
  }, []);
  return (
    <View style={{ gap: 10 }}>
      {rows.length === 0 ? <Text style={{ color: colors.mutedForeground }}>{t("admin.empty")}</Text> : null}
      {rows.map((r) => (
        <SurfaceCard key={r.id}>
          <Text style={{ fontWeight: "800", color: colors.foreground }}>@{verificationHandle(r)}</Text>
          {r.message ? <Text style={{ color: colors.mutedForeground, marginTop: 4, fontSize: 13 }}>{r.message}</Text> : null}
          <View style={styles.rowBtns}>
            <ActionPill
              label={t("admin.approve", { defaultValue: "Approuver" })}
              onPress={async () => {
                await reviewVerification(r.id, true);
                setRows((prev) => prev.filter((x) => x.id !== r.id));
                flash("OK");
              }}
            />
            <ActionPill
              label={t("admin.reject")}
              danger
              onPress={async () => {
                await reviewVerification(r.id, false);
                setRows((prev) => prev.filter((x) => x.id !== r.id));
                flash("OK");
              }}
            />
          </View>
        </SurfaceCard>
      ))}
    </View>
  );
}

function paypalEmail(p: AdminPayoutRow): string {
  const d = p.destination ?? {};
  return (d.paypalEmail || d.email || "").trim();
}

function PaymentsTab({ flash }: { flash: (s: string) => void }) {
  const { t, i18n } = useTranslation();
  const { colors } = useAppTheme();
  const [rows, setRows] = useState<AdminPayoutRow[]>([]);
  const load = () => void fetchAdminPayouts("requested").then(setRows);
  useEffect(() => {
    load();
  }, []);
  return (
    <View style={{ gap: 10 }}>
      {rows.length === 0 ? <Text style={{ color: colors.mutedForeground }}>{t("admin.empty")}</Text> : null}
      {rows.map((p) => (
        <SurfaceCard key={p.id}>
          <Text style={{ fontWeight: "800", color: colors.foreground }}>
            @{p.seller_handle || p.seller_name} · {formatMoney(p.amount, p.currency, i18n.language)}
          </Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{p.method} · {p.status}</Text>
          {p.method === "paypal" && paypalEmail(p) ? (
            <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{paypalEmail(p)}</Text>
          ) : null}
          {p.source === "referral" ? (
            <Text style={{ color: GOLD, fontSize: 11, fontWeight: "800", marginTop: 4 }}>
              {t("admin.payouts.sourceReferral")}
            </Text>
          ) : null}
          <PayoutRiskBadge payoutId={p.id} sellerId={p.seller_id} onChanged={load} />
          <View style={styles.rowBtns}>
            {p.method === "paypal" ? (
              <ActionPill
                label={t("admin.paypal.send")}
                onPress={() => {
                  Alert.alert(
                    t("admin.paypal.confirmTitle"),
                    t("admin.paypal.confirmBody"),
                    [
                      { text: t("common.cancel"), style: "cancel" },
                      {
                        text: t("admin.paypal.confirm"),
                        onPress: () => {
                          void dispatchPaypalPayout(p.id).then((r) => {
                            flash(r.ok ? t("admin.paypal.sent") : r.error || t("admin.paypal.failed"));
                            load();
                          });
                        },
                      },
                    ],
                  );
                }}
              />
            ) : null}
            <ActionPill
              label={t("admin.markPaid")}
              onPress={async () => {
                const r = await adminProcessPayout(p.id, "paid");
                flash(r.ok ? t("admin.markedPaid") : r.error || "Erreur");
                load();
              }}
            />
            <ActionPill
              label={t("admin.reject")}
              danger
              onPress={async () => {
                const r = await adminProcessPayout(p.id, "rejected");
                flash(r.ok ? t("admin.markedRejected") : r.error || "Erreur");
                load();
              }}
            />
          </View>
        </SurfaceCard>
      ))}
    </View>
  );
}

function LivesTab({ flash }: { flash: (s: string) => void }) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const [rows, setRows] = useState<AdminLiveRow[]>([]);
  useEffect(() => {
    void fetchAdminLives(null).then(setRows);
  }, []);
  return (
    <View style={{ gap: 10 }}>
      {rows.length === 0 ? <Text style={{ color: colors.mutedForeground }}>{t("admin.empty")}</Text> : null}
      {rows.map((l) => (
        <SurfaceCard key={l.id}>
          <Text style={{ fontWeight: "800", color: colors.foreground }}>{l.title}</Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
            @{l.seller_handle} · {l.status} · {l.viewer_count} viewers
          </Text>
          {l.status === "live" ? (
            <View style={styles.rowBtns}>
              <ActionPill
                label={t("admin.endLive", { defaultValue: "Couper le live" })}
                danger
                onPress={async () => {
                  await adminEndLive(l.id);
                  if (l.seller_id) {
                    await adminSendMessage(
                      l.seller_id,
                      t("admin.takedownLiveTitle"),
                      t("admin.takedownLiveBody"),
                    );
                  }
                  setRows((prev) => prev.map((x) => (x.id === l.id ? { ...x, status: "ended" } : x)));
                  flash(t("admin.takedownDone"));
                }}
              />
            </View>
          ) : null}
        </SurfaceCard>
      ))}
    </View>
  );
}

function shareOnboarding(code: string, token: string, lang: string) {
  const loc = lang.startsWith("en") ? "en" : "fr";
  void Share.share({ message: buildInfluencerOnboardingMessage(code, token, loc) });
}

function ReferralAdminTab({ flash }: { flash: (s: string) => void }) {
  const { t, i18n } = useTranslation();
  const { colors } = useAppTheme();
  const [requests, setRequests] = useState<AdminPromoCodeRequestRow[]>([]);
  const [codes, setCodes] = useState<AdminPromoCodeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [newCode, setNewCode] = useState("");
  const [creating, setCreating] = useState(false);
  const [lastCreated, setLastCreated] = useState<{ code: string; token: string } | null>(null);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    const [reqs, list] = await Promise.all([fetchAdminPromoCodeRequests("pending"), fetchAdminPromoCodes()]);
    setRequests(reqs);
    setCodes(list);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const review = (r: AdminPromoCodeRequestRow, action: "approve" | "reject") => {
    const title =
      action === "approve"
        ? t("admin.approve", { defaultValue: "Approuver" })
        : t("admin.reject");
    Alert.alert(title, `@${r.user_handle || r.user_name || "?"}`, [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: title,
        style: action === "reject" ? "destructive" : "default",
        onPress: () => {
          void adminReviewPromoCodeRequest(r.id, action).then((res) => {
            if (!res.ok) {
              flash(res.error);
              return;
            }
            flash(action === "approve" && res.code ? `✓ ${res.code}` : "OK");
            void load();
          });
        },
      },
    ]);
  };

  const createUnassigned = () => {
    const code = newCode.trim().toUpperCase();
    if (!/^[A-Z0-9_-]{4,20}$/.test(code)) {
      flash(t("referral.admin.badFormat"));
      return;
    }
    setCreating(true);
    void adminCreatePromoCode(code, null, 14).then((res) => {
      setCreating(false);
      if (!res.ok) {
        flash(res.error);
        return;
      }
      setNewCode("");
      setLastCreated({ code: res.code, token: res.claim_token });
      flash(t("referral.admin.created"));
      void load();
    });
  };

  if (loading) return <ActivityIndicator color={GOLD} />;

  return (
    <View style={{ gap: 12 }}>
      <SectionTitle text={t("referral.admin.requestsTitle", { defaultValue: "Demandes de code" })} />
      {requests.length === 0 ? (
        <Text style={{ color: colors.mutedForeground }}>{t("admin.empty")}</Text>
      ) : (
        requests.map((r) => (
          <SurfaceCard key={r.id}>
            <Text style={{ fontWeight: "800", color: colors.foreground }}>
              {r.user_name || "—"} @{r.user_handle || "?"}
            </Text>
            {r.message ? (
              <Text style={{ color: colors.mutedForeground, fontSize: 13, marginTop: 4 }}>{r.message}</Text>
            ) : null}
            <Text style={{ color: colors.mutedForeground, fontSize: 11, marginTop: 4 }}>
              {new Date(r.created_at).toLocaleDateString(i18n.language)}
            </Text>
            <View style={styles.rowBtns}>
              <ActionPill label={t("admin.approve", { defaultValue: "Approuver" })} onPress={() => review(r, "approve")} />
              <ActionPill label={t("admin.reject")} danger onPress={() => review(r, "reject")} />
            </View>
          </SurfaceCard>
        ))
      )}

      <SectionTitle text={t("referral.admin.codesTitle", { defaultValue: "Codes influenceurs" })} />
      <Text style={{ color: colors.mutedForeground, fontSize: 12, lineHeight: 17 }}>
        {t("referral.admin.createIntro")}
      </Text>
      <View style={[styles.search, { borderColor: colors.border }]}>
        <TextInput
          value={newCode}
          onChangeText={setNewCode}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder={t("referral.admin.codeLabel")}
          placeholderTextColor={colors.mutedForeground}
          style={[styles.searchInput, { color: colors.foreground }]}
        />
      </View>
      <ActionPill
        label={creating ? "…" : t("referral.admin.create")}
        onPress={() => {
          if (!creating) createUnassigned();
        }}
      />

      {lastCreated ? (
        <SurfaceCard style={{ borderColor: GOLD, backgroundColor: "rgba(232,185,59,0.08)" }}>
          <Text style={{ fontWeight: "800", color: colors.foreground }}>{t("referral.admin.onboardingTitle")}</Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 4 }}>
            {t("referral.admin.onboardingIntro")}
          </Text>
          <Text style={{ color: colors.foreground, marginTop: 8, fontWeight: "800" }}>
            {t("referral.admin.publicLabel")} : {lastCreated.code}
          </Text>
          <Text style={{ color: colors.foreground, marginTop: 4, fontWeight: "700" }}>
            {t("referral.admin.secretLabel")} : {lastCreated.token}
          </Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 11, marginTop: 4 }}>
            {t("referral.admin.secretHint")}
          </Text>
          <View style={styles.rowBtns}>
            <ActionPill
              label={t("referral.admin.copyMessage")}
              onPress={() => shareOnboarding(lastCreated.code, lastCreated.token, i18n.language)}
            />
          </View>
        </SurfaceCard>
      ) : null}

      {codes.length === 0 ? (
        <Text style={{ color: colors.mutedForeground }}>{t("referral.admin.empty")}</Text>
      ) : (
        codes.map((c) => {
          const claimed = !!c.owner_id && !!c.claimed_at;
          const showToken = !!revealed[c.id];
          const held = c.held_totals && Object.keys(c.held_totals).length > 0
            ? formatTotals(c.held_totals, i18n.language)
            : null;
          return (
            <SurfaceCard key={c.id}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={{ flex: 1, fontWeight: "800", color: colors.foreground }}>{c.code}</Text>
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "800",
                    color: c.active ? "#1B7A3A" : colors.mutedForeground,
                  }}
                >
                  {c.active ? "ACTIF" : t("referral.inactive").toUpperCase()}
                </Text>
              </View>
              <Text style={{ color: claimed ? "#1B7A3A" : "#B45309", fontSize: 12, fontWeight: "700", marginTop: 4 }}>
                {claimed
                  ? t("referral.admin.statusClaimed", { h: c.owner_handle || c.owner_name || "?" })
                  : t("referral.admin.statusPending")}
              </Text>
              <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 2 }}>
                {c.signups} {t("referral.signups").toLowerCase()} · {c.orders_credited}{" "}
                {t("referral.ordersCredited").toLowerCase()} · quota {c.reward_quota} ·{" "}
                {formatTotals(c.totals, i18n.language)}
              </Text>
              {held ? (
                <Text style={{ color: "#B45309", fontSize: 12, marginTop: 2 }}>
                  {t("referral.admin.held")} : {held}
                </Text>
              ) : null}
              {c.claim_token ? (
                <Press
                  onPress={() => setRevealed((prev) => ({ ...prev, [c.id]: !prev[c.id] }))}
                  style={{ minHeight: 0, alignSelf: "flex-start", marginTop: 6 }}
                >
                  <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: "700" }}>
                    {t("referral.admin.claimToken")} : {showToken ? c.claim_token : "••••-••••-••••"}
                  </Text>
                </Press>
              ) : null}
              <View style={[styles.rowBtns, { flexWrap: "wrap" }]}>
                {c.claim_token ? (
                  <ActionPill
                    label={t("referral.admin.copyMessage")}
                    onPress={() => shareOnboarding(c.code, c.claim_token!, i18n.language)}
                  />
                ) : null}
                <ActionPill
                  label={t("referral.admin.plus14", { defaultValue: "+14" })}
                  onPress={() => {
                    void adminRenewPromoCredits(c.id, 14).then((res) => {
                      flash(res.ok ? t("referral.admin.renewed", { n: res.updated }) : res.error);
                      if (res.ok) void load();
                    });
                  }}
                />
                <ActionPill
                  label={
                    c.active ? t("referral.admin.deactivate") : t("referral.admin.activate")
                  }
                  danger={c.active}
                  onPress={() => {
                    void adminSetPromoActive(c.id, !c.active).then((res) => {
                      flash(res.ok ? "OK" : res.error ?? "Erreur");
                      void load();
                    });
                  }}
                />
              </View>
            </SurfaceCard>
          );
        })
      )}
    </View>
  );
}

function ActionPill({
  label,
  onPress,
  danger,
}: {
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  const { colors } = useAppTheme();
  return (
    <Press
      onPress={onPress}
      style={[
        styles.pill,
        {
          borderColor: danger ? "rgba(198,40,40,0.35)" : colors.border,
          backgroundColor: danger ? "rgba(198,40,40,0.06)" : colors.muted,
        },
      ]}
    >
      <Text style={{ color: danger ? "#C0392B" : colors.foreground, fontWeight: "700", fontSize: 12 }}>{label}</Text>
    </Press>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  tabs: { paddingHorizontal: 12, paddingVertical: 8, gap: 6, alignItems: "center" },
  tabBtn: { minHeight: 0, minWidth: 0 },
  tabPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#F2F3F7",
  },
  tabOn: { backgroundColor: NAVY },
  body: { padding: 16, paddingBottom: 48, gap: 10 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: { flex: 1, fontWeight: "600", fontSize: 14, padding: 0 },
  userRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  rowBtns: { flexDirection: "row", gap: 8, marginTop: 10 },
  pill: {
    minHeight: 34,
    minWidth: 0,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
  },
});
