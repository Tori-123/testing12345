import { useEffect, useMemo, useRef, useState } from "react";
import { copyTextToClipboard } from "./clipboard.js";
import {
  GameControls,
  GameHeader,
  GameOverDialog,
  GameScreen,
  MoveHistory,
} from "./GameShell.jsx";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

function formatClock(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function loadSeat(storageKey, code) {
  try {
    const raw = JSON.parse(sessionStorage.getItem(storageKey) || "null");
    if (raw && raw.code === code && raw.token && raw.seat) return raw;
  } catch {
    /* ignore */
  }
  return null;
}

function saveSeat(storageKey, payload) {
  sessionStorage.setItem(storageKey, JSON.stringify(payload));
}

function roomShareUrl(game, code) {
  const url = new URL(window.location.href);
  url.searchParams.set("game", game);
  url.searchParams.set("r", code);
  return url.toString();
}

function roomWsUrl(game, code, token) {
  const httpBase = API_BASE_URL.endsWith("/") ? API_BASE_URL : `${API_BASE_URL}/`;
  const ws = new URL(
    `api/v1/${game}/rooms/${encodeURIComponent(code)}/ws`,
    httpBase,
  );
  ws.protocol = ws.protocol === "https:" ? "wss:" : "ws:";
  ws.searchParams.set("token", token);
  return ws.toString();
}

async function postJson(path, body) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers:
      body === undefined
        ? { Accept: "application/json" }
        : { Accept: "application/json", "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return await response.json();
}

export default function BoardOnline({
  game,
  initialCode = "",
  initialToken = "",
  initialSeat = "",
  createSeat,
  firstSeat,
  secondSeat,
  startFen,
  storageKey,
  historyEmpty = "还没有走子。",
  pairHistory,
  resultCopy,
  sloganFor,
  metaFor,
  onBack,
  onHome,
  onRoomCode,
  renderBoard,
  clockEnabled = true,
  slideMs = 420,
  readPiece,
  clearSquare,
  onGameOver,
}) {
  const [code, setCode] = useState("");
  const [seat, setSeat] = useState("");
  const [token, setToken] = useState("");
  const [fen, setFen] = useState(startFen);
  const [legalUci, setLegalUci] = useState([]);
  const [sans, setSans] = useState([]);
  const [fromSquare, setFromSquare] = useState("");
  const [toSquare, setToSquare] = useState("");
  const [turn, setTurn] = useState(firstSeat);
  const [firstReady, setFirstReady] = useState(false);
  const [secondReady, setSecondReady] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [result, setResult] = useState("");
  const [endReason, setEndReason] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [overOpen, setOverOpen] = useState(false);
  const [copied, setCopied] = useState("");
  const [connected, setConnected] = useState(false);
  const [clockLimitMs, setClockLimitMs] = useState(60_000);
  const [displayClockMs, setDisplayClockMs] = useState(60_000);
  const [restartFirst, setRestartFirst] = useState(false);
  const [restartSecond, setRestartSecond] = useState(false);
  const [flight, setFlight] = useState(null);
  const socketRef = useRef(null);
  const seatRef = useRef("");
  const pendingRef = useRef(null);
  const applyStateRef = useRef(null);
  const restoreRef = useRef(null);
  const fenRef = useRef(startFen);
  const sansRef = useRef([]);
  const flightTimerRef = useRef(null);
  const clockSyncRef = useRef({ remain: 60_000, at: 0, running: false });

  function stopFlight() {
    if (flightTimerRef.current) {
      window.clearTimeout(flightTimerRef.current);
      flightTimerRef.current = null;
    }
    setFlight(null);
  }

  function reduceMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function startFlight(from, to, sourceFen, landFen, duration) {
    const piece = readPiece?.(sourceFen, from);
    if (!piece || !clearSquare || !duration || reduceMotion()) {
      setFen(landFen);
      return;
    }
    stopFlight();
    setFlight({ from, to, piece, duration });
    setFen(clearSquare(sourceFen, from));
    flightTimerRef.current = window.setTimeout(() => {
      setFen(landFen);
      setFlight(null);
      flightTimerRef.current = null;
    }, duration);
  }

  function readyFrom(data, which) {
    if (which === firstSeat) {
      if (firstSeat === "white") return Boolean(data.white_ready);
      if (firstSeat === "red") return Boolean(data.red_ready);
      return Boolean(data.black_ready);
    }
    if (secondSeat === "white") return Boolean(data.white_ready);
    if (secondSeat === "red") return Boolean(data.red_ready);
    return Boolean(data.black_ready);
  }

  function restartFrom(data, which) {
    if (which === "white") return Boolean(data.restart_white);
    if (which === "red") return Boolean(data.restart_red);
    return Boolean(data.restart_black);
  }

  function rollbackPending() {
    const restore = restoreRef.current;
    pendingRef.current = null;
    restoreRef.current = null;
    stopFlight();
    if (!restore) return;
    setFen(restore.fen);
    fenRef.current = restore.fen;
    setLegalUci(restore.legalUci);
    setFromSquare(restore.fromSquare);
    setToSquare(restore.toSquare);
    setTurn(restore.turn);
    setSans(restore.sans);
  }

  function applyState(data) {
    if (data?.type === "error" || data?.status === "error") {
      rollbackPending();
      setErrorMessage(data?.error_message || "房间状态异常。");
      return;
    }
    if (pendingRef.current && Array.isArray(data.sans)) {
      const pending = pendingRef.current;
      const confirmed = data.sans.length >= pending.afterCount;
      if (!confirmed) {
        if (data.code) setCode(data.code);
        setFirstReady(readyFrom(data, firstSeat));
        setSecondReady(readyFrom(data, secondSeat));
        setRestartFirst(restartFrom(data, firstSeat));
        setRestartSecond(restartFrom(data, secondSeat));
        return;
      }
      pendingRef.current = null;
      restoreRef.current = null;
    }
    const prevFen = fenRef.current;
    const prevSans = sansRef.current;
    const remoteMove =
      !pendingRef.current &&
      Array.isArray(data.sans) &&
      data.sans.length > prevSans.length &&
      data.from_square &&
      data.to_square &&
      data.fen &&
      data.fen !== prevFen;
    if (data.code) setCode(data.code);
    if (Array.isArray(data.legal_uci)) setLegalUci(data.legal_uci);
    if (Array.isArray(data.sans)) {
      setSans(data.sans);
      sansRef.current = data.sans;
    }
    setFromSquare(data.from_square || "");
    setToSquare(data.to_square || "");
    if (data.turn !== undefined) setTurn(data.turn || "");
    setFirstReady(readyFrom(data, firstSeat));
    setSecondReady(readyFrom(data, secondSeat));
    setRestartFirst(restartFrom(data, firstSeat));
    setRestartSecond(restartFrom(data, secondSeat));
    setGameOver(Boolean(data.game_over));
    setResult(data.result || "");
    setEndReason(data.end_reason || "");
    const limit =
      typeof data.clock_limit_ms === "number" ? data.clock_limit_ms : clockLimitMs;
    if (typeof data.clock_limit_ms === "number") {
      setClockLimitMs(data.clock_limit_ms);
    }
    if (typeof data.clock_ms === "number") {
      setDisplayClockMs(data.clock_ms);
      clockSyncRef.current = {
        remain: data.clock_ms,
        at: performance.now(),
        running:
          readyFrom(data, firstSeat) &&
          readyFrom(data, secondSeat) &&
          !data.game_over &&
          limit > 0,
      };
    }
    if (data.fen) {
      if (remoteMove) {
        startFlight(
          data.from_square,
          data.to_square,
          prevFen,
          data.fen,
          slideMs,
        );
      } else if (!flightTimerRef.current) {
        setFen(data.fen);
      }
      fenRef.current = data.fen;
    }
    if (data.error_message) setErrorMessage(data.error_message);
    else setErrorMessage("");
    if (data.game_over) setOverOpen(true);
    else setOverOpen(false);
    if (data.game_over) onGameOver?.(data.result || "", seatRef.current);
  }

  applyStateRef.current = applyState;

  useEffect(() => {
    const timer = window.setInterval(() => {
      const sync = clockSyncRef.current;
      if (!sync.running) return;
      const remain = Math.max(0, sync.remain - (performance.now() - sync.at));
      setDisplayClockMs(remain);
    }, 200);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const invite = (initialCode || "").toUpperCase();
    const saved = loadSeat(storageKey, invite);

    (async () => {
      try {
        let data;
        if (invite) {
          data = await postJson(
            `/api/v1/${game}/rooms/${encodeURIComponent(invite)}/join`,
            { token: initialToken || saved?.token || "" },
          );
        } else {
          data = await postJson(`/api/v1/${game}/rooms`, {
            seat: createSeat || firstSeat,
            clock: clockEnabled !== false,
          });
        }
        if (cancelled) return;
        if (data.status !== "success" || !data.token || !data.code) {
          setErrorMessage(data.error_message || "无法进入房间。");
          return;
        }
        setToken(data.token);
        setSeat(initialSeat || data.seat);
        seatRef.current = initialSeat || data.seat;
        setCode(data.code);
        saveSeat(storageKey, {
          code: data.code,
          token: data.token,
          seat: data.seat,
        });
        onRoomCode?.(data.code);
        applyStateRef.current?.(data);

        const socket = new WebSocket(roomWsUrl(game, data.code, data.token));
        socketRef.current = socket;
        socket.onopen = () => {
          if (!cancelled) setConnected(true);
        };
        socket.onmessage = (event) => {
          try {
            applyStateRef.current?.(JSON.parse(event.data));
          } catch {
            setErrorMessage("房间消息无法解析。");
          }
        };
        socket.onclose = () => {
          if (!cancelled) setConnected(false);
        };
        socket.onerror = () => {
          if (!cancelled) setErrorMessage("房间连接失败，请确认后端已启动。");
        };
      } catch {
        if (!cancelled) setErrorMessage("连不上房间服务，请确认后端已启动。");
      }
    })();

    return () => {
      cancelled = true;
      stopFlight();
      socketRef.current?.close();
      socketRef.current = null;
    };
    // Enter the room once per invite/create; parent callback is not a dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, initialCode]);

  const bothReady = firstReady && secondReady;
  const myTurn = bothReady && !gameOver && turn === seat;
  const myRestart = seat === secondSeat ? restartSecond : restartFirst;
  const oppRestart = seat === secondSeat ? restartFirst : restartSecond;
  const shareUrl = code ? roomShareUrl(game, code) : "";
  const history = useMemo(
    () => (pairHistory ? pairHistory(sans) : []),
    [pairHistory, sans],
  );

  function rematchLabel() {
    if (myRestart && !oppRestart) return "已申请，等待对方";
    if (oppRestart && !myRestart) return "同意再来一局";
    return gameOver ? "再来一局" : "重新开局";
  }

  function rematchHint() {
    if (myRestart && !oppRestart) return "已申请再来一局，等待对方同意。";
    if (oppRestart && !myRestart) return "对方想再来一局。点同意后开下。";
    return "";
  }

  function send(payload) {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      setErrorMessage("房间未连接。");
      return;
    }
    socket.send(JSON.stringify(payload));
  }

  function sendMove(uci, nextFen) {
    if (!myTurn || pendingRef.current) return;
    restoreRef.current = {
      fen,
      legalUci,
      fromSquare,
      toSquare,
      turn,
      sans,
    };
    pendingRef.current = { uci, afterCount: sans.length + 1 };
    const from = uci.slice(0, 2);
    const to = uci.slice(-2);
    startFlight(from, to, fen, nextFen, slideMs);
    fenRef.current = nextFen;
    setLegalUci([]);
    setFromSquare(from);
    setToSquare(to);
    setTurn(seat === firstSeat ? secondSeat : firstSeat);
    clockSyncRef.current = {
      remain: clockLimitMs,
      at: performance.now(),
      running: clockLimitMs > 0,
    };
    if (clockLimitMs > 0) setDisplayClockMs(clockLimitMs);
    setErrorMessage("");
    send({ type: "move", uci });
  }

  function handleRestart() {
    if (myRestart) return;
    pendingRef.current = null;
    restoreRef.current = null;
    if (seat === secondSeat) setRestartSecond(true);
    else setRestartFirst(true);
    send({ type: "restart" });
  }

  function handleResign() {
    if (!bothReady || gameOver) return;
    send({ type: "resign" });
  }

  async function copyText(label, value) {
    try {
      await copyTextToClipboard(value);
      setCopied(label);
      setErrorMessage("");
      setTimeout(() => setCopied(""), 1500);
    } catch {
      setErrorMessage("无法复制，请手动选中下面的链接。");
    }
  }

  const rematchLine = rematchHint();
  const statusLine = !token
    ? errorMessage || "正在进入房间…"
    : rematchLine
      ? rematchLine
      : gameOver
        ? resultCopy(result, seat, endReason)
        : !bothReady
          ? "把房间码或链接发给对方。对方加入后开下。"
          : !connected
            ? "连接断开，请刷新页面。"
            : myTurn
              ? "轮到你走。"
              : "轮到对方。";

  return (
    <GameScreen
      header={
        <GameHeader
          onBack={onBack}
          onHome={onHome}
          backLabel="返回"
          slogan={sloganFor(seat, firstSeat)}
        />
      }
      board={renderBoard({
        fen,
        legalUci,
        fromSquare,
        toSquare,
        myTurn,
        seat,
        flight,
        onMove: sendMove,
      })}
      panel={
        <>
          <p className="text-sm leading-relaxed text-neutral-900">{statusLine}</p>
          <div className="mt-3 text-sm text-neutral-500">
            {metaFor(seat, bothReady, clockLimitMs)}
          </div>
          {bothReady && clockLimitMs > 0 ? (
            <div className="mt-3 flex items-baseline justify-between border border-neutral-200 bg-neutral-50 px-3 py-2">
              <span className="text-xs font-semibold tracking-wide text-neutral-500">
                {gameOver ? "步时" : myTurn ? "你的步时" : "对方步时"}
              </span>
              <span
                className={`font-mono text-2xl tabular-nums ${
                  !gameOver && displayClockMs <= 10_000
                    ? "text-red-600"
                    : "text-neutral-900"
                }`}
              >
                {formatClock(gameOver ? 0 : displayClockMs)}
              </span>
            </div>
          ) : null}
          {code ? (
            <div className="mt-4 rounded-none border border-neutral-200 bg-neutral-50 px-3 py-3">
              <p className="text-xs font-semibold tracking-wide text-neutral-500">
                房间码
              </p>
              <p className="mt-1 font-mono text-2xl tracking-[0.3em] text-neutral-900">
                {code}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => copyText("code", code)}
                  className="rounded-none border border-neutral-300 px-3 py-1.5 text-sm"
                >
                  {copied === "code" ? "已复制" : "复制房间码"}
                </button>
                <button
                  type="button"
                  onClick={() => copyText("link", shareUrl)}
                  className="rounded-none bg-red-600 px-3 py-1.5 text-sm font-medium text-white"
                >
                  {copied === "link" ? "已复制" : "复制链接"}
                </button>
              </div>
              <p className="mt-2 break-all font-mono text-xs leading-relaxed text-neutral-500 select-all">
                {shareUrl}
              </p>
            </div>
          ) : null}
          {errorMessage ? (
            <p className="mt-3 text-sm text-red-600">{errorMessage}</p>
          ) : null}
          <GameControls>
            <button
              type="button"
              onClick={handleResign}
              disabled={!token || !bothReady || gameOver}
              className="rounded-none border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-900 disabled:opacity-50"
            >
              认输
            </button>
            <button
              type="button"
              onClick={handleRestart}
              disabled={!token || !bothReady || myRestart}
              className="rounded-none bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {rematchLabel()}
            </button>
          </GameControls>
          <MoveHistory title="着法" empty={historyEmpty}>
            {history.length === 0 ? null : (
              <ol className="mt-2 space-y-1 font-mono text-sm">
                {history.map((row) => (
                  <li key={row.n}>
                    {row.n}. {row.a} {row.b}
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
            message={
              rematchLine
                ? `${resultCopy(result, seat, endReason)} ${rematchLine}`
                : resultCopy(result, seat, endReason)
            }
            onRestart={handleRestart}
            onDismiss={() => setOverOpen(false)}
            onBack={onBack}
            onHome={onHome}
            restartLabel={rematchLabel()}
            restartDisabled={!token || !bothReady || myRestart}
          />
        ) : null
      }
    />
  );
}
