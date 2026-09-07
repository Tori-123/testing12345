import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import ChessGame from "../ChessGame.jsx";
import GomokuGame from "../GomokuGame.jsx";
import XiangqiGame from "../XiangqiGame.jsx";
import DraughtsGame from "../DraughtsGame.jsx";
import { useAuth, usernameOf } from "../auth/AuthContext";
import { ThemeToggle } from "../theme.jsx";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

// crypto.randomUUID 仅在安全上下文（https/localhost）可用；非安全的 http 下会抛异常，
// 这里做降级，避免线上打开 /tournament 时白屏。
function genId() {
  try {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  } catch {
    /* fall through */
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
const GAME_LABEL = {
  chess: "国际象棋",
  gomoku: "五子棋",
  xiangqi: "中国象棋",
  draughts: "跳棋",
};

const GAME_COMPONENT = {
  chess: ChessGame,
  gomoku: GomokuGame,
  xiangqi: XiangqiGame,
  draughts: DraughtsGame,
};

function computeWon(game, seat, result) {
  if (!result || !seat) return false;
  // online 各棋种 result 为胜方颜色
  if (["white", "black", "red"].includes(result)) return result === seat;
  // bot 象棋/中国象棋 result 为 1-0 / 0-1
  if (game === "chess") {
    return (
      (result === "1-0" && seat === "white") ||
      (result === "0-1" && seat === "black")
    );
  }
  if (game === "xiangqi") {
    return (
      (result === "1-0" && seat === "red") ||
      (result === "0-1" && seat === "black")
    );
  }
  return false;
}

async function postJson(path, body) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return await res.json();
}

function Leaderboard() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/v1/tournament/leaderboard`);
        const data = await res.json();
        if (!cancelled) setRows(Array.isArray(data.rows) ? data.rows : []);
      } catch {
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="mt-8 w-full max-w-md">
      <h2 className="text-sm font-semibold tracking-wide text-neutral-500">
        积分排行榜
      </h2>
      <div className="mt-2 max-h-[40vh] overflow-y-auto rounded-none border border-line">
        {loading ? (
          <p className="px-4 py-3 text-sm text-neutral-500">加载中…</p>
        ) : rows.length === 0 ? (
          <p className="px-4 py-3 text-sm text-neutral-500">还没有人上榜。</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                <th className="px-4 py-2 font-medium">#</th>
                <th className="px-4 py-2 font-medium">用户名</th>
                <th className="px-4 py-2 text-right font-medium">积分</th>
                <th className="px-4 py-2 text-right font-medium">胜 / 负</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={row.username + i}
                  className="border-b border-line last:border-0"
                >
                  <td className="px-4 py-2 text-neutral-500">{i + 1}</td>
                  <td className="px-4 py-2">{row.username}</td>
                  <td className="px-4 py-2 text-right font-mono text-red-600">
                    {row.points}
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-neutral-500">
                    {row.wins} / {row.losses}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

const GAME_KEYS = ["chess", "gomoku", "xiangqi", "draughts"];

function SketchHand() {
  return (
    <svg
      className="tourney-shuffle-hand"
      viewBox="0 0 120 80"
      aria-hidden="true"
    >
      <path
        d="M50 78 C50 64 52 56 60 50"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path
        d="M38 50 C34 38 42 26 58 24 C76 22 88 34 86 48 C84 60 70 64 54 62 C44 61 40 56 38 50Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <path
        d="M44 34 C40 16 48 8 54 22"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M56 28 C56 8 64 6 64 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M66 28 C68 8 76 8 74 26"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M76 34 C84 16 90 20 82 36"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M36 46 C26 40 24 50 36 54"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function RiffleShuffle({ drawing = false, flipped = false, gameLabel = "" }) {
  return (
    <div className={`tourney-riffle mx-auto ${drawing ? "drawing" : ""}`}>
      {drawing ? null : <SketchHand />}
      <div className="tourney-riffle-deck">
        {[0, 1, 2, 3, 4].map((index) => (
          <div
            key={index}
            className="tourney-riffle-card"
            style={{ "--i": index }}
          />
        ))}
        {drawing ? (
          <div className="tourney-draw-card tourney-card">
            <div
              className={`tourney-card-face relative h-full w-full ${
                flipped ? "flipped" : ""
              }`}
            >
              <div className="tourney-card-back absolute inset-0 flex items-center justify-center border border-line bg-surface text-lg text-muted">
                ?
              </div>
              <div className="tourney-card-front absolute inset-0 flex items-center justify-center border border-red-600 bg-surface px-1 text-center text-sm font-medium text-red-600">
                {gameLabel}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Lobby({ user, onMatch, name }) {
  const [phase, setPhase] = useState("idle");
  const [waitId, setWaitId] = useState("");
  const [picked, setPicked] = useState("");
  const [flipped, setFlipped] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");
  const pollRef = useRef(null);
  const timersRef = useRef([]);
  const aliveRef = useRef(true);

  function clearTimers() {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
  }

  const playReveal = useCallback(
    (result) => {
      clearTimers();
      if (pollRef.current) window.clearInterval(pollRef.current);
      setWaitId("");
      setPhase("revealing");
      setFlipped(false);
      timersRef.current.push(
        window.setTimeout(() => setFlipped(true), 700),
        window.setTimeout(() => onMatch(result), 1800),
      );
    },
    [onMatch],
  );

  async function enterQueue(game) {
    const res = await postJson("/api/v1/tournament/enter", {
      user_id: user.id,
      username: name,
      game,
    });
    if (!aliveRef.current) {
      if (res.status === "waiting" && res.wait_id) {
        postJson("/api/v1/tournament/cancel", { wait_id: res.wait_id }).catch(() => {});
      }
      return;
    }
    if (res.status === "matched") {
      playReveal(res);
      return;
    }
    if (res.status !== "waiting") {
      setError(res.error_message || "进入匹配失败。");
      setPhase("idle");
      return;
    }
    setWaitId(res.wait_id);
    setPhase("waiting");
  }

  function start() {
    setError("");
    setWaitId("");
    setElapsed(0);
    setFlipped(false);
    const winner = GAME_KEYS[Math.floor(Math.random() * GAME_KEYS.length)];
    setPicked(winner);
    setPhase("waiting");
    aliveRef.current = true;
    clearTimers();
    enterQueue(winner);
  }

  useEffect(() => () => clearTimers(), []);

  useEffect(() => {
    if (!waitId) return;
    pollRef.current = window.setInterval(async () => {
      const res = await fetch(
        `${API_BASE_URL}/api/v1/tournament/status?wait_id=${encodeURIComponent(waitId)}&user_id=${encodeURIComponent(user.id)}`,
      )
        .then((r) => r.json())
        .catch(() => null);
      if (!res) return;
      if (res.status === "waiting") {
        setElapsed(res.elapsed || 0);
        return;
      }
      window.clearInterval(pollRef.current);
      if (res.status === "matched") {
        playReveal(res);
        return;
      }
      setWaitId("");
      setPhase("idle");
      if (res.error_message && res.error_message !== "找不到匹配会话。") {
        setError(res.error_message);
      }
    }, 2000);
    return () => window.clearInterval(pollRef.current);
  }, [waitId, user.id, playReveal]);

  async function cancel() {
    aliveRef.current = false;
    clearTimers();
    if (pollRef.current) window.clearInterval(pollRef.current);
    if (waitId) {
      postJson("/api/v1/tournament/cancel", { wait_id: waitId }).catch(() => {});
    }
    setWaitId("");
    setPhase("idle");
    setElapsed(0);
  }

  if (phase === "waiting" || phase === "revealing") {
    return (
      <main className="relative flex h-screen flex-col items-center justify-center bg-page px-5 font-sans text-ink">
        <div className="absolute right-5 top-5">
          <ThemeToggle />
        </div>
        <div className="w-full max-w-md text-center">
          <h2 className="text-2xl font-bold">
            {phase === "revealing" ? "抽取棋种" : "正在匹配对手…"}
          </h2>
          <div className="mt-8">
            <RiffleShuffle
              drawing={phase === "revealing"}
              flipped={flipped}
              gameLabel={GAME_LABEL[picked] || ""}
            />
          </div>
          {phase === "waiting" ? (
            <p className="mt-6 text-sm text-muted">已等待 {elapsed} 秒</p>
          ) : (
            <p className="mt-6 text-sm text-muted">抽出本局棋种</p>
          )}
          {phase === "waiting" ? (
            <button
              type="button"
              onClick={cancel}
              className="mt-8 text-sm text-muted underline underline-offset-2"
            >
              取消匹配
            </button>
          ) : null}
        </div>
      </main>
    );
  }

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-page px-4 py-5 font-sans text-ink sm:px-6 sm:py-8 [height:100dvh]">
      <header className="flex shrink-0 items-center justify-between gap-3">
        <p className="text-base font-semibold tracking-tight sm:text-lg">PlyHan</p>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <Link
            to="/"
            className="text-sm text-muted underline underline-offset-2 hover:text-ink"
          >
            返回
          </Link>
        </div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center text-center">
        <h1 className="text-3xl font-bold sm:text-4xl">竞标赛</h1>
        <button
          type="button"
          onClick={start}
          className="mt-8 w-full max-w-sm rounded-none bg-red-600 px-4 py-3 text-sm font-medium text-white"
        >
          开始匹配
        </button>
        {error ? <p className="mt-3 text-sm text-red-500">{error}</p> : null}
        <Leaderboard />
      </div>
    </main>
  );
}

function VsCard({ you, opponent }) {
  return (
    <main className="relative flex h-screen flex-col items-center justify-center bg-page px-5 font-sans text-ink [height:100dvh]">
      <div className="absolute right-5 top-5">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-lg text-center">
        <p className="text-sm tracking-wide text-muted">匹配成功</p>
        <div className="mt-8 flex items-center justify-center gap-4 sm:gap-8">
          <p className="min-w-0 flex-1 text-right text-2xl font-bold sm:text-3xl">
            {you}
          </p>
          <p className="shrink-0 text-sm font-semibold text-red-600">VS</p>
          <p className="min-w-0 flex-1 text-left text-2xl font-bold sm:text-3xl">
            {opponent}
          </p>
        </div>
        <div className="tourney-vs-bar mx-auto mt-8 h-1 w-full max-w-xs bg-line">
          <div className="h-full bg-red-600" />
        </div>
      </div>
    </main>
  );
}

function Gate({ name, toLogin }) {
  return (
    <main className="relative flex h-screen flex-col items-center justify-center bg-page px-5 font-sans text-ink [height:100dvh]">
      <div className="absolute right-5 top-5">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm text-center">
        <p className="text-base font-semibold tracking-tight">PlyHan</p>
        <h1 className="mt-2 text-2xl font-bold">竞标赛</h1>
        <p className="mt-4 text-sm leading-relaxed text-muted">
          {name ? `${name}，` : ""}参加竞标赛需要先登录账号。胜 +5 分、负 -2 分，积分计入排行榜。
        </p>
        <Link
          to="/login"
          className="mt-8 block w-full rounded-none bg-red-600 px-4 py-3 text-sm font-medium text-white"
        >
          去登录
        </Link>
        <Link
          to="/register"
          className="mt-3 block w-full rounded-none border border-line px-4 py-3 text-sm text-ink"
        >
          注册新账号
        </Link>
        <Link
          to="/"
          className="mt-6 block text-sm text-muted underline underline-offset-2"
        >
          先不登录，直接下棋
        </Link>
      </div>
    </main>
  );
}

export default function TournamentPage() {
  const { user } = useAuth();
  const [match, setMatch] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [reportResult, setReportResult] = useState("");
  const matchIdRef = useRef(genId());
  const vsTimerRef = useRef(null);

  const handleMatch = useCallback((next) => {
    if (vsTimerRef.current) window.clearTimeout(vsTimerRef.current);
    setPlaying(false);
    setMatch(next);
    vsTimerRef.current = window.setTimeout(() => setPlaying(true), 2000);
  }, []);

  useEffect(
    () => () => {
      if (vsTimerRef.current) window.clearTimeout(vsTimerRef.current);
    },
    [],
  );

  if (!user) {
    return <Gate />;
  }

  const name = usernameOf(user);

  async function handleFinish({ seat, result }) {
    if (!match || reportResult) return;
    const won = computeWon(match.game, seat, result);
    await postJson("/api/v1/tournament/report", {
      match_id: matchIdRef.current,
      user_id: user.id,
      username: name,
      won,
      opponent: match.opponent || "",
      opponent_id: match.opponent_id || "",
    });
    setReportResult(won ? "对局结束：你赢了，+5 积分" : "对局结束：你输了，-2 积分");
    setMatch({ ...match, finished: true });
  }

  if (match && !playing) {
    return <VsCard you={name} opponent={match.opponent || "对手"} />;
  }

  if (match) {
    const Game = GAME_COMPONENT[match.game];
    return (
      <Game
        initialMode="online"
        initialRoomCode={match.code}
        initialToken={match.token}
        initialSeat={match.seat}
        onFinish={handleFinish}
        compact
        opponentName={match.opponent || ""}
        onBack={() => {
          matchIdRef.current = genId();
          setReportResult("");
          setPlaying(false);
          setMatch(null);
        }}
      />
    );
  }

  return <Lobby user={user} name={name} onMatch={handleMatch} />;
}
