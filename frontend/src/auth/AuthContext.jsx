import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const AuthContext = createContext(null);

// 用用户名作为底层内部邮箱（Supabase 认证基于邮箱）：
// username -> username@plyhan.app。真实邮箱不对外，只需要唯一的内部邮箱。
const EMAIL_DOMAIN = "plyhan.app";

export function normalizeUsername(raw) {
  return (raw || "").trim().toLowerCase().replace(/\s+/g, "_");
}

export function usernameEmail(username) {
  return `${normalizeUsername(username)}@${EMAIL_DOMAIN}`;
}

// 从 user 对象里取显示用的用户名
export function usernameOf(user) {
  if (!user) return "";
  const meta = user.user_metadata || {};
  if (meta.username) return meta.username;
  const email = user.email || "";
  return email.split("@")[0];
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1) 初始化：读取持久化的 session（自动恢复登录状态）
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // 2) 监听登录状态变化（登录/登出/token 刷新）
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signUp(username, password) {
    const normalized = normalizeUsername(username);
    const { data, error } = await supabase.auth.signUp({
      email: usernameEmail(normalized),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/login`,
        data: { username: normalized },
      },
    });
    return { data, error, username: normalized };
  }

  async function signIn(username, password) {
    const normalized = normalizeUsername(username);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: usernameEmail(normalized),
      password,
    });
    return { data, error };
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    return { error };
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        loading,
        signUp,
        signIn,
        signOut,
        usernameOf,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
