import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
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
  Shield,
  Users,
} from "lucide-react-native";
import { OverlayHeader, MockBanner } from "../components/OverlayHeader";
import { Press } from "../components/Press";
import { Glass } from "../components/Glass";
import { GoldButton } from "../components/Buttons";
import { useAuth } from "../context/auth";
import { useAppTheme } from "../context/theme";
import { GOLD } from "../theme";
import { formatMoney } from "../lib/money";
import {
  adminEndLive,
  adminIssueSanction,
  adminProcessPayout,
  adminResolveReport,
  fetchAdminLives,
  fetchAdminPayouts,
  fetchAdminReports,
  fetchAdminRiskAlerts,
  fetchAdminUsers,
  fetchOverviewStats,
  fetchPendingVerifications,
  fetchPrelaunchSimEnabled,
  firstCurrency,
  resolveAdminRiskAlert,
  reviewVerification,
  setAdminRiskRestricted,
  setPrelaunchSimEnabled,
  verificationHandle,
  type AdminLiveRow,
  type AdminPayoutRow,
  type AdminRiskAlertRow,
  type AdminUserRow,
  type OverviewStats,
  type PendingVerification,
  type ReportRow,
} from "../lib/admin";

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
  const { colors, dark } = useAppTheme();
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
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
        {TABS.map((x) => {
          const active = tab === x.id;
          return (
            <Press key={x.id} onPress={() => setTab(x.id)} style={styles.tabBtn}>
              <View style={[styles.tabPill, active && { backgroundColor: colors.foreground }]}>
                <x.Icon size={13} color={active ? colors.background : colors.foreground} />
                <Text style={{ fontWeight: "800", fontSize: 12, color: active ? colors.background : colors.foreground }}>
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
        {tab === "sim" ? <SimTab flash={flash} /> : null}
        {tab === "push" || tab === "referral" || tab === "media" ? (
          <Glass tone={dark ? "dark" : "light"} intensity={32} radius={18} padded elevated={false}>
            <Text style={{ color: colors.foreground, fontWeight: "700" }}>{t("admin.webOnly")}</Text>
          </Glass>
        ) : null}
      </ScrollView>
      <MockBanner text={toast} />
    </View>
  );
}

function OverviewTab({ onGo }: { onGo: (t: Tab) => void }) {
  const { t, i18n } = useTranslation();
  const { colors, dark } = useAppTheme();
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetchOverviewStats().then((s) => {
      setStats(s);
      setLoading(false);
    });
  }, []);

  if (loading) return <ActivityIndicator color={GOLD} />;
  if (!stats) {
    return <Text style={{ color: colors.mutedForeground }}>{t("admin.empty")}</Text>;
  }

  const gmv = firstCurrency(stats.gmv);
  const kpis: Array<{ label: string; value: string; tab?: Tab }> = [
    { label: t("admin.kpi.gmv"), value: formatMoney(gmv.amount, gmv.currency, i18n.language) },
    { label: t("admin.kpi.users"), value: String(stats.counts.users_total) },
    { label: t("admin.kpi.sellers"), value: String(stats.counts.sellers) },
    { label: t("admin.kpi.livesLive"), value: String(stats.counts.lives_live), tab: "lives" },
    { label: t("admin.toDo.reports"), value: String(stats.pending_payouts?.count ?? 0), tab: "reports" },
    {
      label: t("admin.toDo.payouts"),
      value: String(stats.pending_payouts?.count ?? 0),
      tab: "payments",
    },
  ];

  return (
    <View style={{ gap: 10 }}>
      {kpis.map((k) => (
        <Press key={k.label} onPress={() => k.tab && onGo(k.tab)} style={{ alignItems: "stretch" }}>
          <Glass tone={dark ? "dark" : "light"} intensity={32} radius={16} padded elevated={false}>
            <Text style={{ color: colors.mutedForeground, fontSize: 12, fontWeight: "700" }}>{k.label}</Text>
            <Text style={{ color: colors.foreground, fontSize: 22, fontWeight: "900", marginTop: 4 }}>{k.value}</Text>
          </Glass>
        </Press>
      ))}
    </View>
  );
}

function UsersTab({ flash }: { flash: (s: string) => void }) {
  const { t } = useTranslation();
  const { colors, dark } = useAppTheme();
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
    void load("");
  }, [load]);

  return (
    <View style={{ gap: 10 }}>
      <TextInput
        value={q}
        onChangeText={setQ}
        onSubmitEditing={() => void load(q)}
        placeholder={t("admin.searchUsers", { defaultValue: "Rechercher un @pseudo…" })}
        placeholderTextColor={colors.mutedForeground}
        autoCapitalize="none"
        style={[styles.input, { color: colors.foreground, borderColor: colors.border }]}
      />
      <GoldButton label={t("common.search", { defaultValue: "Rechercher" })} onPress={() => void load(q)} />
      {loading ? <ActivityIndicator color={GOLD} /> : null}
      {rows.map((u) => (
        <Glass key={u.id} tone={dark ? "dark" : "light"} intensity={32} radius={16} padded elevated={false}>
          <Text style={{ fontWeight: "800", color: colors.foreground }}>
            {u.display_name} @{u.handle}
          </Text>
          <Text style={{ color: colors.mutedForeground, marginTop: 2 }}>
            {u.is_seller ? "Vendeur" : "Acheteur"} · {u.country || "—"}
          </Text>
          <View style={styles.rowBtns}>
            <Mini label="Warn" onPress={() => void adminIssueSanction(u.id, "warning", "Avertissement admin").then(() => flash("OK"))} />
            <Mini label="Ban" onPress={() => void adminIssueSanction(u.id, "ban", "Bannissement admin").then(() => flash("OK"))} />
          </View>
        </Glass>
      ))}
    </View>
  );
}

