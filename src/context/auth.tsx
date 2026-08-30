import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { User } from "@supabase/supabase-js";
import i18n from "../i18n";
import { PROFILE_SAFE_SELECT, supabase, type ProfileRow } from "../lib/supabase";
import { resolveAvatarUrl } from "../lib/storage";
import { fetchMyWallet } from "../lib/wallet";
import { applyPromoCodeWithRetry } from "../lib/referrals";
import { normalizeCurrency, type Currency } from "../lib/money";

const GUEST_KEY = "kidiplus.guestMode";
const PENDING_PROMO_KEY = "kidiplus.pendingPromo";
const RESET_REDIRECT = "https://kidiplus.com/reset-password";

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  handle: string;
  firstName: string;
  lastName: string;
  country: string;
  phone: string;
  isSeller: boolean;
  isAdmin: boolean;
  isReferred: boolean;
  isFrozen: boolean;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  bio?: string | null;
  followers: number;
  following: number;
  sales: number;
  /** Major units, same as Superbase `wallets.balance`. */
  walletBalance: number;
  walletCurrency: Currency;
};

type AuthView = "welcome" | "signin" | "signup" | "forgot";

type Ctx = {
  user: AuthUser | null;
  loading: boolean;
  guestMode: boolean;
  view: AuthView;
  setView: (v: AuthView) => void;
  authOverlay: boolean;
  openAuth: (view?: AuthView) => void;
  closeAuth: () => void;
  enterGuestMode: () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: {
    email: string;
    password: string;
    displayName: string;
    firstName: string;
    lastName: string;
    handle: string;
    country: string;
    phone: string;
    promoCode?: string;
  }) => Promise<{ needsEmailConfirmation: boolean }>;
  signOut: () => Promise<void>;
  becomeSeller: () => Promise<void>;
  adjustWallet: (deltaCents: number) => void;
  sendReset: (email: string) => Promise<void>;
  updateProfile: (patch: {
    display_name?: string;
    handle?: string;
    first_name?: string;
    last_name?: string;
    bio?: string | null;
    country?: string | null;
    avatar_url?: string;
    currency?: string;
  }) => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<Ctx | null>(null);

function slug(name: string) {
  return (
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "")
      .slice(0, 16) || "kidi"
  );
}

export function mapAuthError(err: unknown): Error {
  const raw =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : i18n.t("auth.errors.generic");
  const m = raw.toLowerCase();
  const t = (k: string) => i18n.t(k);
  if (m.includes("failed to fetch") || m.includes("network") || m.includes("fetch")) {
    return new Error(t("auth.errors.network"));
  }
  if (m.includes("invalid login")) return new Error(t("auth.errors.invalidCredentials"));
  if (m.includes("email not confirmed")) return new Error(t("auth.errors.emailNotConfirmed"));
  if (m.includes("already registered") || m.includes("already been registered")) {
    return new Error(t("auth.errors.alreadyRegistered"));
  }
  if (m.includes("duplicate") || m.includes("unique") && m.includes("handle")) {
    return new Error(t("profile.handleTaken"));
  }
  if (m.includes("password should be at least")) return new Error(t("auth.errors.passwordShort"));
  if (m.includes("rate") || m.includes("too many")) return new Error(t("auth.errors.rateLimit"));
  if (m.includes("invalid email")) return new Error(t("auth.errors.invalidEmail"));
  return new Error(raw || t("auth.errors.generic"));
}

