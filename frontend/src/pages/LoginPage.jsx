import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth, normalizeUsername } from "../auth/AuthContext";
import AuthShell from "../components/AuthShell";

export default function LoginPage() {
  const { user, loading, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const fromLocation = location.state?.from;
  const from = fromLocation
    ? `${fromLocation.pathname}${fromLocation.search}`
    : "/dashboard";

  if (!loading && user) {
    return <Navigate to="/dashboard" replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    const name = normalizeUsername(username);
    if (!name || !password) {
      setError("请输入用户名和密码");
      return;
    }
    setSubmitting(true);
    const { error } = await signIn(name, password);
    setSubmitting(false);

    if (error) {
      // 常见错误：用户名不存在 / 密码错误
      setError(error.message || "登录失败，请检查用户名或密码");
      return;
    }
    navigate(from, { replace: true });
  }

  const inputClass =
    "w-full rounded-none border bg-white px-3 py-2.5 text-sm text-neutral-900 outline-none focus:border-red-600";

  return (
    <AuthShell
      title="登录"
      subtitle="输入用户名和密码"
      footer={
        <p className="text-sm text-neutral-500">
          还没有账号？{" "}
          <Link
            to="/register"
            className="text-red-600 underline underline-offset-2"
          >
            注册
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="text"
          required
          autoComplete="username"
          placeholder="用户名"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className={inputClass}
        />
        <input
          type="password"
          required
          autoComplete="current-password"
          placeholder="密码"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
        />
        {error ? (
          <p className="text-sm text-red-500" role="alert">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-none bg-red-600 px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
        >
          {submitting ? "登录中…" : "登录"}
        </button>
        <button
          type="button"
          onClick={() => navigate("/")}
          className="w-full rounded-none border border-neutral-700 px-4 py-3 text-sm text-neutral-300 hover:border-red-600 hover:text-white"
        >
          先不登录，直接下棋
        </button>
      </form>
    </AuthShell>
  );
}
