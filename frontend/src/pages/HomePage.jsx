import { useState } from "react";
import { Link } from "react-router-dom";
import ChessGame from "../ChessGame.jsx";
import DraughtsGame from "../DraughtsGame.jsx";
import GomokuGame from "../GomokuGame.jsx";
import XiangqiGame from "../XiangqiGame.jsx";
import { useAuth, usernameOf } from "../auth/AuthContext";

const GAMES = new Set(["chess", "gomoku", "xiangqi", "draughts"]);

function GameCard({ engine, title, hint, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-h-[8.5rem] flex-col justify-between rounded-none border border-neutral-800 bg-neutral-900 p-5 text-left transition-colors hover:border-red-600 sm:min-h-[10rem] sm:p-8 md:h-[min(16rem,38vh)] md:min-h-[11rem]"
    >
      <span className="text-sm text-neutral-500">{engine}</span>
      <span>
        <span className="block text-2xl font-bold sm:text-3xl md:text-4xl">
          {title}
        </span>
        <span className="mt-3 block text-sm text-neutral-500">{hint}</span>
      </span>
      <span className="h-1 w-12 bg-red-600 transition-all group-hover:w-full" />
    </button>
  );
}

function ModePicker({ onSelect, user, signingOut, onLogout }) {
  return (
    <main className="flex h-screen flex-col overflow-hidden bg-neutral-950 px-4 py-5 font-sans text-neutral-100 sm:px-6 sm:py-8 [height:100dvh] [padding-top:max(1.25rem,env(safe-area-inset-top))] [padding-bottom:max(1.25rem,env(safe-area-inset-bottom))] [padding-left:max(1rem,env(safe-area-inset-left))] [padding-right:max(1rem,env(safe-area-inset-right))]">
      <header className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-base font-semibold tracking-tight sm:text-lg">PlyHan</p>
          <h1 className="mt-3 text-3xl font-bold leading-tight sm:mt-6 sm:text-4xl md:mt-10 md:text-5xl">
            今天下哪一种？
          </h1>
        </div>
        <div className="flex flex-col items-start gap-3 sm:items-end">
          <p className="max-w-md text-sm leading-relaxed text-neutral-500 sm:max-w-sm sm:text-right">
            选一个棋盘。国际象棋、五子棋、中国象棋、跳棋都可以对电脑或开房间联机。
          </p>
          <div className="flex items-center gap-4 text-sm">
            <Link
              to="/tournament"
              className="font-medium text-red-600 underline underline-offset-2"
            >
              竞标赛
            </Link>
            {user ? (
              <div className="flex items-center gap-3">
                <span className="text-neutral-500">{usernameOf(user)}</span>
                <button
                  type="button"
                  onClick={onLogout}
                  disabled={signingOut}
                  className="text-red-600 underline underline-offset-2 disabled:opacity-50"
                >
                  {signingOut ? "登出中…" : "登出"}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Link
                  to="/login"
                  className="text-red-600 underline underline-offset-2"
                >
                  登录
                </Link>
                <Link
                  to="/register"
                  className="text-neutral-400 underline underline-offset-2"
                >
                  注册
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>
      <div className="mt-4 grid min-h-0 flex-1 grid-cols-1 content-start gap-3 overflow-y-auto sm:mt-6 sm:grid-cols-2 sm:gap-4 md:content-center md:items-stretch">
        <GameCard
          engine="Chess API"
          title="国际象棋"
          hint="人机或开房间联机"
          onClick={() => onSelect("chess")}
        />
        <GameCard
          engine="Rapfi"
          title="五子棋"
          hint="人机或开房间联机"
          onClick={() => onSelect("gomoku")}
        />
        <GameCard
          engine="Pikafish"
          title="中国象棋"
          hint="人机或开房间联机"
          onClick={() => onSelect("xiangqi")}
        />
        <GameCard
          engine="本机搜索"
          title="跳棋"
          hint="8×8 英美规则，支持人机与联机"
          onClick={() => onSelect("draughts")}
        />
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