function ReportsTab({ flash }: { flash: (s: string) => void }) {
  const { t } = useTranslation();
  const { colors, dark } = useAppTheme();
  const [rows, setRows] = useState<ReportRow[]>([]);
  useEffect(() => {
    void fetchAdminReports("open").then(setRows);
  }, []);
  return (
    <View style={{ gap: 10 }}>
      {rows.length === 0 ? <Text style={{ color: colors.mutedForeground }}>{t("admin.empty")}</Text> : null}
      {rows.map((r) => (
        <Glass key={r.id} tone={dark ? "dark" : "light"} intensity={32} radius={16} padded elevated={false}>
          <Text style={{ fontWeight: "800", color: colors.foreground }}>
            {r.target_type} · {r.reason}
          </Text>
          <Text style={{ color: colors.mutedForeground, marginTop: 4 }}>
            @{r.reporter_handle || "?"} → {r.target_label || r.target_type}
          </Text>
          <View style={styles.rowBtns}>
            <Mini
              label={t("admin.dismiss", { defaultValue: "Classer" })}
              onPress={async () => {
                await adminResolveReport(r.id, "dismissed");
                setRows((prev) => prev.filter((x) => x.id !== r.id));
                flash("OK");
              }}
            />
            {r.target_user_id ? (
              <Mini
                label="Warn"
                onPress={async () => {
                  await adminIssueSanction(r.target_user_id!, "warning", r.reason);
                  await adminResolveReport(r.id, "actioned");
                  setRows((prev) => prev.filter((x) => x.id !== r.id));
                  flash("OK");
                }}
              />
            ) : null}
          </View>
        </Glass>
      ))}
    </View>
  );
}

function RiskTab({ flash }: { flash: (s: string) => void }) {
  const { t } = useTranslation();
  const { colors, dark } = useAppTheme();
  const [rows, setRows] = useState<AdminRiskAlertRow[]>([]);
  useEffect(() => {
    void fetchAdminRiskAlerts("open").then(setRows);
  }, []);
  return (
    <View style={{ gap: 10 }}>
      {rows.length === 0 ? <Text style={{ color: colors.mutedForeground }}>{t("admin.risk.empty")}</Text> : null}
      {rows.map((r) => (
        <Glass key={r.id} tone={dark ? "dark" : "light"} intensity={32} radius={16} padded elevated={false}>
          <Text style={{ fontWeight: "800", color: colors.foreground }}>{r.kind}</Text>
          <Text style={{ color: colors.mutedForeground }}>@{r.user_handle || "—"}</Text>
          <View style={styles.rowBtns}>
            <Mini
              label={t("admin.risk.resolve")}
              onPress={async () => {
                await resolveAdminRiskAlert(r.id);
                setRows((prev) => prev.filter((x) => x.id !== r.id));
                flash(t("admin.risk.resolved"));
              }}
            />
            {r.user_id ? (
              <Mini
                label={r.risk_restricted ? t("admin.risk.unfreeze") : t("admin.risk.freeze")}
                onPress={async () => {
                  await setAdminRiskRestricted(r.user_id!, !r.risk_restricted);
                  flash("OK");
                }}
              />
            ) : null}
          </View>
        </Glass>
      ))}
    </View>
  );
}

function VerifyTab({ flash }: { flash: (s: string) => void }) {
  const { t } = useTranslation();
  const { colors, dark } = useAppTheme();
  const [rows, setRows] = useState<PendingVerification[]>([]);
  useEffect(() => {
    void fetchPendingVerifications().then(setRows);
  }, []);
  return (
    <View style={{ gap: 10 }}>
      {rows.length === 0 ? <Text style={{ color: colors.mutedForeground }}>{t("admin.empty")}</Text> : null}
      {rows.map((r) => (
        <Glass key={r.id} tone={dark ? "dark" : "light"} intensity={32} radius={16} padded elevated={false}>
          <Text style={{ fontWeight: "800", color: colors.foreground }}>@{verificationHandle(r)}</Text>
          {r.message ? <Text style={{ color: colors.mutedForeground, marginTop: 4 }}>{r.message}</Text> : null}
          <View style={styles.rowBtns}>
            <Mini
              label={t("admin.approve", { defaultValue: "Approuver" })}
              onPress={async () => {
                await reviewVerification(r.id, true);
                setRows((prev) => prev.filter((x) => x.id !== r.id));
                flash("OK");
              }}
            />
            <Mini
              label={t("admin.reject")}
              onPress={async () => {
                await reviewVerification(r.id, false);
                setRows((prev) => prev.filter((x) => x.id !== r.id));
                flash("OK");
              }}
            />
          </View>
        </Glass>
      ))}
    </View>
  );
}

