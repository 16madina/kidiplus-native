// Admin push broadcast panel — parity with kidiplus.com AdminPushPanel.
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import { Bell, Check, Search, Users, X } from "lucide-react-native";
import { Press } from "../Press";
import { SurfaceCard } from "../SurfaceCard";
import { useAppTheme } from "../../context/theme";
import { fetchAdminUsers, type AdminUserRow } from "../../lib/admin";
import { sendAdminPush, type AdminPushResult } from "../../lib/admin-push";
import { GOLD, NAVY, initials } from "../../theme";

type Template = {
  id: string;
  label: string;
  emoji: string;
  title: string;
  body: string;
};

const TEMPLATES: Template[] = [
  {
    id: "welcome",
    label: "Bienvenue",
    emoji: "👋",
    title: "Bienvenue sur KiDi+ 🎉",
    body: "Découvre les lives en cours et fais tes premières enchères !",
  },
  {
    id: "warning",
    label: "Avertissement",
    emoji: "⚠️",
    title: "Avertissement ⚠️",
    body: "Ton comportement enfreint nos règles. Merci de consulter la charte KiDi+.",
  },
  {
    id: "live",
    label: "Nouveau live",
    emoji: "🔴",
    title: "Un live vient de commencer 🔴",
    body: "Rejoins la vente en direct maintenant sur KiDi+ !",
  },
  {
    id: "promo",
    label: "Promo",
    emoji: "🎁",
    title: "Offre spéciale KiDi+ 🎁",
    body: "Profite de nos meilleures ventes flash cette semaine !",
  },
  {
    id: "info",
    label: "Info",
    emoji: "ℹ️",
    title: "Information KiDi+",
    body: "Une mise à jour importante est disponible dans ton app.",
  },
  {
    id: "reminder",
    label: "Rappel",
    emoji: "⏰",
    title: "Ne rate pas ton live ⏰",
    body: "Le live que tu suis commence bientôt !",
  },
  {
    id: "payment",
    label: "Paiement",
    emoji: "💳",
    title: "Paiement en attente 💳",
    body: "Finalise le paiement de ta commande pour la sécuriser.",
  },
  {
    id: "thanks",
    label: "Merci",
    emoji: "💛",
    title: "Merci de faire partie de KiDi+ 💛",
    body: "Ta communauté te remercie pour ton soutien.",
  },
];

