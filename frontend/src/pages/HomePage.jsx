import { useState } from "react";
import { Link } from "react-router-dom";
import ChessGame from "../ChessGame.jsx";
import DraughtsGame from "../DraughtsGame.jsx";
import GomokuGame from "../GomokuGame.jsx";
import XiangqiGame from "../XiangqiGame.jsx";
import { useAuth, usernameOf } from "../auth/AuthContext";
import { ThemeToggle } from "../theme.jsx";

const GAMES = new Set(["chess", "gomoku", "xiangqi", "draughts"]);

function MiniChess() {
  return (
    <div className="grid h-12 w-12 shrink-0 grid-cols-8 grid-rows-8 overflow-hidden rounded-md sm:h-14 sm:w-14">
      {Array.from({ length: 64 }, (_, i) => {
        const dark = (Math.floor(i / 8) + (i % 8)) % 2 === 1;
        return (
          <span
            key={i}
            className={dark ? "bg-[#b58863]" : "bg-[#f0d9b5]"}
          />
        );
      })}
    </div>
  );
}

function MiniGomoku() {
  return (
    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-[#d9a45f] sm:h-14 sm:w-14">
      <div className="absolute inset-[12%] grid grid-cols-6 grid-rows-6">
        {Array.from({ length: 36 }, (_, i) => (
          <span key={i} className="border border-black/25" />
        ))}
      </div>
    </div>
  );
}

function MiniXiangqi() {
  return (
    <div className="grid h-12 w-12 shrink-0 grid-cols-4 grid-rows-5 overflow-hidden rounded-md border border-[#8b3a2a] bg-[#f4e3c1] sm:h-14 sm:w-14">
      {Array.from({ length: 20 }, (_, i) => (
        <span key={i} className="border border-[#8b3a2a]/40" />
      ))}
    </div>
  );
}

function MiniDraughts() {
  return (
    <div className="grid h-12 w-12 shrink-0 grid-cols-8 grid-rows-8 overflow-hidden rounded-md sm:h-14 sm:w-14">
      {Array.from({ length: 64 }, (_, i) => {
        const dark = (Math.floor(i / 8) + (i % 8)) % 2 === 1;
        return (
          <span
            key={i}
            className={dark ? "bg-[#7a4b28]" : "bg-[#e8c992]"}
          />
        );
      })}
    </div>
  );
}

function TournamentDoor() {
  return (
    <svg
      viewBox="0 0 140 200"
      className="h-36 w-[6.3rem] sm:h-44 sm:w-[7.7rem] md:h-52 md:w-[9.1rem]"
      aria-hidden="true"
    >
      <path
        d="M18 78 C18 38 42 12 70 12 C98 12 122 38 122 78 V188 H18 Z"
        fill="#4a3f36"
      />
      <path
        d="M26 80 C26 44 46 22 70 22 C94 22 114 44 114 80 V180 H26 Z"
        fill="#c4a574"
      />
      <path
        d="M32 82 C32 48 50 28 70 28 C90 28 108 48 108 82 V174 H32 Z"
        fill="#6b4226"
      />
      <rect x="40" y="48" width="24" height="36" rx="2" fill="#3c2f23" />
      <rect x="76" y="48" width="24" height="36" rx="2" fill="#3c2f23" />
      <rect x="40" y="96" width="24" height="52" rx="2" fill="#5a351c" />
      <rect x="76" y="96" width="24" height="52" rx="2" fill="#5a351c" />
      <rect x="66" y="28" width="8" height="146" fill="#8b5a2b" />
      <circle cx="96" cy="108" r="5" fill="#d4af37" />
      <circle cx="96" cy="108" r="2" fill="#6b4226" />
      <rect x="10" y="180" width="120" height="10" rx="2" fill="#3d3935" />
      <rect x="22" y="172" width="96" height="10" rx="1" fill="#5c534c" />
    </svg>
  );
}

function GameCard({ thumb, title, hint, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-h-[6.5rem] items-stretch gap-3 rounded-lg border border-line bg-surface p-3 text-left transition-colors hover:border-wood sm:min-h-[7.5rem] sm:p-4"
    >
      {thumb}
      <span className="flex min-w-0 flex-1 flex-col justify-between">
        <span>
          <span className="block text-lg font-bold sm:text-xl">{title}</span>
          <span className="mt-1 block text-xs text-muted sm:text-sm">{hint}</span>
        </span>
        <span className="h-1 w-8 rounded-full bg-red-600 transition-all group-hover:w-full" />
      </span>
    </button>
  );
}

function ModePicker({ onSelect, user, signingOut, onLogout }) {
  return (
    <main className="flex h-screen flex-col overflow-hidden bg-page font-sans text-ink [height:100dvh]">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-line bg-surface px-4 py-3 sm:px-6 [padding-top:max(0.75rem,env(safe-area-inset-top))]">
        <p className="text-lg font-bold tracking-tight">PlyHan</p>
        <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
          <ThemeToggle />
          {user ? (
            <>
              <span className="hidden text-sm text-muted sm:inline">
                {usernameOf(user)}
              </span>
              <button
                type="button"
                onClick={onLogout}
                disabled={signingOut}
                className="rounded-lg border border-line px-3 py-1.5 text-sm text-ink disabled:opacity-50"
              >
                {signingOut ? "登出中…" : "登出"}
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white"
              >
                登录
              </Link>
              <Link
                to="/register"
                className="rounded-lg border border-line px-3 py-1.5 text-sm text-ink"
              >
                注册
              </Link>
            </>
          )}
        </div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col px-4 py-5 sm:px-6 sm:py-8 [padding-bottom:max(1.25rem,env(safe-area-inset-bottom))]">
        <div className="shrink-0">
          <h1 className="text-3xl font-bold leading-tight sm:text-4xl md:text-5xl">
            今天下哪一种？
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
            选一个棋盘。国际象棋、五子棋、中国象棋、跳棋都可以对电脑或开房间联机。
          </p>
        </div>
        <div className="mt-5 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto lg:flex-row lg:items-stretch lg:gap-4">
          <div className="grid grid-cols-1 content-start gap-3 sm:grid-cols-2 sm:gap-3 lg:w-[58%] lg:shrink-0">
            <GameCard
              thumb={<MiniChess />}
              title="国际象棋"
              hint="人机或开房间联机"
              onClick={() => onSelect("chess")}
            />
            <GameCard
              thumb={<MiniGomoku />}
              title="五子棋"
              hint="人机或开房间联机"
              onClick={() => onSelect("gomoku")}
            />
            <GameCard
              thumb={<MiniXiangqi />}
              title="中国象棋"
              hint="人机或开房间联机"
              onClick={() => onSelect("xiangqi")}
            />
            <GameCard
              thumb={<MiniDraughts />}
              title="跳棋"
              hint="8×8 英美规则，支持人机与联机"
              onClick={() => onSelect("draughts")}
            />
          </div>
          <Link
            to="/tournament"
            className="group flex min-h-[10rem] flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-line bg-surface px-4 py-5 text-center transition-colors hover:border-wood sm:min-h-[12rem] lg:min-h-0"
          >
            <TournamentDoor />
            <span className="text-xl font-bold sm:text-2xl">竞标赛</span>
            <span className="text-sm text-muted">随机匹配，积分上榜</span>
            <span className="h-1 w-10 rounded-full bg-red-600 transition-all group-hover:w-24" />
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function HomePage() {
  const { user, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [selectedGame, setSelectedGame] = useState(() => {
    const game = new URLSearchParams(window.location.search).get("game");
    return GAMES.has(game) ? game : null;
  });
  const [roomCode, setRoomCode] = useState(
    () =>
      (new URLSearchParams(window.location.search).get("r") || "").toUpperCase(),
  );

  function clearInvite() {
    const url = new URL(window.location.href);
    url.searchParams.delete("game");
    url.searchParams.delete("r");
    window.history.replaceState({}, "", url);
    setRoomCode("");
  }

  function writeInvite(game, code) {
    const next = (code || "").toUpperCase();
    const url = new URL(window.location.href);
    url.searchParams.set("game", game);
    if (next) url.searchParams.set("r", next);
    else url.searchParams.delete("r");
    window.history.replaceState({}, "", url);
    setRoomCode(next);
  }

  function goHome() {
    clearInvite();
    setSelectedGame(null);
  }

  async function handleLogout() {
    setSigningOut(true);
    const { error } = await signOut();
    setSigningOut(false);
    if (error) {
      console.error("登出失败", error.message);
    }
  }

  if (selectedGame === "chess") {
    return (
      <ChessGame
        initialRoomCode={roomCode}
        onBack={goHome}
        onRoomCode={(code) => writeInvite("chess", code)}
      />
    );
  }
  if (selectedGame === "gomoku") {
    return (
      <GomokuGame
        initialRoomCode={roomCode}
        onBack={goHome}
        onRoomCode={(code) => writeInvite("gomoku", code)}
      />
    );
  }
  if (selectedGame === "xiangqi") {
    return (
      <XiangqiGame
        initialRoomCode={roomCode}
        onBack={goHome}
        onRoomCode={(code) => writeInvite("xiangqi", code)}
      />
    );
  }
  if (selectedGame === "draughts") {
    return (
      <DraughtsGame
        initialRoomCode={roomCode}
        onBack={goHome}
        onRoomCode={(code) => writeInvite("draughts", code)}
      />
    );
  }
  return (
    <ModePicker
      user={user}
      signingOut={signingOut}
      onLogout={handleLogout}
      onSelect={(game) => {
        setRoomCode("");
        setSelectedGame(game);
      }}
    />
  );
}
