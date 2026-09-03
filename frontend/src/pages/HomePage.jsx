import { useState } from "react";
import { Link } from "react-router-dom";
import ChessGame from "../ChessGame.jsx";
import DraughtsGame from "../DraughtsGame.jsx";
import GomokuGame from "../GomokuGame.jsx";
import XiangqiGame from "../XiangqiGame.jsx";

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

function ModePicker({ onSelect }) {
  return (
    <main className="flex h-screen flex-col overflow-hidden bg-neutral-950 px-4 py-5 font-sans text-neutral-100 sm:px-6 sm:py-8 [height:100dvh] [padding-top:max(1.25rem,env(safe-area-inset-top))] [padding-bottom:max(1.25rem,env(safe-area-inset-bottom))] [padding-left:max(1rem,env(safe-area-inset-left))] [padding-right:max(1rem,env(safe-area-inset-right))]">
      <header className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-base font-semibold tracking-tight sm:text-lg">PlyHan</p>
          <h1 className="mt-3 text-3xl font-bold leading-tight sm:mt-6 sm:text-4xl md:mt-10 md:text-5xl">
            今天下哪一种？
          </h1>
        </div>
        <div className="max-w-md sm:max-w-sm sm:text-right">
          <p className="text-sm leading-relaxed text-neutral-500">
            选一个棋盘。国际象棋、五子棋、中国象棋可以对电脑或开房间；跳棋目前只对人机。
          </p>
          <Link
            to="/dashboard"
            className="mt-3 inline-block text-sm text-neutral-400 underline underline-offset-2 hover:text-red-600"
          >
            账号
          </Link>
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
          hint="8×8 英美规则，只对人机"
          onClick={() => onSelect("draughts")}
        />
      </div>
    </main>
  );
}

export default function HomePage() {
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
    return <DraughtsGame onBack={goHome} />;
  }
  return (
    <ModePicker
      onSelect={(game) => {
        setRoomCode("");
        setSelectedGame(game);
      }}
    />
  );
}
