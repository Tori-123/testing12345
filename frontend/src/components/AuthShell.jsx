// 认证页（登录/注册）共用的外壳，沿用 PlyHan 的暗色 + 红色强调风格。
export default function AuthShell({ title, subtitle, children, footer }) {
  return (
    <main className="flex h-screen flex-col items-center justify-center overflow-hidden bg-neutral-950 px-5 py-6 font-sans text-neutral-100 [height:100dvh]">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <p className="text-base font-semibold tracking-tight">PlyHan</p>
          <h1 className="mt-2 text-2xl font-bold">{title}</h1>
          {subtitle ? (
            <p className="mt-2 text-sm text-neutral-500">{subtitle}</p>
          ) : null}
        </div>
        {children}
        {footer ? <div className="mt-6 text-center">{footer}</div> : null}
      </div>
    </main>
  );
}
