import { useMemo, useRef, useState } from "react";
import GomokuBoard from "./GomokuBoard.jsx";
import GomokuOnline from "./GomokuOnline.jsx";
import {
  DifficultySelect,
  GameControls,
  GameHeader,
  GameOverDialog,
  GameScreen,
  MoveHistory,
} from "./GameShell.jsx";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";
const GOMOKU_URL = `${API_BASE_URL}/api/v1/gomoku/play`;
const FETCH_TIMEOUT_MS = 30000;
const MIN_THINKING_MS = 0;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function coordinate(move) {
  if (!move) return "";
  return `${String.fromCharCode(65 + move.col)}${move.row + 1}`;
}

function resultCopy(result) {
  if (result === "black") return "五子连珠。你赢了。";
  if (result === "white") return "五子连珠。电脑赢了。";
  if (result === "draw") return "棋盘已满，和棋。";
  return "对局结束。";
}

async function postGomoku(moves, difficulty) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(GOMOKU_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ moves, difficulty }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function GomokuHeader({ onBack }) {
  return (
    <GameHeader onBack={onBack} slogan="你执黑。落一子，Rapfi 回一子。" />
  );
}

function GomokuGameOver({ result, onRestart, onDismiss }) {
  return (
    <GameOverDialog
      title="对局结束"
      message={resultCopy(result)}
      onRestart={onRestart}
      onDismiss={onDismiss}
    />
  );
}

