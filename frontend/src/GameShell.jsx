export function GameHeader({ onBack, slogan }) {
  return (
    <header className="flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-2 sm:px-4 sm:py-3">
      <div className="flex min-w-0 items-center gap-3 sm:gap-4">
        <span className="text-base font-semibold tracking-tight sm:text-lg">
          PlyHan
        </span>
        <button
          type="button"
          onClick={onBack}
          className="shrink-0 text-sm text-neutral-500 underline underline-offset-2 hover:text-neutral-100"
        >
          选择棋种
        </button>
      </div>
      {slogan ? (
        <p className="hidden min-w-0 text-right text-xs leading-relaxed text-neutral-500 sm:block sm:max-w-[58%] sm:text-sm">
          {slogan}
        </p>
      ) : null}
    </header>
  );
}

export function GameScreen({ header, board, panel, modal }) {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-neutral-950 font-sans text-neutral-100 [height:100dvh] [padding:env(safe-area-inset-top)_env(safe-area-inset-right)_env(safe-area-inset-bottom)_env(safe-area-inset-left)]">
      {header}
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-3 pb-3 sm:gap-4 sm:px-4 sm:pb-4 max-lg:landscape:flex-row lg:flex-row">
        <div className="flex min-h-0 min-w-0 flex-1">{board}</div>
        <aside className="flex min-h-0 min-w-0 flex-none flex-col overflow-hidden rounded-none bg-white text-neutral-900 shadow-sm h-[min(42%,22rem)] min-h-[11.5rem] p-3 sm:p-5 max-lg:landscape:h-auto max-lg:landscape:min-h-0 max-lg:landscape:w-[min(42vw,20rem)] lg:h-auto lg:min-h-0 lg:w-[min(38%,26rem)] lg:p-6">
          <div className="flex min-h-0 flex-1 flex-col">{panel}</div>
        </aside>
      </div>
      {modal}
    </div>
  );
}

export function GameOverDialog({ title, message, onRestart, onDismiss }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="game-over-title"
        className="w-[min(90vw,22rem)] max-h-[min(90dvh,32rem)] overflow-y-auto rounded-none bg-white px-6 py-8 text-center text-neutral-900 shadow-sm sm:px-8 sm:py-10"
      >
        <p
          id="game-over-title"
          className="text-3xl font-bold text-red-600 sm:text-4xl"
        >
          {title}
        </p>
        <p className="mt-4 text-sm leading-relaxed sm:text-base">{message}</p>
        <button
          type="button"
          onClick={onRestart}
          className="mt-8 w-full rounded-none bg-red-600 px-4 py-3 text-sm font-medium text-white"
        >
          再来一局
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="mt-3 w-full text-sm text-neutral-500 underline underline-offset-2"
        >
          留下看棋盘
        </button>
      </div>
    </div>
  );
}

export function GameControls({ children }) {
  return (
    <div className="mt-4 flex flex-wrap gap-2">{children}</div>
  );
}

export function MoveHistory({ title, empty, children }) {
  return (
    <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
      <h2 className="text-xs font-semibold tracking-wide text-neutral-500">
        {title}
      </h2>
      {children ? (
        children
      ) : (
        <p className="mt-2 text-sm text-neutral-500">{empty}</p>
      )}
    </div>
  );
}
