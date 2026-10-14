import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import * as authApi from "../api/auth";
import { setSessionExpiredHandler } from "../api/apiClient";
import { User } from "../api/auth";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  setUser: (user: User) => void;
  refreshUser: () => Promise<User | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Cookie HttpOnly không đọc được từ JS → luôn hỏi /me.
  // Thành công nghĩa là đang đăng nhập; lỗi (401) nghĩa là chưa.
  const refreshUser = async (): Promise<User | null> => {
    try {
      const me = await authApi.getProfile();
      setUser(me);
      return me;
    } catch {
      setUser(null);
      return null;
    }
  };

  useEffect(() => {
    refreshUser().finally(() => setLoading(false));
  }, []);

  // apiClient gặp 401 mà làm mới phiên thất bại → coi như đã đăng xuất (ProtectedRoute đưa về /login).
  const userRef = useRef<User | null>(null);
  userRef.current = user;
  useEffect(() => {
    setSessionExpiredHandler(() => {
      const hadSession = userRef.current !== null;
      if (hadSession) setUser(null);
      return hadSession;
    });
    return () => setSessionExpiredHandler(null);
  }, []);

  const login = async (email: string, password: string) => {
    const me = await authApi.login(email, password);
    setUser(me);
    return me;
  };

  const logout = async () => {
    await authApi.logout().catch(() => undefined);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, login, logout, setUser, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