function PaymentsTab({ flash }: { flash: (s: string) => void }) {
  const { t, i18n } = useTranslation();
  const { colors, dark } = useAppTheme();
  const [rows, setRows] = useState<AdminPayoutRow[]>([]);
  const load = () => void fetchAdminPayouts("requested").then(setRows);
  useEffect(() => {
    load();
  }, []);
  return (
    <View style={{ gap: 10 }}>
      {rows.length === 0 ? <Text style={{ color: colors.mutedForeground }}>{t("admin.empty")}</Text> : null}
      {rows.map((p) => (
        <Glass key={p.id} tone={dark ? "dark" : "light"} intensity={32} radius={16} padded elevated={false}>
          <Text style={{ fontWeight: "800", color: colors.foreground }}>
            @{p.seller_handle || p.seller_name} · {formatMoney(p.amount, p.currency, i18n.language)}
          </Text>
          <Text style={{ color: colors.mutedForeground }}>{p.method} · {p.status}</Text>
          <View style={styles.rowBtns}>
            <Mini
              label={t("admin.markPaid")}
              onPress={async () => {
                const r = await adminProcessPayout(p.id, "paid");
                flash(r.ok ? t("admin.markedPaid") : r.error || "Erreur");
                load();
              }}
            />
            <Mini
              label={t("admin.reject")}
              onPress={async () => {
                const r = await adminProcessPayout(p.id, "rejected");
                flash(r.ok ? t("admin.markedRejected") : r.error || "Erreur");
                load();
              }}
            />
          </View>
        </Glass>
      ))}
    </View>
  );
}

function LivesTab({ flash }: { flash: (s: string) => void }) {
  const { t } = useTranslation();
  const { colors, dark } = useAppTheme();
  const [rows, setRows] = useState<AdminLiveRow[]>([]);
  useEffect(() => {
    void fetchAdminLives(null).then(setRows);
  }, []);
  return (
    <View style={{ gap: 10 }}>
      {rows.length === 0 ? <Text style={{ color: colors.mutedForeground }}>{t("admin.empty")}</Text> : null}
      {rows.map((l) => (
        <Glass key={l.id} tone={dark ? "dark" : "light"} intensity={32} radius={16} padded elevated={false}>
          <Text style={{ fontWeight: "800", color: colors.foreground }}>{l.title}</Text>
          <Text style={{ color: colors.mutedForeground }}>
            @{l.seller_handle} · {l.status} · {l.viewer_count} viewers
          </Text>
          {l.status === "live" ? (
            <View style={styles.rowBtns}>
              <Mini
                label={t("admin.endLive", { defaultValue: "Couper le live" })}
                onPress={async () => {
                  await adminEndLive(l.id);
                  setRows((prev) => prev.map((x) => (x.id === l.id ? { ...x, status: "ended" } : x)));
                  flash("OK");
                }}
              />
            </View>
          ) : null}
        </Glass>
      ))}
    </View>
  );
}

function SimTab({ flash }: { flash: (s: string) => void }) {
  const { t } = useTranslation();
  const { colors, dark } = useAppTheme();
  const [on, setOn] = useState(false);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    void fetchPrelaunchSimEnabled().then((v) => {
      setOn(v);
      setLoading(false);
    });
  }, []);
  return (
    <Glass tone={dark ? "dark" : "light"} intensity={32} radius={18} padded elevated={false}>
      <Text style={{ fontWeight: "800", color: colors.foreground }}>{t("admin.prelaunchSim.title")}</Text>
      <Text style={{ color: colors.mutedForeground, marginTop: 6 }}>{t("admin.prelaunchSim.panelHint")}</Text>
      {loading ? (
        <ActivityIndicator color={GOLD} style={{ marginTop: 12 }} />
      ) : (
        <View style={{ marginTop: 12 }}>
          <GoldButton
            label={on ? t("admin.prelaunchSim.turnOff") : t("admin.prelaunchSim.turnOn")}
            onPress={async () => {
              const next = !on;
              const ok = await setPrelaunchSimEnabled(next);
              if (ok) {
                setOn(next);
                flash(next ? t("admin.prelaunchSim.onToast") : t("admin.prelaunchSim.offToast"));
              } else flash(t("admin.prelaunchSim.saveFail"));
            }}
          />
        </View>
      )}
    </Glass>
  );
}

function Mini({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Press onPress={onPress} style={styles.mini}>
      <Text style={{ color: GOLD, fontWeight: "800", fontSize: 12 }}>{label}</Text>
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
    backgroundColor: "rgba(232,185,59,0.12)",
  },
  body: { padding: 16, paddingBottom: 48, gap: 10 },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 44,
    fontWeight: "600",
  },
  rowBtns: { flexDirection: "row", gap: 10, marginTop: 10 },
  mini: { minHeight: 32, minWidth: 0, paddingHorizontal: 4 },
});
