import { useMemo, useRef, useState } from "react";
import GomokuBoard from "./GomokuBoard.jsx";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";
const GOMOKU_URL = `${API_BASE_URL}/api/v1/gomoku/play`;
const FETCH_TIMEOUT_MS = 30000;
const MIN_THINKING_MS = 1400;

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
    <header className="flex h-[8%] min-h-[3rem] shrink-0 items-center justify-between px-4">
      <div className="flex items-center gap-4">
        <span className="text-lg font-semibold tracking-tight">PlyHan</span>
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-neutral-500 underline underline-offset-2 hover:text-neutral-100"
        >
          选择棋种
        </button>
      </div>
      <p className="max-w-[60%] text-right text-sm text-neutral-500">
        你执黑。落一子，Rapfi 回一子。
      </p>
    </header>
  );
}

function GomokuGameOver({ result, onRestart, onDismiss }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="gomoku-over-title"
        className="w-[min(90vw,22rem)] rounded-none bg-white px-8 py-10 text-center text-neutral-900 shadow-sm"
      >
        <p id="gomoku-over-title" className="text-4xl font-bold text-red-600">
          对局结束
        </p>
        <p className="mt-4 text-base leading-relaxed">{resultCopy(result)}</p>
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

export default function GomokuGame({ onBack }) {
  const [moves, setMoves] = useState([]);
  const [phase, setPhase] = useState("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [gameOver, setGameOver] = useState(false);
  const [result, setResult] = useState("");
  const [overOpen, setOverOpen] = useState(false);
  const [difficulty, setDifficulty] = useState("normal");
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
    <div className="flex h-screen flex-col overflow-hidden bg-neutral-950 font-sans text-neutral-100">
      <GomokuHeader onBack={onBack} />
      <div className="flex min-h-0 flex-1 gap-4 px-4 pb-4">
        <div className="flex min-h-0 w-[58%] flex-col">
          <GomokuBoard
            moves={moves}
            disabled={busy}
            onPointClick={handlePointClick}
          />
        </div>
        <aside className="flex min-h-0 w-[42%] flex-col rounded-none bg-white p-6 text-neutral-900 shadow-sm">
          <p className="text-sm leading-relaxed text-neutral-900">
            {statusLine}
          </p>
          <div className="mt-3 text-sm text-neutral-500">
            15×15 自由规则 · 你执黑
          </div>
          <label className="mt-4 flex items-center justify-between gap-3 text-sm text-neutral-700">
            <span>电脑难度</span>
            <select
              value={difficulty}
              disabled={phase !== "idle"}
              onChange={(event) => setDifficulty(event.target.value)}
              className="rounded-none border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-red-600 disabled:opacity-50"
            >
              <option value="beginner">入门（偶尔失误）</option>
              <option value="easy">简单</option>
              <option value="normal">普通</option>
              <option value="hard">困难</option>
            </select>
          </label>
          {errorMessage ? (
            <p className="mt-3 text-sm text-red-600">{errorMessage}</p>
          ) : null}
          <div className="mt-4 flex gap-2">
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
          </div>
          <div className="mt-6 min-h-0 flex-1 overflow-y-auto">
            <h2 className="text-xs font-semibold tracking-wide text-neutral-500">
              着法
            </h2>
            {history.length === 0 ? (
              <p className="mt-2 text-sm text-neutral-500">还没有落子。</p>
            ) : (
              <ol className="mt-2 space-y-1 font-mono text-sm">
                {history.map((row) => (
                  <li key={row.number}>
                    {row.number}. {row.black} {row.white}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </aside>
      </div>
      {overOpen ? (
        <GomokuGameOver
          result={result}
          onRestart={handleRestart}
          onDismiss={() => setOverOpen(false)}
        />
      ) : null}
    </div>
  );
}