export function AdminPushPanel({ flash }: { flash: (s: string) => void }) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const [mode, setMode] = useState<"all" | "user_ids">("user_ids");
  const [templateId, setTemplateId] = useState("welcome");
  const [title, setTitle] = useState(TEMPLATES[0]!.title);
  const [body, setBody] = useState(TEMPLATES[0]!.body);
  const [selected, setSelected] = useState<AdminUserRow[]>([]);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<AdminUserRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [sending, setSending] = useState(false);
  const [lastResult, setLastResult] = useState<AdminPushResult | null>(null);

  useEffect(() => {
    if (mode !== "user_ids") return;
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    const h = setTimeout(() => {
      void fetchAdminUsers(q.trim(), 20, 0).then((r) => {
        setResults(r.rows);
        setSearching(false);
      });
    }, 250);
    return () => clearTimeout(h);
  }, [q, mode]);

  const canSend = useMemo(() => {
    if (!title.trim() && !body.trim()) return false;
    if (mode === "user_ids" && selected.length === 0) return false;
    return !sending;
  }, [title, body, mode, selected, sending]);

  const pickTemplate = (tpl: Template) => {
    setTemplateId(tpl.id);
    setTitle(tpl.title);
    setBody(tpl.body);
  };

  const toggleUser = (u: AdminUserRow) => {
    setSelected((prev) =>
      prev.some((x) => x.id === u.id) ? prev.filter((x) => x.id !== u.id) : [...prev, u],
    );
  };

  const onSend = () => {
    if (!canSend) return;
    const targetLabel =
      mode === "all"
        ? "TOUS les utilisateurs avec un appareil enregistré"
        : `${selected.length} utilisateur(s) sélectionné(s)`;
    Alert.alert(
      t("admin.push.confirmTitle", { defaultValue: "Envoyer la notification ?" }),
      t("admin.push.confirmBody", {
        defaultValue: `Envoyer cette notification à ${targetLabel} ?`,
        target: targetLabel,
      }),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("admin.push.send", { defaultValue: "Envoyer" }),
          onPress: () => {
            void (async () => {
              setSending(true);
              setLastResult(null);
              try {
                const r = await sendAdminPush({
                  mode,
                  userIds: mode === "user_ids" ? selected.map((u) => u.id) : undefined,
                  title: title.trim(),
                  body: body.trim(),
                });
                setLastResult(r);
                if (r.sent === 0 && r.targetedUsers === 0) {
                  flash(
                    t("admin.push.noneRegistered", {
                      defaultValue: "Aucun destinataire avec appareil enregistré",
                    }),
                  );
                } else if (r.sent === 0) {
                  flash(t("admin.push.allFailed", { defaultValue: "Aucune push envoyée" }));
                } else {
                  flash(
                    t("admin.push.sentOk", {
                      defaultValue: `Push envoyée à ${r.sent} appareil(s)`,
                      count: r.sent,
                    }),
                  );
                }
              } catch (e) {
                flash(e instanceof Error ? e.message : String(e));
              } finally {
                setSending(false);
              }
            })();
          },
        },
      ],
    );
  };

  return (
    <View style={{ gap: 12 }}>
      <Text style={[styles.section, { color: colors.mutedForeground }]}>
        {t("admin.push.recipients", { defaultValue: "Destinataires" })}
      </Text>
      <View style={styles.row2}>
        <Press
          onPress={() => {
            setMode("user_ids");
          }}
          style={[
            styles.modeBtn,
            {
              borderColor: mode === "user_ids" ? GOLD : colors.border,
              backgroundColor: mode === "user_ids" ? "rgba(247,206,90,0.14)" : colors.card,
            },
          ]}
        >
          <Search size={14} color={colors.foreground} />
          <Text style={[styles.modeTxt, { color: colors.foreground }]}>Cibler</Text>
        </Press>
        <Press
          onPress={() => {
            setMode("all");
            setSelected([]);
          }}
          style={[
            styles.modeBtn,
            {
              borderColor: mode === "all" ? GOLD : colors.border,
              backgroundColor: mode === "all" ? "rgba(247,206,90,0.14)" : colors.card,
            },
          ]}
        >
          <Users size={14} color={colors.foreground} />
          <Text style={[styles.modeTxt, { color: colors.foreground }]}>Tous</Text>
        </Press>
      </View>

      {mode === "user_ids" ? (
        <View style={{ gap: 8 }}>
          <Text style={[styles.section, { color: colors.mutedForeground }]}>
            {t("admin.push.searchUsers", { defaultValue: "Rechercher des utilisateurs" })}
          </Text>
          <View style={[styles.search, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <Search size={14} color={colors.mutedForeground} />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="Nom, @handle…"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="none"
              style={[styles.searchInput, { color: colors.foreground }]}
            />
            {searching ? <ActivityIndicator size="small" color={GOLD} /> : null}
          </View>

          {selected.length > 0 ? (
            <View style={styles.chips}>
              {selected.map((u) => (
                <Press key={u.id} onPress={() => toggleUser(u)} style={[styles.chip, { backgroundColor: colors.muted }]}>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: colors.foreground }}>{u.display_name}</Text>
                  <X size={10} color={colors.mutedForeground} />
                </Press>
              ))}
            </View>
          ) : null}

          {results.map((u) => {
            const picked = selected.some((x) => x.id === u.id);
            return (
              <Press key={u.id} onPress={() => toggleUser(u)}>
                <SurfaceCard
                  style={{
                    borderColor: picked ? GOLD : colors.border,
                    borderWidth: 1,
                  }}
                >
                  <View style={styles.userRow}>
                    <View style={[styles.avatar, { backgroundColor: colors.muted }]}>
                      <Text style={{ fontWeight: "800", color: colors.foreground }}>
                        {initials(u.display_name || u.handle)}
                      </Text>
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ fontWeight: "700", color: colors.foreground }} numberOfLines={1}>
                        {u.display_name}
                      </Text>
                      <Text style={{ fontSize: 11, color: colors.mutedForeground }} numberOfLines={1}>
                        @{u.handle}
                      </Text>
                    </View>
                    {picked ? <Check size={16} color={GOLD} /> : null}
                  </View>
                </SurfaceCard>
              </Press>
            );
          })}
        </View>
      ) : null}

      <Text style={[styles.section, { color: colors.mutedForeground }]}>
        {t("admin.push.templates", { defaultValue: "Messages prédéfinis" })}
      </Text>
      <View style={styles.tplGrid}>
        {TEMPLATES.map((tpl) => {
          const active = templateId === tpl.id;
          return (
            <Press
              key={tpl.id}
              onPress={() => pickTemplate(tpl)}
              style={[
                styles.tplBtn,
                {
                  borderColor: active ? GOLD : colors.border,
                  backgroundColor: active ? "rgba(247,206,90,0.14)" : colors.card,
                },
              ]}
            >
              <Text style={{ fontSize: 15 }}>{tpl.emoji}</Text>
              <Text style={{ fontSize: 12, fontWeight: "700", color: colors.foreground }} numberOfLines={1}>
                {tpl.label}
              </Text>
            </Press>
          );
        })}
      </View>

      <Text style={[styles.section, { color: colors.mutedForeground }]}>Titre</Text>
      <TextInput
        value={title}
        onChangeText={(v) => {
          setTitle(v);
          setTemplateId("custom");
        }}
        maxLength={80}
        placeholder="Ex : Nouveau live 🔴"
        placeholderTextColor={colors.mutedForeground}
        style={[styles.input, { borderColor: colors.border, backgroundColor: colors.card, color: colors.foreground }]}
      />
      <Text style={{ textAlign: "right", fontSize: 10, color: colors.mutedForeground }}>{title.length}/80</Text>

      <Text style={[styles.section, { color: colors.mutedForeground }]}>Message</Text>
      <TextInput
        value={body}
        onChangeText={(v) => {
          setBody(v);
          setTemplateId("custom");
        }}
        maxLength={200}
        multiline
        numberOfLines={3}
        placeholder="Contenu de la notification…"
        placeholderTextColor={colors.mutedForeground}
        style={[
          styles.input,
          styles.textarea,
          { borderColor: colors.border, backgroundColor: colors.card, color: colors.foreground },
        ]}
      />
      <Text style={{ textAlign: "right", fontSize: 10, color: colors.mutedForeground }}>{body.length}/200</Text>

      <Text style={[styles.section, { color: colors.mutedForeground }]}>Aperçu</Text>
      <SurfaceCard>
        <View style={styles.preview}>
          <View style={styles.previewIcon}>
            <Bell size={14} color={NAVY} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontWeight: "700", color: colors.foreground }} numberOfLines={1}>
              {title || "KiDi+"}
            </Text>
            <Text style={{ fontSize: 12, color: colors.mutedForeground }} numberOfLines={2}>
              {body || "—"}
            </Text>
          </View>
        </View>
      </SurfaceCard>

      <Press
        onPress={onSend}
        disabled={!canSend}
        style={[styles.sendBtn, { opacity: canSend ? 1 : 0.5 }]}
      >
        {sending ? <ActivityIndicator color={NAVY} /> : <Bell size={16} color={NAVY} />}
        <Text style={styles.sendTxt}>
          {sending
            ? "Envoi en cours…"
            : mode === "all"
              ? "Envoyer à tous les utilisateurs"
              : `Envoyer à ${selected.length} utilisateur(s)`}
        </Text>
      </Press>

      {lastResult ? (
        <SurfaceCard>
          <Text style={{ fontWeight: "700", color: colors.foreground, marginBottom: 6 }}>Résultat</Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
            Utilisateurs ciblés : {lastResult.targetedUsers}
          </Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
            Push envoyées : {lastResult.sent}
          </Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Échecs : {lastResult.failed}</Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
            Tokens invalides : {lastResult.invalidTokens}
          </Text>
        </SurfaceCard>
      ) : null}

      <Text style={{ textAlign: "center", fontSize: 10, color: colors.mutedForeground, marginBottom: 8 }}>
        Les utilisateurs sans appareil enregistré ne reçoivent rien. Les tokens invalides sont automatiquement
        nettoyés.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginTop: 4,
  },
  row2: { flexDirection: "row", gap: 8 },
  modeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 12,
  },
  modeTxt: { fontSize: 13, fontWeight: "700" },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 14, padding: 0 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  userRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  tplGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tplBtn: {
    width: "47%",
    flexGrow: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  input: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
  },
  textarea: { minHeight: 84, textAlignVertical: "top" },
  preview: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  previewIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "rgba(247,206,90,0.28)",
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: GOLD,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  sendTxt: { color: NAVY, fontWeight: "800", fontSize: 14 },
});
