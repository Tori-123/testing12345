import { ThemeToggle } from "../theme.jsx";

// 认证页（登录/注册）共用的外壳，跟随全站浅色/深色主题。
export default function AuthShell({ title, subtitle, children, footer }) {
  return (
    <main className="relative flex h-screen flex-col items-center justify-center overflow-hidden bg-page px-5 py-6 font-sans text-ink [height:100dvh]">
      <div className="absolute right-5 top-5">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <p className="text-base font-semibold tracking-tight">PlyHan</p>
          <h1 className="mt-2 text-2xl font-bold">{title}</h1>
          {subtitle ? (
            <p className="mt-2 text-sm text-muted">{subtitle}</p>
          ) : null}
        </div>
        {children}
        {footer ? <div className="mt-6 text-center">{footer}</div> : null}
      </div>
    </main>
  );
}
