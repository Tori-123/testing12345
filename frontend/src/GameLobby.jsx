import { useState } from "react";

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
    <main className="flex h-screen flex-col overflow-hidden bg-neutral-950 px-4 py-5 font-sans text-neutral-100 sm:px-6 sm:py-8 [height:100dvh]">
      <header className="flex shrink-0 items-center gap-3 sm:gap-4">
        <span className="text-base font-semibold tracking-tight sm:text-lg">
          PlyHan
        </span>
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-neutral-500 underline underline-offset-2 hover:text-neutral-100"
        >
          返回
        </button>
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-neutral-500 underline underline-offset-2 hover:text-neutral-100"
        >
          回主界面
        </button>
      </header>
      <div className="min-w-0">
        <h1 className="mt-8 text-3xl font-bold leading-tight sm:text-4xl">
          {title}
        </h1>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-neutral-500">
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
                    : "border-neutral-700 bg-neutral-900 text-neutral-100"
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
          className="group flex min-h-[8.5rem] flex-col justify-between rounded-none border border-neutral-800 bg-neutral-900 p-5 text-left transition-colors hover:border-red-600 sm:p-8"
        >
          <span className="text-sm text-neutral-500">{engineLabel}</span>
          <span>
            <span className="block text-2xl font-bold">自己对电脑</span>
            <span className="mt-3 block text-sm text-neutral-500">
              {engineHint}
            </span>
          </span>
          <span className="h-1 w-12 bg-red-600 transition-all group-hover:w-full" />
        </button>
        <div className="flex min-h-[8.5rem] flex-col justify-between rounded-none border border-neutral-800 bg-neutral-900 p-5 sm:p-8">
          <span className="text-sm text-neutral-500">联机</span>
          <span>
            <span className="block text-2xl font-bold">创建房间</span>
            <span className="mt-3 block text-sm text-neutral-500">
              {onlineHint}
            </span>
          </span>
          {onClockEnabled ? (
            <div className="mt-4">
              <p className="text-sm text-neutral-500">联机步时</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onClockEnabled(true)}
                  className={`rounded-none border px-3 py-1.5 text-sm ${
                    clockEnabled
                      ? "border-red-600 bg-red-600 text-white"
                      : "border-neutral-700 bg-neutral-800 text-neutral-100"
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
                      : "border-neutral-700 bg-neutral-800 text-neutral-100"
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
        className="mt-4 shrink-0 border-t border-neutral-800 pt-4"
        onSubmit={(event) => {
          event.preventDefault();
          onJoin();
        }}
      >
        <label className="block text-sm text-neutral-500">加入房间</label>
        <div className="mt-2 flex flex-wrap gap-2">
          <input
            value={joinDraft}
            onChange={(event) => onJoinDraft(event.target.value.toUpperCase())}
            placeholder="输入房间码"
            maxLength={8}
            className="min-w-0 flex-1 rounded-none border border-neutral-700 bg-neutral-900 px-3 py-2 font-mono tracking-widest text-neutral-100 outline-none focus:border-red-600"
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
