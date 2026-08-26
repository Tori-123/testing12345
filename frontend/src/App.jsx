import { useEffect, useMemo, useRef, useState } from "react";
import ChessBoard, {
  applyDisplayMove,
  clearSquareFen,
  pieceCodeAt,
} from "./ChessBoard.jsx";
import GomokuGame from "./GomokuGame.jsx";
import XiangqiGame from "./XiangqiGame.jsx";
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
const PLAY_URL = `${API_BASE_URL}/api/v1/play`;
const FETCH_TIMEOUT_MS = 30000;
const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const USER_SLIDE_MS = 480;
const ENGINE_PAUSE_MS = 600;
const ENGINE_SLIDE_MS = 900;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatEval(n) {
  if (n > 0) return `+${n}`;
  return String(n);
}

function resultCopy(result) {
  if (result === "1-0") return "将死。你赢了。";
  if (result === "0-1") return "将死。电脑赢了。";
  if (result === "1/2-1/2") return "和棋。";
  return "对局结束。";
}

function pairMoves(sans) {
  const rows = [];
  for (let i = 0; i < sans.length; i += 2) {
    rows.push({
      n: i / 2 + 1,
      white: sans[i],
      black: sans[i + 1] || "",
    });
  }
  return rows;
}

async function postPlay(fen, uci = "", difficulty = "normal") {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(PLAY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fen, uci, difficulty }),
      signal: controller.signal,
    });
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function GameOverModal({ result, onRestart, onDismiss }) {
  const mate = result === "1-0" || result === "0-1";
  const title = mate ? "将死" : "对局结束";
  return (
    <GameOverDialog
      title={title}
      message={resultCopy(result)}
      onRestart={onRestart}
      onDismiss={onDismiss}
    />
  );
}

function BrandStrip({ onBack }) {
  return (
    <GameHeader
      onBack={onBack}
      slogan="你执白。走一步，电脑用下棋 API 回一步。"
    />
  );
}

