import { useMemo, useRef, useState } from "react";
import GomokuBoard from "./GomokuBoard.jsx";
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
    <GameScreen
      header={<GomokuHeader onBack={onBack} />}
      board={
        <GomokuBoard
          moves={moves}
          disabled={busy}
          onPointClick={handlePointClick}
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