async function toAuthUser(
  authUser: User,
  profile: ProfileRow | null,
  wallet: { balance: number; currency: Currency },
): Promise<AuthUser> {
  const meta = (authUser.user_metadata ?? {}) as Record<string, unknown>;
  // Live "Ventes" stat like kidiplus.com: paid orders where I'm the seller.
  let salesCount = 0;
  if (profile?.is_seller) {
    const { count } = await supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("seller_id", authUser.id)
      .eq("status", "paid");
    salesCount = count ?? 0;
  }
  const displayName =
    profile?.display_name ||
    (typeof meta.display_name === "string" ? meta.display_name : "") ||
    authUser.email?.split("@")[0] ||
    "KiDi";
  const avatarUrl = (await resolveAvatarUrl(profile?.avatar_url)) || null;
  return {
    id: authUser.id,
    email: authUser.email ?? "",
    displayName,
    handle: profile?.handle || slug(displayName),
    firstName: (profile?.first_name ?? (typeof meta.first_name === "string" ? meta.first_name : "")).trim(),
    lastName: (profile?.last_name ?? (typeof meta.last_name === "string" ? meta.last_name : "")).trim(),
    country:
      profile?.country || (typeof meta.country === "string" ? meta.country : "") || "",
    phone: profile?.phone || (typeof meta.phone === "string" ? meta.phone : "") || "",
    isSeller: !!profile?.is_seller,
    isAdmin: !!profile?.is_admin,
    isReferred: !!profile?.is_referred,
    isFrozen: !!profile?.is_frozen,
    avatarUrl,
    bannerUrl: (await resolveAvatarUrl(profile?.banner_url)) || null,
    bio: profile?.bio ?? null,
    followers: profile?.followers_count ?? 0,
    following: profile?.following_count ?? 0,
    sales: salesCount,
    walletBalance: wallet.balance,
    walletCurrency: wallet.currency,
  };
}

