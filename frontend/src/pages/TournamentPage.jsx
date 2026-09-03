import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import ChessGame from "../ChessGame.jsx";
import GomokuGame from "../GomokuGame.jsx";
import XiangqiGame from "../XiangqiGame.jsx";
import DraughtsGame from "../DraughtsGame.jsx";
import { useAuth, usernameOf } from "../auth/AuthContext";
import { supabase } from "../lib/supabaseClient";

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
        const { data } = await supabase
          .from("tournament_scores")
          .select("username, points, wins, losses")
          .order("points", { ascending: false })
          .limit(20);
        if (!cancelled) setRows(data || []);
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
      <div className="mt-2 overflow-hidden rounded-none border border-neutral-800">
        {loading ? (
          <p className="px-4 py-3 text-sm text-neutral-500">加载中…</p>
        ) : rows.length === 0 ? (
          <p className="px-4 py-3 text-sm text-neutral-500">还没有人上榜。</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-800 text-left text-xs text-neutral-500">
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
                  className="border-b border-neutral-900 last:border-0"
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

function Lobby({ user, onMatch, name }) {
  const [searching, setSearching] = useState(false);
  const [waitId, setWaitId] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");
  const pollRef = useRef(null);

  async function start() {
    setError("");
    setSearching(true);
    setElapsed(0);
    const res = await postJson("/api/v1/tournament/enter", {
      user_id: user.id,
      username: name,
    });
    if (res.status === "matched") {
      onMatch(res);
      return;
    }
    if (res.status !== "waiting") {
      setError(res.error_message || "进入匹配失败。");
      setSearching(false);
      return;
    }
    setWaitId(res.wait_id);
  }

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
      setSearching(false);
      onMatch(res);
    }, 2000);
    return () => window.clearInterval(pollRef.current);
  }, [waitId, user.id]);

  if (searching) {
    return (
      <main className="flex h-screen flex-col items-center justify-center bg-neutral-950 px-5 font-sans text-neutral-100">
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-neutral-700 border-t-red-600" />
          <h2 className="mt-6 text-2xl font-bold">正在匹配对手…</h2>
          <p className="mt-3 text-sm text-neutral-500">
            随机一种棋，已有 {elapsed} 秒。40 秒内没真人，就派电脑（toir）陪你。
          </p>
          <button
            type="button"
            onClick={() => {
              if (pollRef.current) window.clearInterval(pollRef.current);
              setSearching(false);
              setWaitId("");
            }}
            className="mt-8 text-sm text-neutral-400 underline underline-offset-2"
          >
            取消匹配
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-neutral-950 px-4 py-5 font-sans text-neutral-100 sm:px-6 sm:py-8 [height:100dvh]">
      <header className="flex shrink-0 items-center justify-between">
        <p className="text-base font-semibold tracking-tight sm:text-lg">PlyHan</p>
        <Link
          to="/"
          className="text-sm text-neutral-500 underline underline-offset-2 hover:text-neutral-100"
        >
          返回
        </Link>
      </header>
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center text-center">
        <h1 className="text-3xl font-bold sm:text-4xl">竞标赛</h1>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-neutral-500">
          随机一种棋、随机难度实时匹配真人；40 秒没匹配到，就安排电脑（toir）。
          胜 +5 分，负 -2 分。
        </p>
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

function Gate({ name, toLogin }) {
  return (
    <main className="flex h-screen flex-col items-center justify-center bg-neutral-950 px-5 font-sans text-neutral-100 [height:100dvh]">
      <div className="w-full max-w-sm text-center">
        <p className="text-base font-semibold tracking-tight">PlyHan</p>
        <h1 className="mt-2 text-2xl font-bold">竞标赛</h1>
        <p className="mt-4 text-sm leading-relaxed text-neutral-500">
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
          className="mt-3 block w-full rounded-none border border-neutral-700 px-4 py-3 text-sm text-neutral-300"
        >
          注册新账号
        </Link>
        <Link
          to="/"
          className="mt-6 block text-sm text-neutral-500 underline underline-offset-2"
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
  const [reportResult, setReportResult] = useState("");
  const matchIdRef = useRef(genId());

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
    });
    setReportResult(won ? "对局结束：你赢了，+5 积分" : "对局结束：你输了，-2 积分");
    setMatch({ ...match, finished: true });
  }

  if (match) {
    const Game = GAME_COMPONENT[match.game];
    const online = match.status === "matched";
    return (
      <>
        {online ? (
          <Game
            initialMode="online"
            initialRoomCode={match.code}
            initialToken={match.token}
            initialSeat={match.seat}
            onFinish={handleFinish}
            onBack={() => setMatch(null)}
          />
        ) : (
          <Game
            initialMode="ai"
            initialDifficulty={match.difficulty}
            initialSeat={match.seat}
            onFinish={handleFinish}
            onBack={() => setMatch(null)}
          />
        )}
      </>
    );
  }

  return <Lobby user={user} name={name} onMatch={setMatch} />;
}
