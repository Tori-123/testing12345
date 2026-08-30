import { useEffect, useMemo, useRef, useState } from "react";
import XiangqiBoard, {
  XIANGQI_START_FEN,
  applyUciToFen,
  legalTargetsFor,
  pieceAtFen,
} from "./XiangqiBoard.jsx";
import XiangqiOnline from "./XiangqiOnline.jsx";
import GameLobby, { useLobbyMode } from "./GameLobby.jsx";
import {
  DifficultySelect,
  GameControls,
  GameHeader,
  GameOverDialog,
  GameScreen,
  MoveHistory,
  SideSelect,
} from "./GameShell.jsx";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";
const XIANGQI_URL = `${API_BASE_URL}/api/v1/xiangqi/play`;
const FETCH_TIMEOUT_MS = 30000;
const MIN_THINKING_MS = 1400;
const AI_DROP_MS = 480;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resultCopy(result, seat = "red") {
  if (result === "1-0") {
    return seat === "red" ? "将死。你赢了。" : "将死。电脑赢了。";
  }
  if (result === "0-1") {
    return seat === "black" ? "将死。你赢了。" : "将死。电脑赢了。";
  }
  return "对局结束。";
}

function pairMoves(sans) {
  const rows = [];
  for (let i = 0; i < sans.length; i += 2) {
    rows.push({
      n: i / 2 + 1,
      red: sans[i],
      black: sans[i + 1] || "",
    });
  }
  return rows;
}

