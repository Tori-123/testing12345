import { useMemo, useRef, useState } from "react";
import DraughtsBoard, {
  START_FEN,
  applyUciToFen,
  capturedSquares,
  hopsFromUci,
  pieceAtFen,
} from "./DraughtsBoard.jsx";
import DraughtsOnline from "./DraughtsOnline.jsx";
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
const PLAY_URL = `${API_BASE_URL}/api/v1/draughts/play`;
const FETCH_TIMEOUT_MS = 30000;
const AI_THINK_MIN_MS = 2000;
const AI_THINK_MAX_MS = 4000;
const HOP_MS = 280;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function aiThinkMs() {
  return (
    AI_THINK_MIN_MS +
    Math.floor(Math.random() * (AI_THINK_MAX_MS - AI_THINK_MIN_MS + 1))
  );
}

function flightMs(uci) {
  return Math.max(1, hopsFromUci(uci).length - 1) * HOP_MS;
}

function resultCopy(result, seat) {
  if (result === "black" || result === "white") {
    if (result === seat) return "对方无子可走。你赢了。";
    return "对方无子可走。电脑赢了。";
  }
  return "对局结束。";
}

function pairMoves(sans) {
  const rows = [];
  for (let i = 0; i < sans.length; i += 2) {
    rows.push({
      n: i / 2 + 1,
      black: sans[i],
      white: sans[i + 1] || "",
    });
  }
  return rows;
}

function nextSquares(legalUci, prefix) {
  const targets = new Set();
  for (const uci of legalUci) {
    if (!uci.startsWith(prefix) || uci.length <= prefix.length) continue;
    targets.add(uci.slice(prefix.length, prefix.length + 2));
  }
  return [...targets];
}

function isCaptureUci(uci) {
  return capturedSquares(uci).length > 0;
}

