import { useState } from "react";
import { ThemeToggle } from "./theme.jsx";

export function useLobbyMode({
  initialRoomCode = "",
  initialMode = "",
  initialSeat,
  onRoomCode,
  defaultSeat,
}) {
  const [mode, setMode] = useState(
    initialMode
      ? initialMode
      : initialRoomCode
        ? "online"
        : "",
  );
  const [roomCode, setRoomCode] = useState((initialRoomCode || "").toUpperCase());
  const [joinDraft, setJoinDraft] = useState((initialRoomCode || "").toUpperCase());
  const [lobbyError, setLobbyError] = useState("");
  const [seat, setSeat] = useState(initialSeat || defaultSeat);
  const [clockEnabled, setClockEnabled] = useState(true);

  function leaveRoom() {
    setLobbyError("");
    setRoomCode("");
    setJoinDraft("");
    setMode("");
    onRoomCode?.("");
  }

  function createRoom() {
    setLobbyError("");
    setRoomCode("");
    setMode("online");
  }

  function joinRoom() {
    const nextCode = joinDraft.trim().toUpperCase();
    if (!nextCode) {
      setLobbyError("请输入房间码。");
      return;
    }
    setLobbyError("");
    setRoomCode(nextCode);
    setMode("online");
  }

  return {
    mode,
    setMode,
    roomCode,
    joinDraft,
    setJoinDraft,
    lobbyError,
    seat,
    setSeat,
    clockEnabled,
    setClockEnabled,
    leaveRoom,
    createRoom,
    joinRoom,
  };
}

export default function GameLobby({
  title,
  blurb,
  engineLabel,
  engineHint,
  onlineHint,
  seat,
  seats,
  onSeat,
  onBack,
  onAi,
  onCreate,
  joinDraft,
  onJoinDraft,
  onJoin,
  errorMessage,
  clockEnabled = true,
  onClockEnabled,
}) {
  return (
    <main className="flex h-screen flex-col overflow-hidden bg-page px-4 py-5 font-sans text-ink sm:px-6 sm:py-8 [height:100dvh]">
      <header className="flex shrink-0 items-center gap-3 sm:gap-4">
        <span className="text-base font-semibold tracking-tight sm:text-lg">
          PlyHan
        </span>
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-muted underline underline-offset-2 hover:text-ink"
        >
          返回
        </button>
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-muted underline underline-offset-2 hover:text-ink"
        >
          回主界面
        </button>
        <ThemeToggle className="ml-auto" />
      </header>
      <div className="min-w-0">
        <h1 className="mt-8 text-3xl font-bold leading-tight sm:text-4xl">
          {title}
        </h1>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-muted">
          {blurb}
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {seats.map((option) => {
            const active = seat === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => onSeat(option.id)}
                className={`rounded-none border px-3 py-1.5 text-sm ${
                  active
                    ? "border-red-600 bg-red-600 text-white"
                    : "border-line bg-surface text-ink"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="mt-8 grid min-h-0 flex-1 grid-cols-1 content-start gap-3 overflow-y-auto sm:gap-4 md:grid-cols-2">
        <button
          type="button"
          onClick={onAi}
          className="group flex min-h-[8.5rem] flex-col justify-between rounded-none border border-line bg-surface p-5 text-left transition-colors hover:border-red-600 sm:p-8"
        >
          <span className="text-sm text-muted">{engineLabel}</span>
          <span>
            <span className="block text-2xl font-bold">自己对电脑</span>
            <span className="mt-3 block text-sm text-muted">
              {engineHint}
            </span>
          </span>
          <span className="h-1 w-12 bg-red-600 transition-all group-hover:w-full" />
        </button>
        <div className="flex min-h-[8.5rem] flex-col justify-between rounded-none border border-line bg-surface p-5 sm:p-8">
          <span className="text-sm text-muted">联机</span>
          <span>
            <span className="block text-2xl font-bold">创建房间</span>
            <span className="mt-3 block text-sm text-muted">
              {onlineHint}
            </span>
          </span>
          {onClockEnabled ? (
            <div className="mt-4">
              <p className="text-sm text-muted">联机步时</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onClockEnabled(true)}
                  className={`rounded-none border px-3 py-1.5 text-sm ${
                    clockEnabled
                      ? "border-red-600 bg-red-600 text-white"
                      : "border-line bg-surface text-ink"
                  }`}
                >
                  每手 60 秒
                </button>
                <button
                  type="button"
                  onClick={() => onClockEnabled(false)}
                  className={`rounded-none border px-3 py-1.5 text-sm ${
                    !clockEnabled
                      ? "border-red-600 bg-red-600 text-white"
                      : "border-line bg-surface text-ink"
                  }`}
                >
                  不限时
                </button>
              </div>
            </div>
          ) : null}
          <button
            type="button"
            onClick={onCreate}
            className="mt-4 self-start rounded-none bg-red-600 px-4 py-2 text-sm font-medium text-white"
          >
            创建房间
          </button>
        </div>
      </div>
      <form
        className="mt-4 shrink-0 border-t border-line pt-4"
        onSubmit={(event) => {
          event.preventDefault();
          onJoin();
        }}
      >
        <label className="block text-sm text-muted">加入房间</label>
        <div className="mt-2 flex flex-wrap gap-2">
          <input
            value={joinDraft}
            onChange={(event) => onJoinDraft(event.target.value.toUpperCase())}
            placeholder="输入房间码"
            maxLength={8}
            className="min-w-0 flex-1 rounded-none border border-line bg-surface px-3 py-2 font-mono tracking-widest text-ink outline-none focus:border-red-600"
          />
          <button
            type="submit"
            className="rounded-none bg-red-600 px-4 py-2 text-sm font-medium text-white"
          >
            加入
          </button>
        </div>
        {errorMessage ? (
          <p className="mt-2 text-sm text-red-600">{errorMessage}</p>
        ) : null}
      </form>
    </main>
  );
}
