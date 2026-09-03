import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import AuthShell from "../components/AuthShell";

export default function RegisterPage() {
  const { user, loading, signUp } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  if (!loading && user) {
    return <Navigate to="/dashboard" replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setNotice("");

    if (!email || !password || !confirm) {
      setError("请填写所有字段");
      return;
    }
    if (password !== confirm) {
      setError("两次输入的密码不一致");
      return;
    }
    if (password.length < 6) {
      setError("密码至少需要 6 个字符");
      return;
    }

    setSubmitting(true);
    const { data, error } = await signUp(email, password);
    setSubmitting(false);

    if (error) {
      // 处理常见错误：邮箱已存在 / 密码太短 / 格式非法
      setError(error.message || "注册失败，请稍后重试");
      return;
    }

    // 若该 Supabase 项目未开启邮箱确认，注册即登录；否则提示去邮箱确认
    if (data.session) {
      navigate("/dashboard", { replace: true });
    } else {
      setNotice("注册成功，请前往邮箱确认后再登录。");
    }
  }

  const inputClass =
    "w-full rounded-none border bg-white px-3 py-2.5 text-sm text-neutral-900 outline-none focus:border-red-600";

  return (
    <AuthShell
      title="注册"
      subtitle="创建账号，保存你的对局体验"
      footer={
        <p className="text-sm text-neutral-500">
          已有账号？{" "}
          <Link to="/login" className="text-red-600 underline underline-offset-2">
            登录
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
          autoComplete="new-password"
          placeholder="密码（至少 6 位）"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
        />
        <input
          type="password"
          required
          autoComplete="new-password"
          placeholder="确认密码"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className={inputClass}
        />
        {error ? (
          <p className="text-sm text-red-500" role="alert">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p className="text-sm text-green-500" role="status">
            {notice}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-none bg-red-600 px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
        >
          {submitting ? "注册中…" : "注册"}
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