async function postPlay(fen, uci = "", difficulty = "easy", side = "black") {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(PLAY_URL, {
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

function DraughtsAiGame({ onBack, initialSeat = "black" }) {
  const [seat, setSeat] = useState(initialSeat === "white" ? "white" : "black");
  const [started, setStarted] = useState(false);
  const [fen, setFen] = useState(START_FEN);
  const [legalUci, setLegalUci] = useState([]);
  const [turn, setTurn] = useState("black");
  const [phase, setPhase] = useState("idle");
  const [difficulty, setDifficulty] = useState("easy");
  const [errorMessage, setErrorMessage] = useState("");
  const [gameOver, setGameOver] = useState(false);
  const [result, setResult] = useState("");
  const [overOpen, setOverOpen] = useState(false);
  const [sans, setSans] = useState([]);
  const [selected, setSelected] = useState("");
  const [path, setPath] = useState("");
  const [fromSquare, setFromSquare] = useState("");
  const [toSquare, setToSquare] = useState("");
  const [flight, setFlight] = useState(null);
  const [hiddenSquares, setHiddenSquares] = useState([]);
  const [fadingSquares, setFadingSquares] = useState([]);
  const requestGeneration = useRef(0);
  const startedRef = useRef(false);

  const waitingForEngine = started && turn !== seat && !gameOver && phase === "idle";
  const busy =
    !started ||
    phase !== "idle" ||
    gameOver ||
    waitingForEngine ||
    turn !== seat;
  const prefix = path || selected;
  const targets = useMemo(
    () => (prefix ? nextSquares(legalUci, prefix) : []),
    [legalUci, prefix],
  );
  const captureFrom = useMemo(() => {
    const jumpers = new Set(
      legalUci.filter(isCaptureUci).map((uci) => uci.slice(0, 2)),
    );
    return [...jumpers];
  }, [legalUci]);

  function resetSelection() {
    setSelected("");
    setPath("");
  }

  function applyMeta(data, { appendSans } = {}) {
    if (!data) return;
    setErrorMessage(data.error_message || "");
    if (data.fen) setFen(data.fen);
    if (Array.isArray(data.legal_uci)) setLegalUci(data.legal_uci);
    if (data.turn) setTurn(data.turn);
    if (data.from_square) setFromSquare(data.from_square);
    if (data.to_square) setToSquare(data.to_square);
    setGameOver(Boolean(data.game_over));
    setResult(data.result || "");
    if (data.game_over) setOverOpen(true);
    if (appendSans) {
      setSans((prev) => {
        const next = [...prev];
        if (data.user_san) next.push(data.user_san);
        if (data.engine_san) next.push(data.engine_san);
        return next;
      });
    }
  }

  async function playFlight(uci, displayFen) {
    const hops = hopsFromUci(uci);
    const code = pieceAtFen(displayFen, hops[0]);
    const caps = capturedSquares(uci);
    setHiddenSquares([hops[0]]);
    setFadingSquares(caps);
    setFlight({
      uci,
      hops,
      code,
      duration: HOP_MS,
    });
    await sleep(flightMs(uci) + 40);
    setFlight(null);
    setHiddenSquares([]);
    setFadingSquares([]);
  }

  async function askEngine(currentFen, uci = "", { animateEngine = true } = {}) {
    const generation = ++requestGeneration.current;
    const startedAt = performance.now();
    const thinkFor = aiThinkMs();
    setPhase("thinking");
    setErrorMessage("");
    try {
      const data = await postPlay(currentFen, uci, difficulty, seat);
      if (generation !== requestGeneration.current) return;
      if (data?.status === "error" && data.error_message) {
        setErrorMessage(data.error_message);
        if (data.fen) setFen(data.fen);
        if (Array.isArray(data.legal_uci)) setLegalUci(data.legal_uci);
        setPhase("idle");
        return;
      }
      if (data?.engine_uci && animateEngine) {
        const remaining = thinkFor - (performance.now() - startedAt);
        if (remaining > 0) await sleep(remaining);
        if (generation !== requestGeneration.current) return;
        const afterUser = uci ? applyUciToFen(currentFen, uci) : currentFen;
        setPhase("engine-move");
        await playFlight(data.engine_uci, afterUser);
        if (generation !== requestGeneration.current) return;
      }
      if (generation !== requestGeneration.current) return;
      applyMeta(data, { appendSans: Boolean(uci || data?.engine_san) });
    } catch (error) {
      if (generation !== requestGeneration.current) return;
      setErrorMessage(
        error?.name === "AbortError"
          ? "电脑思考超时，请再试一次。"
          : "连不上跳棋服务，请确认后端已启动。",
      );
    } finally {
      if (generation === requestGeneration.current) setPhase("idle");
    }
  }

  async function submitUserMove(uci) {
    const originFen = fen;
    setPhase("user-move");
    resetSelection();
    await playFlight(uci, originFen);
    const afterUser = applyUciToFen(originFen, uci);
    setFen(afterUser);
    setFromSquare(uci.slice(0, 2));
    setToSquare(uci.slice(-2));
    await askEngine(originFen, uci);
  }

  function handleSquareClick(square) {
    if (busy) return;
    const prefixNow = path || selected;
    if (prefixNow && targets.includes(square)) {
      const nextPath = `${prefixNow}${square}`;
      if (legalUci.includes(nextPath)) {
        submitUserMove(nextPath);
        return;
      }
      setPath(nextPath);
      setSelected(nextPath.slice(0, 2));
      return;
    }
    const canStart = legalUci.some((uci) => uci.startsWith(square));
    if (canStart) {
      setSelected(square);
      setPath(square);
      return;
    }
    resetSelection();
  }

  function handleStart() {
    if (startedRef.current) return;
    startedRef.current = true;
    setStarted(true);
    setErrorMessage("");
    if (seat === "white") {
      askEngine(START_FEN, "", { animateEngine: true });
      return;
    }
    askEngine(START_FEN, "", { animateEngine: false });
  }

  function handleRestart() {
    requestGeneration.current += 1;
    startedRef.current = false;
    setStarted(false);
    setFen(START_FEN);
    setLegalUci([]);
    setTurn("black");
    setPhase("idle");
    setErrorMessage("");
    setGameOver(false);
    setResult("");
    setOverOpen(false);
    setSans([]);
    resetSelection();
    setFromSquare("");
    setToSquare("");
    setFlight(null);
    setHiddenSquares([]);
    setFadingSquares([]);
  }

  const statusLine = !started
    ? "先选执棋和难度，再点开始游戏。"
    : gameOver
      ? resultCopy(result, seat)
      : phase === "user-move"
        ? "棋子移动中…"
        : phase === "thinking"
          ? "电脑正在想…"
          : phase === "engine-move"
            ? "电脑走子…"
            : waitingForEngine
              ? "轮到电脑。"
              : captureFrom.length
                ? "有吃必吃。点红圈棋子，再点落点；连跳继续点下去。"
                : "轮到你走。点自己的棋子，再点落点。";

  const history = pairMoves(sans);

  return (
    <GameScreen
      header={
        <GameHeader
          onBack={onBack}
          onHome={onBack}
          slogan={
            seat === "white"
              ? "你执白。电脑先走黑子。"
              : "你执黑。黑先行，有吃必吃。"
          }
        />
      }
      board={
        <DraughtsBoard
          fen={fen}
          from_square={fromSquare}
          to_square={toSquare}
          selected={path.length > 2 ? path.slice(-2) : selected}
          targets={targets}
          captureFrom={started && !busy ? captureFrom : []}
          hiddenSquares={hiddenSquares}
          fadingSquares={fadingSquares}
          flight={flight}
          disabled={busy}
          flipped={seat === "black"}
          onSquareClick={handleSquareClick}
        />
      }
      panel={
        <>
          <p className="text-sm leading-relaxed text-neutral-900">{statusLine}</p>
          <div className="mt-3 text-sm text-neutral-500">
            8×8 英美跳棋 · 你执{seat === "white" ? "白" : "黑"}
          </div>
          <SideSelect
            value={seat}
            disabled={started}
            options={[
              { id: "black", label: "执黑" },
              { id: "white", label: "执白" },
            ]}
            onChange={setSeat}
          />
          <DifficultySelect
            value={difficulty}
            disabled={started}
            onChange={setDifficulty}
          />
          {started ? (
            <p className="mt-1 text-xs text-neutral-500">对局开始后不能改难度。</p>
          ) : null}
          {errorMessage ? (
            <p className="mt-3 text-sm text-red-600">{errorMessage}</p>
          ) : null}
          <GameControls>
            {started ? (
              <button
                type="button"
                onClick={handleRestart}
                className="rounded-none bg-red-600 px-4 py-2 text-sm font-medium text-white"
              >
                重新开局
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStart}
                className="rounded-none bg-red-600 px-4 py-2 text-sm font-medium text-white"
              >
                开始游戏
              </button>
            )}
            {waitingForEngine ? (
              <button
                type="button"
                onClick={() => askEngine(fen, "", { animateEngine: true })}
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
                    {row.n}. {row.black} {row.white}
                  </li>
                ))}
              </ol>
            )}
          </MoveHistory>
        </>
      }
      modal={
        overOpen ? (
          <GameOverDialog
            title="对局结束"
            message={resultCopy(result, seat)}
            onRestart={handleRestart}
            onDismiss={() => setOverOpen(false)}
            onBack={onBack}
            onHome={onBack}
          />
        ) : null
      }
    />
  );
}

