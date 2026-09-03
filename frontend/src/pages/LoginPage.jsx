import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import AuthShell from "../components/AuthShell";

export default function LoginPage() {
  const { user, loading, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const from = location.state?.from?.pathname || "/dashboard";

  if (!loading && user) {
    return <Navigate to="/dashboard" replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    if (!email || !password) {
      setError("请输入邮箱和密码");
      return;
    }
    setSubmitting(true);
    const { error } = await signIn(email, password);
    setSubmitting(false);

    if (error) {
      // 处理常见错误：密码错误 / 邮箱不存在 / 未验证邮箱
      setError(error.message || "登录失败，请稍后重试");
      return;
    }
    navigate(from, { replace: true });
  }

  const inputClass =
    "w-full rounded-none border bg-white px-3 py-2.5 text-sm text-neutral-900 outline-none focus:border-red-600";

  return (
    <AuthShell
      title="登录"
      subtitle="输入邮箱和密码，继续下棋"
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
          type="email"
          required
          autoComplete="email"
          placeholder="邮箱"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
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
      </form>
    </AuthShell>
  );
}