async function readProfile(userId: string): Promise<ProfileRow | null> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const { data, error } = await supabase
      .from("profiles")
      .select(PROFILE_SAFE_SELECT)
      .eq("id", userId)
      .maybeSingle();
    if (!error && data) return data as ProfileRow;
    await new Promise((r) => setTimeout(r, 350));
  }
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [guestMode, setGuestMode] = useState(false);
  const [view, setView] = useState<AuthView>("welcome");
  const [authOverlay, setAuthOverlay] = useState(false);
  const wallets = useRef<Record<string, number>>({});

  const hydrate = useCallback(async (authUser: User | null) => {
    if (!authUser) {
      setUser(null);
      return;
    }
    const [profile, wallet] = await Promise.all([readProfile(authUser.id), fetchMyWallet(authUser.id)]);
    const balance = wallet ? Number(wallet.balance) || 0 : wallets.current[authUser.id] ?? 0;
    const currency = normalizeCurrency(wallet?.currency);
    wallets.current[authUser.id] = balance;
    setUser(await toAuthUser(authUser, profile, { balance, currency }));
    setGuestMode(false);
    await AsyncStorage.removeItem(GUEST_KEY).catch(() => undefined);
    const pending = await AsyncStorage.getItem(PENDING_PROMO_KEY).catch(() => null);
    if (pending?.trim()) {
      void applyPromoCodeWithRetry(pending).then((applied) => {
        const done =
          applied.ok ||
          applied.error === "already_referred" ||
          applied.error === "invalid_code" ||
          applied.error === "self_referral" ||
          applied.error === "window_expired";
        if (done) {
          void AsyncStorage.removeItem(PENDING_PROMO_KEY);
        }
      });
    }
  }, []);

  useEffect(() => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      setLoading(false);
    };
    const watchdog = setTimeout(finish, 6000);

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setTimeout(() => void hydrate(session.user), 0);
      } else {
        setUser(null);
      }
    });

    void (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (data.session?.user) {
          await hydrate(data.session.user);
        } else {
          const guest = await AsyncStorage.getItem(GUEST_KEY);
          if (guest === "1") setGuestMode(true);
        }
      } catch {
        /* still show welcome */
      } finally {
        finish();
        clearTimeout(watchdog);
      }
    })();

    return () => {
      clearTimeout(watchdog);
      sub.subscription.unsubscribe();
    };
  }, [hydrate]);

  const enterGuestMode = useCallback(() => {
    setGuestMode(true);
    setUser(null);
    setAuthOverlay(false);
    setView("welcome");
    void AsyncStorage.setItem(GUEST_KEY, "1");
  }, []);

  const signIn = useCallback(
    async (email: string, password: string) => {
      if (!email.trim() || !password) {
        throw new Error(i18n.t("auth.errors.invalidCredentials"));
      }
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw mapAuthError(error);
      if (!data.user) throw new Error(i18n.t("auth.errors.generic"));
      await hydrate(data.user);
      setAuthOverlay(false);
      setView("welcome");
    },
    [hydrate],
  );

  const signUp = useCallback(
    async (input: {
      email: string;
      password: string;
      displayName: string;
      firstName: string;
      lastName: string;
      handle: string;
      country: string;
      phone: string;
      promoCode?: string;
    }) => {
      const { data, error } = await supabase.auth.signUp({
        email: input.email,
        password: input.password,
        options: {
          data: {
            display_name: input.displayName,
            first_name: input.firstName,
            last_name: input.lastName,
            handle: input.handle,
            country: input.country,
            phone: input.phone,
          },
        },
      });
      if (error) throw mapAuthError(error);
      const uid = data.user?.id ?? data.session?.user?.id;
      if (uid) {
        void supabase
          .from("profiles")
          .update({
            ...(input.country ? { country: input.country } : {}),
            ...(input.phone ? { phone: input.phone } : {}),
            display_name: input.displayName,
            first_name: input.firstName,
            last_name: input.lastName,
            handle: input.handle,
          })
          .eq("id", uid);
      }
      if (input.promoCode?.trim()) {
        await AsyncStorage.setItem(PENDING_PROMO_KEY, input.promoCode.trim()).catch(() => undefined);
      }
      if (!data.session || !data.user) {
        return { needsEmailConfirmation: true };
      }
      if (input.promoCode?.trim()) {
        const applied = await applyPromoCodeWithRetry(input.promoCode);
        if (applied.ok || applied.error === "already_referred") {
          await AsyncStorage.removeItem(PENDING_PROMO_KEY).catch(() => undefined);
        }
      }
      await hydrate(data.user);
      setAuthOverlay(false);
      setView("welcome");
      return { needsEmailConfirmation: false };
    },
    [hydrate],
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setGuestMode(false);
    setView("welcome");
    setAuthOverlay(false);
    await AsyncStorage.removeItem(GUEST_KEY).catch(() => undefined);
  }, []);

  const becomeSeller = useCallback(async () => {
    const id = user?.id;
    if (!id) return;
    if (user?.isSeller) return;
    setUser((prev) => (prev ? { ...prev, isSeller: true } : prev));
    const { error } = await supabase.from("profiles").update({ is_seller: true }).eq("id", id);
    if (error) {
      setUser((prev) => (prev ? { ...prev, isSeller: false } : prev));
      throw new Error(error.message);
    }
  }, [user?.id, user?.isSeller]);

  const refreshUser = useCallback(async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) await hydrate(data.user);
  }, [hydrate]);

  const updateProfile = useCallback(
    async (patch: {
      display_name?: string;
      handle?: string;
      first_name?: string;
      last_name?: string;
      bio?: string | null;
      country?: string | null;
      avatar_url?: string;
      currency?: string;
    }) => {
      const id = user?.id;
      if (!id) return;
      const { error } = await supabase.from("profiles").update(patch).eq("id", id);
      if (error) throw new Error(error.message);
      await refreshUser();
    },
    [user?.id, refreshUser],
  );

  const adjustWallet = useCallback((deltaCents: number) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = Math.max(0, prev.walletBalance + deltaCents);
      wallets.current[prev.id] = next;
      return { ...prev, walletBalance: next };
    });
  }, []);

  const openAuth = useCallback((next: AuthView = "welcome") => {
    setView(next);
    setAuthOverlay(true);
  }, []);

  const closeAuth = useCallback(() => {
    setAuthOverlay(false);
    setView("welcome");
  }, []);

  const sendReset = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: RESET_REDIRECT,
    });
    if (error) throw mapAuthError(error);
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      user,
      loading,
      guestMode: guestMode && !user,
      view,
      setView,
      authOverlay,
      openAuth,
      closeAuth,
      enterGuestMode,
      signIn,
      signUp,
      signOut,
      becomeSeller,
      adjustWallet,
      sendReset,
      updateProfile,
      refreshUser,
    }),
    [
      user,
      loading,
      guestMode,
      view,
      authOverlay,
      openAuth,
      closeAuth,
      enterGuestMode,
      signIn,
      signUp,
      signOut,
      becomeSeller,
      adjustWallet,
      sendReset,
      updateProfile,
      refreshUser,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