function GomokuAiGame({ onBack }) {
  const [moves, setMoves] = useState([]);
  const [phase, setPhase] = useState("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [gameOver, setGameOver] = useState(false);
  const [result, setResult] = useState("");
  const [overOpen, setOverOpen] = useState(false);
  const [difficulty, setDifficulty] = useState("easy");
  const requestGeneration = useRef(0);

  const waitingForEngine = moves.length % 2 === 1 && !gameOver;
  const busy = phase !== "idle" || gameOver || waitingForEngine;
  const history = useMemo(() => {
    const rows = [];
    for (let index = 0; index < moves.length; index += 2) {
      rows.push({
        number: index / 2 + 1,
        black: coordinate(moves[index]),
        white: coordinate(moves[index + 1]),
      });
    }
    return rows;
  }, [moves]);

  function applyResponse(data) {
    if (!data || !Array.isArray(data.moves)) {
      setErrorMessage("五子棋服务返回异常。");
      return;
    }
    setMoves(data.moves);
    setErrorMessage(data.error_message || "");
    setGameOver(Boolean(data.game_over));
    setResult(data.result || "");
    if (data.game_over) setOverOpen(true);
  }

  async function askRapfi(nextMoves) {
    const generation = ++requestGeneration.current;
    const startedAt = performance.now();
    setPhase("thinking");
    setErrorMessage("");
    try {
      const data = await postGomoku(nextMoves, difficulty);
      if (generation !== requestGeneration.current) return;
      const remaining = MIN_THINKING_MS - (performance.now() - startedAt);
      if (remaining > 0) await sleep(remaining);
      if (generation !== requestGeneration.current) return;
      applyResponse(data);
    } catch (error) {
      if (generation !== requestGeneration.current) return;
      setErrorMessage(
        error?.name === "AbortError"
          ? "Rapfi 思考超时，请重试。"
          : "连不上五子棋服务，请确认后端和 Rapfi 已启动。",
      );
    } finally {
      if (generation === requestGeneration.current) setPhase("idle");
    }
  }

  function handlePointClick(row, col) {
    if (busy) return;
    if (moves.some((move) => move.row === row && move.col === col)) return;
    const nextMoves = [...moves, { row, col, player: "black" }];
    setMoves(nextMoves);
    askRapfi(nextMoves);
  }

  function handleRestart() {
    requestGeneration.current += 1;
    setMoves([]);
    setPhase("idle");
    setErrorMessage("");
    setGameOver(false);
    setResult("");
    setOverOpen(false);
  }

  const statusLine = gameOver
    ? resultCopy(result)
    : phase === "thinking"
      ? "Rapfi 正在想…"
      : waitingForEngine
        ? "轮到电脑。"
        : "轮到你走。点击棋盘交叉点落下黑子。";

  return (
    <GameScreen
      header={<GomokuHeader onBack={onBack} />}
      board={
        <GomokuBoard
          moves={moves}
          disabled={busy}
          onPointClick={handlePointClick}
          animateLast={Boolean(
            moves.length && moves[moves.length - 1].player === "white",
          )}
        />
      }
      panel={
        <>
          <p className="text-sm leading-relaxed text-neutral-900">
            {statusLine}
          </p>
          <div className="mt-3 text-sm text-neutral-500">
            15×15 自由规则 · 你执黑
          </div>
          <DifficultySelect
            value={difficulty}
            disabled={phase !== "idle"}
            onChange={setDifficulty}
          />
          {errorMessage ? (
            <p className="mt-3 text-sm text-red-600">{errorMessage}</p>
          ) : null}
          <GameControls>
            <button
              type="button"
              onClick={handleRestart}
              className="rounded-none bg-red-600 px-4 py-2 text-sm font-medium text-white"
            >
              重新开局
            </button>
            {waitingForEngine && phase === "idle" ? (
              <button
                type="button"
                onClick={() => askRapfi(moves)}
                className="rounded-none border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-900"
              >
                让 Rapfi 走
              </button>
            ) : null}
          </GameControls>
          <MoveHistory title="着法" empty="还没有落子。">
            {history.length === 0 ? null : (
              <ol className="mt-2 space-y-1 font-mono text-sm">
                {history.map((row) => (
                  <li key={row.number}>
                    {row.number}. {row.black} {row.white}
                  </li>
                ))}
              </ol>
            )}
          </MoveHistory>
        </>
      }
      modal={
        overOpen ? (
          <GomokuGameOver
            result={result}
            onRestart={handleRestart}
            onDismiss={() => setOverOpen(false)}
          />
        ) : null
      }
    />
  );
}

function GomokuLobby({
  onBack,
  onAi,
  onCreate,
  joinDraft,
  onJoinDraft,
  onJoin,
  errorMessage,
}) {
  return (
    <main className="flex h-screen flex-col overflow-hidden bg-neutral-950 px-4 py-5 font-sans text-neutral-100 sm:px-6 sm:py-8 [height:100dvh]">
      <header className="flex shrink-0 items-center justify-between">
        <span className="text-base font-semibold tracking-tight sm:text-lg">
          PlyHan
        </span>
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-neutral-500 underline underline-offset-2 hover:text-neutral-100"
        >
          选择棋种
        </button>
      </header>
      <div className="min-w-0">
        <h1 className="mt-8 text-3xl font-bold leading-tight sm:text-4xl">
          五子棋
        </h1>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-neutral-500">
          自己对电脑，或创建房间把链接发给对方。
        </p>
      </div>
      <div className="mt-8 grid min-h-0 flex-1 grid-cols-1 content-start gap-3 overflow-y-auto sm:gap-4 md:grid-cols-2">
        <button
          type="button"
          onClick={onAi}
          className="group flex min-h-[8.5rem] flex-col justify-between rounded-none border border-neutral-800 bg-neutral-900 p-5 text-left transition-colors hover:border-red-600 sm:p-8"
        >
          <span className="text-sm text-neutral-500">Rapfi</span>
          <span>
            <span className="block text-2xl font-bold">自己对电脑</span>
            <span className="mt-3 block text-sm text-neutral-500">
              你执黑，本机引擎回一手
            </span>
          </span>
          <span className="h-1 w-12 bg-red-600 transition-all group-hover:w-full" />
        </button>
        <button
          type="button"
          onClick={onCreate}
          className="group flex min-h-[8.5rem] flex-col justify-between rounded-none border border-neutral-800 bg-neutral-900 p-5 text-left transition-colors hover:border-red-600 sm:p-8"
        >
          <span className="text-sm text-neutral-500">联机</span>
          <span>
            <span className="block text-2xl font-bold">创建房间</span>
            <span className="mt-3 block text-sm text-neutral-500">
              生成房间码和链接，你执黑
            </span>
          </span>
          <span className="h-1 w-12 bg-red-600 transition-all group-hover:w-full" />
        </button>
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

export default function GomokuGame({ onBack, initialRoomCode = "", onRoomCode }) {
  const [mode, setMode] = useState(initialRoomCode ? "online" : "");
  const [roomCode, setRoomCode] = useState((initialRoomCode || "").toUpperCase());
  const [joinDraft, setJoinDraft] = useState((initialRoomCode || "").toUpperCase());
  const [lobbyError, setLobbyError] = useState("");

  if (mode === "ai") {
    return <GomokuAiGame onBack={onBack} />;
  }
  if (mode === "online") {
    return (
      <GomokuOnline
        initialCode={roomCode}
        onBack={() => {
          setLobbyError("");
          setRoomCode("");
          setJoinDraft("");
          setMode("");
          onRoomCode?.("");
        }}
        onRoomCode={(code) => {
          onRoomCode?.(code);
        }}
      />
    );
  }

  return (
    <GomokuLobby
      onBack={onBack}
      onAi={() => setMode("ai")}
      onCreate={() => {
        setLobbyError("");
        setRoomCode("");
        setMode("online");
      }}
      joinDraft={joinDraft}
      onJoinDraft={setJoinDraft}
      onJoin={() => {
        const nextCode = joinDraft.trim().toUpperCase();
        if (!nextCode) {
          setLobbyError("请输入房间码。");
          return;
        }
        setLobbyError("");
        setRoomCode(nextCode);
        setMode("online");
      }}
      errorMessage={lobbyError}
    />
  );
}
