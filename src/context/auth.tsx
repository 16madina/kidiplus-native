import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  handle: string;
  country: string;
  phone: string;
  isSeller: boolean;
  avatarUrl?: string | null;
  followers: number;
  following: number;
  sales: number;
  walletBalance: number;
};

type AuthView = "welcome" | "signin" | "signup" | "forgot";

type Ctx = {
  user: AuthUser | null;
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
    country: string;
    phone: string;
  }) => Promise<void>;
  signOut: () => void;
  becomeSeller: () => void;
  adjustWallet: (deltaCents: number) => void;
  sendReset: (email: string) => Promise<void>;
};

const AuthContext = createContext<Ctx | null>(null);

function mockUser(
  email: string,
  displayName: string,
  extras: Partial<AuthUser> = {},
): AuthUser {
  const handle = displayName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 16);
  const sellerHint = /seller|vendeur/i.test(email) || /seller|vendeur/i.test(displayName);
  return {
    id: `mock-${handle || "user"}`,
    email,
    displayName,
    handle: handle || "kidi",
    country: extras.country ?? "🇫🇷 France",
    phone: extras.phone ?? "",
    isSeller: sellerHint,
    avatarUrl: `https://i.pravatar.cc/160?u=${encodeURIComponent(email)}`,
    followers: sellerHint ? 1284 : 12,
    following: 38,
    sales: sellerHint ? 47 : 0,
    walletBalance: 24500,
    ...extras,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [guestMode, setGuestMode] = useState(false);
  const [view, setView] = useState<AuthView>("welcome");
  const [authOverlay, setAuthOverlay] = useState(false);

  const enterGuestMode = useCallback(() => {
    setGuestMode(true);
    setUser(null);
    setAuthOverlay(false);
    setView("welcome");
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!email.trim() || !password) throw new Error("Email ou mot de passe incorrect.");
    await new Promise((r) => setTimeout(r, 450));
    setUser(mockUser(email.trim(), email.split("@")[0] || "KiDi"));
    setGuestMode(false);
    setAuthOverlay(false);
    setView("welcome");
  }, []);

  const signUp = useCallback(
    async (input: {
      email: string;
      password: string;
      displayName: string;
      country: string;
      phone: string;
    }) => {
      await new Promise((r) => setTimeout(r, 550));
      setUser(
        mockUser(input.email, input.displayName, {
          country: input.country,
          phone: input.phone,
          isSeller: false,
        }),
      );
      setGuestMode(false);
      setAuthOverlay(false);
      setView("welcome");
    },
    [],
  );

  const signOut = useCallback(() => {
    setUser(null);
    setGuestMode(false);
    setView("welcome");
  }, []);

  const becomeSeller = useCallback(() => {
    setUser((prev) => (prev ? { ...prev, isSeller: true } : prev));
  }, []);

  const adjustWallet = useCallback((deltaCents: number) => {
    setUser((prev) =>
      prev ? { ...prev, walletBalance: Math.max(0, prev.walletBalance + deltaCents) } : prev,
    );
  }, []);

  const openAuth = useCallback((next: AuthView = "welcome") => {
    setView(next);
    setAuthOverlay(true);
  }, []);

  const closeAuth = useCallback(() => {
    setAuthOverlay(false);
    setView("welcome");
  }, []);

  const sendReset = useCallback(async (_email: string) => {
    await new Promise((r) => setTimeout(r, 400));
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      user,
      guestMode,
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
    }),
    [
      user,
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
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