async function postXiangqi(fen, uci = "", difficulty = "easy", side = "red") {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(XIANGQI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fen, uci, difficulty, side }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function XiangqiHeader({ onBack, onHome, seat }) {
  return (
    <GameHeader
      onBack={onBack}
      onHome={onHome}
      slogan={
        seat === "black"
          ? "你执黑。Pikafish 先走红，再轮到你。"
          : "你执红。走一步，Pikafish 回一步。"
      }
    />
  );
}

function XiangqiGameOver({ result, seat, onRestart, onDismiss, onBack, onHome }) {
  return (
    <GameOverDialog
      title="对局结束"
      message={resultCopy(result, seat)}
      onRestart={onRestart}
      onDismiss={onDismiss}
      onBack={onBack}
      onHome={onHome}
    />
  );
}

function XiangqiAiGame({ onBack, onHome, initialSeat = "red" }) {
  const [seat, setSeat] = useState(initialSeat === "black" ? "black" : "red");
  const [fen, setFen] = useState(XIANGQI_START_FEN);
  const [legalUci, setLegalUci] = useState([]);
  const [selected, setSelected] = useState("");
  const [sans, setSans] = useState([]);
  const [phase, setPhase] = useState("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [gameOver, setGameOver] = useState(false);
  const [result, setResult] = useState("");
  const [overOpen, setOverOpen] = useState(false);
  const [difficulty, setDifficulty] = useState("easy");
  const [lastMove, setLastMove] = useState(null);
  const [animating, setAnimating] = useState(null);
  const requestGeneration = useRef(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await postXiangqi(XIANGQI_START_FEN, "", difficulty, seat);
        if (cancelled) return;
        if (data.error_message) setErrorMessage(data.error_message);
        setFen(data.fen || XIANGQI_START_FEN);
        setLegalUci(data.legal_uci || []);
        if (data.engine_san) setSans([data.engine_san]);
        setGameOver(Boolean(data.game_over));
        setResult(data.result || "");
      } catch {
        if (!cancelled) {
          setErrorMessage("连不上中国象棋服务，请确认后端已启动。");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // Initial legal moves only; difficulty can change before first move.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const targets = useMemo(
    () => legalTargetsFor(selected, legalUci),
    [selected, legalUci],
  );
  const history = useMemo(() => pairMoves(sans), [sans]);
  const busy = phase !== "idle" || gameOver;

  async function askEngine(currentFen, uci, restoreOnFail = null) {
    const generation = ++requestGeneration.current;
    const startedAt = performance.now();
    setPhase("thinking");
    setErrorMessage("");
    try {
        const data = await postXiangqi(currentFen, uci, difficulty, seat);
      if (generation !== requestGeneration.current) return;

      const remaining = MIN_THINKING_MS - (performance.now() - startedAt);
      if (remaining > 0) await sleep(remaining);
      if (generation !== requestGeneration.current) return;

      if (data.user_uci) {
        setLastMove({
          from: data.user_uci.slice(0, 2),
          to: data.user_uci.slice(2),
        });
      }

      if (data.status === "error") {
        setErrorMessage(data.error_message || "请求失败。");
        setFen(data.fen || currentFen);
        setLegalUci(data.legal_uci || []);
        if (data.user_san) {
          setSans((prev) => [...prev, data.user_san]);
        }
        return;
      }

      setSans((prev) => {
        const next = [...prev];
        if (data.user_san) next.push(data.user_san);
        if (data.engine_san) next.push(data.engine_san);
        return next;
      });

      if (data.engine_uci) {
        setAnimating({
          from: data.engine_uci.slice(0, 2),
          to: data.engine_uci.slice(2),
        });
        setLastMove({
          from: data.engine_uci.slice(0, 2),
          to: data.engine_uci.slice(2),
        });
        setFen(data.fen);
        setLegalUci(data.legal_uci || []);
        await sleep(AI_DROP_MS);
        if (generation !== requestGeneration.current) return;
        setAnimating(null);
      } else {
        setFen(data.fen);
        setLegalUci(data.legal_uci || []);
      }

      setGameOver(Boolean(data.game_over));
      setResult(data.result || "");
      if (data.game_over) setOverOpen(true);
    } catch (error) {
      if (generation !== requestGeneration.current) return;
      if (restoreOnFail) {
        setFen(restoreOnFail.fen);
        setLegalUci(restoreOnFail.legalUci);
        setLastMove(restoreOnFail.lastMove);
      }
      setErrorMessage(
        error?.name === "AbortError"
          ? "Pikafish 思考超时，请重试。"
          : "连不上中国象棋服务，请确认后端和 Pikafish 已启动。",
      );
    } finally {
      if (generation === requestGeneration.current) setPhase("idle");
    }
  }

  function handleSquareClick(square) {
    if (busy) return;
    const redToMove = (fen.split(" ")[1] || "w") === "w";
    if (seat === "red" ? !redToMove : redToMove) return;
    if (selected && targets.includes(square)) {
      const uci = `${selected}${square}`;
      const restoreOnFail = {
        fen,
        legalUci,
        lastMove,
      };
      setSelected("");
      setLastMove({ from: selected, to: square });
      setFen(applyUciToFen(fen, uci));
      setLegalUci([]);
      askEngine(fen, uci, restoreOnFail);
      return;
    }
    const piece = pieceAtFen(fen, square);
    const mine =
      piece &&
      (seat === "black" ? piece === piece.toLowerCase() : piece === piece.toUpperCase());
    if (mine) {
      const hasMoves = (legalUci || []).some((move) => move.startsWith(square));
      if (hasMoves) {
        setSelected(square);
        return;
      }
    }
    setSelected("");
  }

  function handleRestart(nextSeat = seat) {
    requestGeneration.current += 1;
    setSeat(nextSeat);
    setFen(XIANGQI_START_FEN);
    setSelected("");
    setSans([]);
    setPhase("idle");
    setErrorMessage("");
    setGameOver(false);
    setResult("");
    setOverOpen(false);
    setLastMove(null);
    setAnimating(null);
    setPhase("thinking");
    postXiangqi(XIANGQI_START_FEN, "", difficulty, nextSeat)
      .then((data) => {
        setFen(data.fen || XIANGQI_START_FEN);
        setLegalUci(data.legal_uci || []);
        if (data.engine_san) setSans([data.engine_san]);
        if (data.error_message) setErrorMessage(data.error_message);
        setGameOver(Boolean(data.game_over));
        setResult(data.result || "");
      })
      .catch(() => {
        setLegalUci([]);
        setErrorMessage("连不上中国象棋服务，请确认后端已启动。");
      })
      .finally(() => {
        setPhase("idle");
      });
  }

  async function handleRetryEngine() {
    if (busy || gameOver) return;
    await askEngine(fen, "");
  }

  const statusLine = gameOver
    ? resultCopy(result, seat)
    : phase === "thinking"
      ? "Pikafish 正在想…"
      : `轮到你走。点选${seat === "black" ? "黑" : "红"}子，再点合法落点。`;

  return (
    <GameScreen
      header={<XiangqiHeader onBack={onBack} onHome={onHome} seat={seat} />}
      board={
        <XiangqiBoard
          fen={fen}
          selected={selected}
          legalTargets={targets}
          lastMove={lastMove}
          animating={animating}
          disabled={busy}
          flipped={seat === "black"}
          onSquareClick={handleSquareClick}
        />
      }
      panel={
        <>
          <p className="text-sm leading-relaxed text-neutral-900">{statusLine}</p>
          <div className="mt-3 text-sm text-neutral-500">
            9×10 · 你执{seat === "black" ? "黑" : "红"}
          </div>
          <SideSelect
            value={seat}
            disabled={phase !== "idle" || sans.length > 0}
            options={[
              { id: "red", label: "执红" },
              { id: "black", label: "执黑" },
            ]}
            onChange={(next) => handleRestart(next)}
          />
          <DifficultySelect
            value={difficulty}
            disabled={phase !== "idle"}
            onChange={setDifficulty}
          />
          {errorMessage ? (
            <div className="mt-4 rounded-none border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              <p>{errorMessage}</p>
              <button
                type="button"
                onClick={handleRetryEngine}
                className="mt-2 text-sm underline underline-offset-2"
              >
                让电脑走
              </button>
            </div>
          ) : null}
          <GameControls>
            <button
              type="button"
              onClick={() => handleRestart()}
              className="rounded-none bg-red-600 px-4 py-2 text-sm font-medium text-white"
            >
              重新开局
            </button>
          </GameControls>
          <MoveHistory title="着法" empty="还没有走子。">
            {history.length === 0 ? null : (
              <ol className="mt-2 space-y-1 font-mono text-sm">
                {history.map((row) => (
                  <li key={row.n}>
                    {row.n}. {row.red} {row.black}
                  </li>
                ))}
              </ol>
            )}
          </MoveHistory>
        </>
      }
      modal={
        overOpen ? (
          <XiangqiGameOver
            result={result}
            seat={seat}
            onRestart={() => handleRestart()}
            onDismiss={() => setOverOpen(false)}
            onBack={onBack}
            onHome={onHome}
          />
        ) : null
      }
    />
  );
}

export default function XiangqiGame({ onBack, initialRoomCode = "", onRoomCode }) {
  const lobby = useLobbyMode({
    initialRoomCode,
    onRoomCode,
    defaultSeat: "red",
  });

  if (lobby.mode === "ai") {
    return (
      <XiangqiAiGame
        onBack={() => lobby.setMode("")}
        onHome={onBack}
        initialSeat={lobby.seat}
      />
    );
  }
  if (lobby.mode === "online") {
    return (
      <XiangqiOnline
        initialCode={lobby.roomCode}
        createSeat={lobby.seat}
        onBack={lobby.leaveRoom}
        onHome={() => {
          lobby.leaveRoom();
          onBack();
        }}
        onRoomCode={onRoomCode}
      />
    );
  }

  return (
    <GameLobby
      title="中国象棋"
      blurb="自己对电脑，或创建房间把链接发给对方。先选执红或执黑。"
      engineLabel="Pikafish"
      engineHint={
        lobby.seat === "black" ? "你执黑，Pikafish 先走红" : "你执红，本机引擎回一手"
      }
      onlineHint={
        lobby.seat === "black" ? "生成房间码和链接，你执黑" : "生成房间码和链接，你执红"
      }
      seat={lobby.seat}
      seats={[
        { id: "red", label: "执红" },
        { id: "black", label: "执黑" },
      ]}
      onSeat={lobby.setSeat}
      onBack={onBack}
      onAi={() => lobby.setMode("ai")}
      onCreate={lobby.createRoom}
      joinDraft={lobby.joinDraft}
      onJoinDraft={lobby.setJoinDraft}
      onJoin={lobby.joinRoom}
      errorMessage={lobby.lobbyError}
    />
  );
}
