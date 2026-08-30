import { useState } from "react";
import ChessGame from "./ChessGame.jsx";
import GomokuGame from "./GomokuGame.jsx";
import XiangqiGame from "./XiangqiGame.jsx";

const GAMES = new Set(["chess", "gomoku", "xiangqi"]);

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
        <p className="max-w-md text-sm leading-relaxed text-neutral-500 sm:max-w-sm sm:text-right">
          选一个棋盘。可以对电脑，也可以开房间把链接发给对方。
        </p>
      </header>
      <div className="mt-4 grid min-h-0 flex-1 grid-cols-1 content-start gap-3 overflow-y-auto sm:mt-6 sm:gap-4 md:grid-cols-3 md:content-center md:items-stretch">
        <button
          type="button"
          onClick={() => onSelect("chess")}
          className="group flex min-h-[8.5rem] flex-col justify-between rounded-none border border-neutral-800 bg-neutral-900 p-5 text-left transition-colors hover:border-red-600 sm:min-h-[10rem] sm:p-8 md:h-[min(16rem,42vh)] md:min-h-[12rem]"
        >
          <span className="text-sm text-neutral-500">Chess API</span>
          <span>
            <span className="block text-2xl font-bold sm:text-3xl md:text-4xl">
              国际象棋
            </span>
            <span className="mt-3 block text-sm text-neutral-500">
              人机或开房间联机
            </span>
          </span>
          <span className="h-1 w-12 bg-red-600 transition-all group-hover:w-full" />
        </button>
        <button
          type="button"
          onClick={() => onSelect("gomoku")}
          className="group flex min-h-[8.5rem] flex-col justify-between rounded-none border border-neutral-800 bg-neutral-900 p-5 text-left transition-colors hover:border-red-600 sm:min-h-[10rem] sm:p-8 md:h-[min(16rem,42vh)] md:min-h-[12rem]"
        >
          <span className="text-sm text-neutral-500">Rapfi</span>
          <span>
            <span className="block text-2xl font-bold sm:text-3xl md:text-4xl">
              五子棋
            </span>
            <span className="mt-3 block text-sm text-neutral-500">
              人机或开房间联机
            </span>
          </span>
          <span className="h-1 w-12 bg-red-600 transition-all group-hover:w-full" />
        </button>
        <button
          type="button"
          onClick={() => onSelect("xiangqi")}
          className="group flex min-h-[8.5rem] flex-col justify-between rounded-none border border-neutral-800 bg-neutral-900 p-5 text-left transition-colors hover:border-red-600 sm:min-h-[10rem] sm:p-8 md:h-[min(16rem,42vh)] md:min-h-[12rem]"
        >
          <span className="text-sm text-neutral-500">Pikafish</span>
          <span>
            <span className="block text-2xl font-bold sm:text-3xl md:text-4xl">
              中国象棋
            </span>
            <span className="mt-3 block text-sm text-neutral-500">
              人机或开房间联机
            </span>
          </span>
          <span className="h-1 w-12 bg-red-600 transition-all group-hover:w-full" />
        </button>
      </div>
    </main>
  );
}

export default function App() {
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
  return (
    <ModePicker
      onSelect={(game) => {
        setRoomCode("");
        setSelectedGame(game);
      }}
    />
  );
}
