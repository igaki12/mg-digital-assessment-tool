import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode
} from "react";

type AuthSession = {
  userId: string;
  loggedInAt: string;
};

type LoginOptions = {
  userId: string;
  remember: boolean;
};

type AuthContextValue = {
  isAuthenticated: boolean;
  session: AuthSession | null;
  login: (options: LoginOptions) => void;
  logout: () => void;
};

const AUTH_STORAGE_KEY = "mg-assessment-auth-session";

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredSession() {
  if (typeof window === "undefined") {
    return null;
  }

  const raw =
    window.localStorage.getItem(AUTH_STORAGE_KEY) ??
    window.sessionStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<AuthSession>;
    if (typeof parsed.userId !== "string" || typeof parsed.loggedInAt !== "string") {
      return null;
    }
    return {
      userId: parsed.userId,
      loggedInAt: parsed.loggedInAt
    };
  } catch (error) {
    console.warn("Unable to parse stored auth session", error);
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(() =>
    readStoredSession()
  );

  const login = useCallback(({ userId, remember }: LoginOptions) => {
    const nextSession = {
      userId: userId.trim() || "demo-user",
      loggedInAt: new Date().toISOString()
    };
    const serialized = JSON.stringify(nextSession);
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    window.sessionStorage.removeItem(AUTH_STORAGE_KEY);
    if (remember) {
      window.localStorage.setItem(AUTH_STORAGE_KEY, serialized);
    } else {
      window.sessionStorage.setItem(AUTH_STORAGE_KEY, serialized);
    }
    setSession(nextSession);
  }, []);

  const logout = useCallback(() => {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    window.sessionStorage.removeItem(AUTH_STORAGE_KEY);
    setSession(null);
  }, []);

  const value = useMemo(
    () => ({
      isAuthenticated: Boolean(session),
      session,
      login,
      logout
    }),
    [login, logout, session]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return value;
}