export default function DraughtsGame({
  onBack,
  initialRoomCode = "",
  onRoomCode,
}) {
  const lobby = useLobbyMode({
    initialRoomCode,
    onRoomCode,
    defaultSeat: "black",
  });

  if (lobby.mode === "ai") {
    return (
      <DraughtsAiGame
        onBack={() => lobby.setMode("")}
        onHome={onBack}
        initialSeat={lobby.seat}
      />
    );
  }
  if (lobby.mode === "online") {
    return (
      <DraughtsOnline
        initialCode={lobby.roomCode}
        createSeat={lobby.seat}
        clockEnabled={lobby.clockEnabled}
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
      title="跳棋"
      blurb="自己对电脑，或创建房间把链接发给对方。先选执黑或执白。"
      engineLabel="本机搜索"
      engineHint={
        lobby.seat === "white"
          ? "你执白，电脑先走黑子"
          : "你执黑，本机引擎回一手"
      }
      onlineHint={
        lobby.seat === "white"
          ? "生成房间码和链接，你执白"
          : "生成房间码和链接，你执黑"
      }
      seat={lobby.seat}
      seats={[
        { id: "black", label: "执黑" },
        { id: "white", label: "执白" },
      ]}
      onSeat={lobby.setSeat}
      onBack={onBack}
      onAi={() => lobby.setMode("ai")}
      onCreate={lobby.createRoom}
      joinDraft={lobby.joinDraft}
      onJoinDraft={lobby.setJoinDraft}
      onJoin={lobby.joinRoom}
      errorMessage={lobby.lobbyError}
      clockEnabled={lobby.clockEnabled}
      onClockEnabled={lobby.setClockEnabled}
    />
  );
}