function ChessGame({ onBack }) {
  const [fen, setFen] = useState(START_FEN);
  const [legalUci, setLegalUci] = useState([]);
  const [selected, setSelected] = useState("");
  const [fromSquare, setFromSquare] = useState("");
  const [toSquare, setToSquare] = useState("");
  const [evalScore, setEvalScore] = useState(0);
  const [sans, setSans] = useState([]);
  const [phase, setPhase] = useState("idle");
  const [gameOver, setGameOver] = useState(false);
  const [result, setResult] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [turn, setTurn] = useState("white");
  const [flight, setFlight] = useState(null);
  const [overOpen, setOverOpen] = useState(false);
  const [difficulty, setDifficulty] = useState("normal");
  const requestGen = useRef(0);

  const busy = phase !== "idle" || gameOver;
  const thinking = phase === "thinking";

  const targets = useMemo(() => {
    if (!selected) return [];
    return legalUci
      .filter((uci) => uci.startsWith(selected))
      .map((uci) => uci.slice(2, 4));
  }, [legalUci, selected]);

  function applyMeta(data, { appendSans = false } = {}) {
    if (!data || typeof data !== "object") {
      setErrorMessage("下棋服务返回异常。");
      return;
    }
    if (Array.isArray(data.legal_uci)) setLegalUci(data.legal_uci);
    if (data.turn) setTurn(data.turn);
    if (typeof data.eval === "number") setEvalScore(data.eval);
    setGameOver(Boolean(data.game_over));
    setResult(data.result || "");
    setErrorMessage(data.error_message || "");
    if (appendSans) {
      setSans((prev) => {
        const next = [...prev];
        if (data.user_san) next.push(data.user_san);
        if (data.engine_san) next.push(data.engine_san);
        return next;
      });
    }
  }

  async function slidePiece(from, to, sourceFen, duration) {
    const code = pieceCodeAt(sourceFen, from);
    if (!code || !from || !to) return applyDisplayMove(sourceFen, from, to);
    setFlight({ from, to, code, duration });
    setFen(clearSquareFen(sourceFen, from));
    await sleep(duration);
    const landed = applyDisplayMove(sourceFen, from, to);
    setFen(landed);
    setFlight(null);
    setFromSquare(from);
    setToSquare(to);
    return landed;
  }

  async function requestEngineOnly(fromFen = fen) {
    const gen = ++requestGen.current;
    setPhase("thinking");
    setErrorMessage("");
    try {
      const data = await postPlay(fromFen, "", difficulty);
      if (gen !== requestGen.current) return;
      if (data?.engine_san && data.from_square && data.to_square) {
        setPhase("engine-move");
        await sleep(ENGINE_PAUSE_MS);
        if (gen !== requestGen.current) return;
        await slidePiece(
          data.from_square,
          data.to_square,
          fromFen,
          ENGINE_SLIDE_MS,
        );
      }
      if (gen !== requestGen.current) return;
      if (data?.fen) setFen(data.fen);
      applyMeta(data, { appendSans: Boolean(data?.engine_san) });
    } catch (err) {
      if (gen !== requestGen.current) return;
      setErrorMessage(
        err?.name === "AbortError"
          ? "电脑思考超时，请再试一次。"
          : "连不上下棋服务，请确认后端已启动。",
      );
    } finally {
      if (gen === requestGen.current) setPhase("idle");
    }
  }

  async function playUserMove(from, to) {
    const originFen = fen;
    const uci = `${from}${to}`;
    const gen = ++requestGen.current;
    setSelected("");
    setErrorMessage("");
    setPhase("user-move");
    await slidePiece(from, to, originFen, USER_SLIDE_MS);
    if (gen !== requestGen.current) return;

    setPhase("thinking");
    try {
      const data = await postPlay(originFen, uci, difficulty);
      if (gen !== requestGen.current) return;
      applyMeta(data, { appendSans: true });
      if (data?.engine_san && data.from_square && data.to_square) {
        setPhase("engine-move");
        await sleep(ENGINE_PAUSE_MS);
        if (gen !== requestGen.current) return;
        const afterUser = applyDisplayMove(originFen, from, to);
        await slidePiece(
          data.from_square,
          data.to_square,
          afterUser,
          ENGINE_SLIDE_MS,
        );
      }
      if (gen !== requestGen.current) return;
      if (data?.fen) setFen(data.fen);
      if (data?.from_square) setFromSquare(data.from_square);
      if (data?.to_square) setToSquare(data.to_square);
    } catch (err) {
      if (gen !== requestGen.current) return;
      setFen(originFen);
      setFromSquare("");
      setToSquare("");
      setErrorMessage(
        err?.name === "AbortError"
          ? "电脑思考超时，请再试一次。"
          : "连不上下棋服务，请确认后端已启动。",
      );
    } finally {
      if (gen === requestGen.current) setPhase("idle");
    }
  }

  async function handleRestart() {
    requestGen.current += 1;
    const gen = requestGen.current;
    setFen(START_FEN);
    setLegalUci([]);
    setSelected("");
    setFromSquare("");
    setToSquare("");
    setEvalScore(0);
    setSans([]);
    setGameOver(false);
    setResult("");
    setOverOpen(false);
    setErrorMessage("");
    setTurn("white");
    setFlight(null);
    setPhase("thinking");
    try {
      const data = await postPlay(START_FEN, "", difficulty);
      if (gen !== requestGen.current) return;
      if (data?.fen) setFen(data.fen);
      applyMeta(data);
    } catch {
      if (gen !== requestGen.current) return;
      setErrorMessage("连不上下棋服务，请确认后端已启动。");
    } finally {
      if (gen === requestGen.current) setPhase("idle");
    }
  }

  useEffect(() => {
    let cancelled = false;
    const gen = ++requestGen.current;
    (async () => {
      try {
        const data = await postPlay(START_FEN, "", difficulty);
        if (cancelled || gen !== requestGen.current) return;
        if (data?.fen) setFen(data.fen);
        applyMeta(data);
      } catch {
        if (!cancelled && gen === requestGen.current) {
          setErrorMessage("连不上下棋服务，请确认后端已启动。");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (gameOver && phase === "idle") setOverOpen(true);
  }, [gameOver, phase]);

  function handleSquareClick(square) {
    if (busy || turn !== "white") return;
    if (selected && targets.includes(square)) {
      playUserMove(selected, square);
      return;
    }
    const mine = legalUci.some((uci) => uci.startsWith(square));
    if (mine) {
      setSelected(square);
      return;
    }
    setSelected("");
  }

  const statusLine = gameOver
    ? resultCopy(result)
    : phase === "user-move"
      ? "棋子移动中…"
      : phase === "thinking"
        ? "电脑正在想…"
        : phase === "engine-move"
          ? "电脑走子…"
          : turn === "black"
            ? "轮到电脑。"
            : "轮到你走。点自己的棋子，再点落点。";

  const history = pairMoves(sans);
  const waitingForEngine = phase === "idle" && turn === "black" && !gameOver;

  return (
    <GameScreen
      header={<BrandStrip onBack={onBack} />}
      board={
        <ChessBoard
          fen={fen}
          from_square={fromSquare}
          to_square={toSquare}
          selected={selected}
          targets={targets}
          flight={flight}
          disabled={busy}
          onSquareClick={handleSquareClick}
        />
      }
      panel={
        <>
          <p className="text-sm leading-relaxed text-neutral-900">{statusLine}</p>
          <div className="mt-3 font-mono text-sm text-neutral-500">
            评估 {formatEval(evalScore)}
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
            {waitingForEngine ? (
              <button
                type="button"
                onClick={() => requestEngineOnly()}
                className="rounded-none border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-900"
              >
                让电脑走
              </button>
            ) : null}
          </GameControls>
          <MoveHistory title="着法" empty="还没有走子。">
            {history.length === 0 ? null : (
              <ol className="mt-2 space-y-1 font-mono text-sm">
                {history.map((row) => (
                  <li key={row.n}>
                    {row.n}. {row.white} {row.black}
                  </li>
                ))}
              </ol>
            )}
          </MoveHistory>
        </>
      }
      modal={
        overOpen ? (
          <GameOverModal
            result={result}
            onRestart={handleRestart}
            onDismiss={() => setOverOpen(false)}
          />
        ) : null
      }
    />
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
        <p className="max-w-md text-sm leading-relaxed text-neutral-500 sm:max-w-sm sm:text-right">
          选一个棋盘。你走一步，棋力引擎回一步。
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
              你执白，与 Stockfish 对弈
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
              你执黑，15×15 自由规则
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
              你执红，本机引擎对弈
            </span>
          </span>
          <span className="h-1 w-12 bg-red-600 transition-all group-hover:w-full" />
        </button>
      </div>
    </main>
  );
}

export default function App() {
  const [selectedGame, setSelectedGame] = useState(null);

  if (selectedGame === "chess") {
    return <ChessGame onBack={() => setSelectedGame(null)} />;
  }
  if (selectedGame === "gomoku") {
    return <GomokuGame onBack={() => setSelectedGame(null)} />;
  }
  if (selectedGame === "xiangqi") {
    return <XiangqiGame onBack={() => setSelectedGame(null)} />;
  }
  return <ModePicker onSelect={setSelectedGame} />;
}
