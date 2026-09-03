import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, usernameOf } from "../auth/AuthContext";

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
    <main className="flex h-screen flex-col overflow-hidden bg-neutral-950 px-4 py-5 font-sans text-neutral-100 sm:px-6 sm:py-8 [height:100dvh]">
      <header className="flex shrink-0 items-center justify-between">
        <p className="text-base font-semibold tracking-tight sm:text-lg">
          PlyHan
        </p>
        <button
          type="button"
          onClick={handleLogout}
          disabled={signingOut}
          className="rounded-none border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:border-red-600 hover:text-white disabled:opacity-50"
        >
          {signingOut ? "登出中…" : "登出"}
        </button>
      </header>

      <div className="flex min-h-0 flex-1 items-center justify-center">
        <div className="w-full max-w-md rounded-none border border-neutral-800 bg-neutral-900 p-6 sm:p-8">
          <h1 className="text-2xl font-bold">仪表盘</h1>
          <p className="mt-1 text-sm text-neutral-500">
            欢迎回来，这里是受保护的登录后页面。
          </p>

          <dl className="mt-6 space-y-3 text-sm">
            <div>
              <dt className="text-neutral-500">用户名</dt>
              <dd className="mt-1 text-neutral-100">{email}</dd>
            </div>
            {createdAt ? (
              <div>
                <dt className="text-neutral-500">注册时间</dt>
                <dd className="mt-1 text-neutral-100">
                  {new Date(createdAt).toLocaleString()}
                </dd>
              </div>
            ) : null}
          </dl>

          <button
            type="button"
            onClick={() => navigate("/")}
            className="mt-8 w-full rounded-none bg-red-600 px-4 py-3 text-sm font-medium text-white"
          >
            开始下棋
          </button>
        </div>
      </div>
    </main>
  );
}
