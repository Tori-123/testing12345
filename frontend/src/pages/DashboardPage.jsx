import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, usernameOf } from "../auth/AuthContext";
import { ThemeToggle } from "../theme.jsx";

export default function DashboardPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);

  async function handleLogout() {
    setSigningOut(true);
    const { error } = await signOut();
    setSigningOut(false);
    if (error) {
      console.error("登出失败", error.message);
    }
    navigate("/login", { replace: true });
  }

  const email = usernameOf(user) || "未知用户";
  const createdAt = user?.created_at;

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-page px-4 py-5 font-sans text-ink sm:px-6 sm:py-8 [height:100dvh]">
      <header className="flex shrink-0 items-center justify-between gap-3">
        <p className="text-base font-semibold tracking-tight sm:text-lg">
          PlyHan
        </p>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <button
            type="button"
            onClick={handleLogout}
            disabled={signingOut}
            className="rounded-lg border border-line px-4 py-2 text-sm text-ink hover:border-wood hover:text-red-600 disabled:opacity-50"
          >
            {signingOut ? "登出中…" : "登出"}
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 items-center justify-center">
        <div className="w-full max-w-md rounded-lg border border-line bg-surface p-6 sm:p-8">
          <h1 className="text-2xl font-bold">仪表盘</h1>
          <p className="mt-1 text-sm text-muted">
            欢迎回来，这里是受保护的登录后页面。
          </p>

          <dl className="mt-6 space-y-3 text-sm">
            <div>
              <dt className="text-muted">用户名</dt>
              <dd className="mt-1 text-ink">{email}</dd>
            </div>
            {createdAt ? (
              <div>
                <dt className="text-muted">注册时间</dt>
                <dd className="mt-1 text-ink">
                  {new Date(createdAt).toLocaleString()}
                </dd>
              </div>
            ) : null}
          </dl>

          <button
            type="button"
            onClick={() => navigate("/")}
            className="mt-8 w-full rounded-lg bg-red-600 px-4 py-3 text-sm font-medium text-white"
          >
            开始下棋
          </button>
        </div>
      </div>
    </main>
  );
}
