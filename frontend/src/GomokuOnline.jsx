import { useEffect, useMemo, useRef, useState } from "react";
import GomokuBoard from "./GomokuBoard.jsx";
import {
  GameControls,
  GameHeader,
  GameOverDialog,
  GameScreen,
  MoveHistory,
} from "./GameShell.jsx";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";
const SEAT_KEY = "plyhan-gomoku-seat";

function coordinate(move) {
  if (!move) return "";
  return `${String.fromCharCode(65 + move.col)}${move.row + 1}`;
}

function resultCopy(result, seat) {
  if (result === "draw") return "棋盘已满，和棋。";
  if (result === "black" || result === "white") {
    if (result === seat) return "五子连珠。你赢了。";
    return "五子连珠。对方赢了。";
  }
  return "对局结束。";
}

function loadSeat(code) {
  try {
    const raw = JSON.parse(sessionStorage.getItem(SEAT_KEY) || "null");
    if (raw && raw.code === code && raw.token && raw.seat) return raw;
  } catch {
    /* ignore */
  }
  return null;
}

function saveSeat(payload) {
  sessionStorage.setItem(SEAT_KEY, JSON.stringify(payload));
}

function roomShareUrl(code) {
  const url = new URL(window.location.href);
  url.searchParams.set("game", "gomoku");
  url.searchParams.set("r", code);
  return url.toString();
}

function roomWsUrl(code, token) {
  const httpBase = API_BASE_URL.endsWith("/") ? API_BASE_URL : `${API_BASE_URL}/`;
  const ws = new URL(
    `api/v1/gomoku/rooms/${encodeURIComponent(code)}/ws`,
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

export default function GomokuOnline({ initialCode, onBack, onRoomCode }) {
  const [code, setCode] = useState((initialCode || "").toUpperCase());
  const [seat, setSeat] = useState("");
  const [token, setToken] = useState("");
  const [moves, setMoves] = useState([]);
  const [turn, setTurn] = useState("black");
  const [whiteReady, setWhiteReady] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [result, setResult] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [overOpen, setOverOpen] = useState(false);
  const [copied, setCopied] = useState("");
  const [connected, setConnected] = useState(false);
  const socketRef = useRef(null);
  const seatRef = useRef("");
  const pendingRef = useRef(null);
  const applyStateRef = useRef(null);

  function rollbackPending() {
    const pending = pendingRef.current;
    if (!pending) return;
    pendingRef.current = null;
    setMoves((prev) =>
      prev.filter(
        (move) => !(move.row === pending.row && move.col === pending.col),
      ),
    );
    setTurn(seatRef.current);
  }

  function applyState(data) {
    if (data?.type === "error" || data?.status === "error") {
      rollbackPending();
      setErrorMessage(data?.error_message || "房间状态异常。");
      return;
    }
    if (Array.isArray(data.moves) && pendingRef.current) {
      const pending = pendingRef.current;
      const confirmed = data.moves.some(
        (move) =>
          move.row === pending.row &&
          move.col === pending.col &&
          move.player === pending.player,
      );
      if (!confirmed) {
        if (data.code) setCode(data.code);
        setWhiteReady(Boolean(data.white_ready));
        return;
      }
      pendingRef.current = null;
    }
    if (data.code) setCode(data.code);
    if (Array.isArray(data.moves)) setMoves(data.moves);
    if (data.turn !== undefined) setTurn(data.turn || "");
    setWhiteReady(Boolean(data.white_ready));
    setGameOver(Boolean(data.game_over));
    setResult(data.result || "");
    if (data.error_message) setErrorMessage(data.error_message);
    else setErrorMessage("");
    if (data.game_over) setOverOpen(true);
    else setOverOpen(false);
  }

  applyStateRef.current = applyState;

  useEffect(() => {
    let cancelled = false;
    const saved = loadSeat((initialCode || "").toUpperCase());

    (async () => {
      try {
        let data;
        if (initialCode) {
          data = await postJson(
            `/api/v1/gomoku/rooms/${encodeURIComponent(initialCode)}/join`,
            { token: saved?.token || "" },
          );
        } else {
          data = await postJson("/api/v1/gomoku/rooms");
        }
        if (cancelled) return;
        if (data.status !== "success" || !data.token || !data.code) {
          setErrorMessage(data.error_message || "无法进入房间。");
          return;
        }
        setToken(data.token);
        setSeat(data.seat);
        seatRef.current = data.seat;
        setCode(data.code);
        saveSeat({ code: data.code, token: data.token, seat: data.seat });
        onRoomCode?.(data.code);
        applyStateRef.current?.(data);

        const socket = new WebSocket(roomWsUrl(data.code, data.token));
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
      socketRef.current?.close();
      socketRef.current = null;
    };
    // Enter the room once per invite/create; parent callback is not a dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCode]);

  const bothReady = whiteReady;
  const myTurn = bothReady && !gameOver && turn === seat;
  const shareUrl = code ? roomShareUrl(code) : "";

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

  function send(payload) {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      setErrorMessage("房间未连接。");
      return;
    }
    socket.send(JSON.stringify(payload));
  }

  function handlePointClick(row, col) {
    if (!myTurn || pendingRef.current) return;
    if (moves.some((move) => move.row === row && move.col === col)) return;
    const move = { row, col, player: seat };
    pendingRef.current = move;
    setMoves((prev) => [...prev, move]);
    setTurn(seat === "black" ? "white" : "black");
    setErrorMessage("");
    send({ type: "move", row, col });
  }

  function handleRestart() {
    pendingRef.current = null;
    setOverOpen(false);
    send({ type: "restart" });
  }

  async function copyText(label, value) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setTimeout(() => setCopied(""), 1500);
    } catch {
      setErrorMessage("无法复制，请手动选中文字。");
    }
  }

  const statusLine = !token
    ? errorMessage || "正在进入房间…"
    : gameOver
      ? resultCopy(result, seat)
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
          slogan={
            seat === "white"
              ? "你执白。和对方轮流落子。"
              : "你执黑。把链接发给对方。"
          }
        />
      }
      board={
        <GomokuBoard
          moves={moves}
          disabled={!myTurn}
          onPointClick={handlePointClick}
          animateLast={Boolean(
            moves.length && moves[moves.length - 1].player !== seat,
          )}
        />
      }
      panel={
        <>
          <p className="text-sm leading-relaxed text-neutral-900">{statusLine}</p>
          <div className="mt-3 text-sm text-neutral-500">
            15×15 自由规则 · 你执{seat === "white" ? "白" : "黑"}
            {bothReady ? " · 对方已加入" : " · 等待对方"}
          </div>
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
            </div>
          ) : null}
          {errorMessage ? (
            <p className="mt-3 text-sm text-red-600">{errorMessage}</p>
          ) : null}
          <GameControls>
            <button
              type="button"
              onClick={handleRestart}
              disabled={!token}
              className="rounded-none bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              重新开局
            </button>
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
          <GameOverDialog
            title="对局结束"
            message={resultCopy(result, seat)}
            onRestart={handleRestart}
            onDismiss={() => setOverOpen(false)}
          />
        ) : null
      }
    />
  );
}
