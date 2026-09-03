import asyncio
import random
import time as _time
import uuid

import httpx
from fastapi import APIRouter

from score_tournament import LOSE_DELTA, WIN_DELTA, apply_score

# 自调本机接口创建联机房间，复用现有房间/WebSocket 体系
SELF_URL = "http://127.0.0.1:8000"

GAMES = ["chess", "gomoku", "xiangqi", "draughts"]
DIFFICULTIES = ["beginner", "easy", "normal", "hard"]
BOT_NAME = "toir"
MATCH_TIMEOUT_S = 40

# 每个棋种的先手座位（创建房间时用它，让先进入的等待玩家执先手）
FIRST_SEAT = {
    "chess": "white",
    "gomoku": "black",
    "xiangqi": "red",
    "draughts": "black",
}

router = APIRouter()

# 等待队列里的玩家：{ wait_id, user_id, username, enqueued_at, task }
_waiters: dict[str, dict] = {}
# 已成对/超时的结果：wait_id -> {status, game, seat, token, code, difficulty, opponent}
_results: dict[str, dict] = {}
# 已结算过的对局（match_id:user_id 去重）
_applied: set[str] = set()
_lock = asyncio.Lock()


def _pick_game() -> str:
    return random.choice(GAMES)


def _pick_difficulty() -> str:
    return random.choice(DIFFICULTIES)


async def _create_room(game: str) -> dict:
    """用本机 REST 建一个房间。创建者执先手座，返回 {code, token, seat}。"""
    async with httpx.AsyncClient(base_url=SELF_URL, timeout=10.0) as client:
        resp = await client.post(
            f"/api/v1/{game}/rooms",
            json={"seat": FIRST_SEAT.get(game, "white"), "clock": True},
        )
        resp.raise_for_status()
        data = resp.json()
        return {"code": data["code"], "token": data["token"], "seat": data["seat"]}


async def _join_room(game: str, code: str) -> str:
    async with httpx.AsyncClient(base_url=SELF_URL, timeout=10.0) as client:
        resp = await client.post(
            f"/api/v1/{game}/rooms/{code}/join",
            json={"token": ""},
        )
        resp.raise_for_status()
        data = resp.json()
        return {"token": data["token"], "seat": data["seat"]}


async def _expire(wait_id: str) -> None:
    await asyncio.sleep(MATCH_TIMEOUT_S)
    async with _lock:
        waiter = _waiters.pop(wait_id, None)
        if waiter and wait_id not in _results:
            _results[wait_id] = {
                "status": "bot",
                "game": _pick_game(),
                "difficulty": _pick_difficulty(),
                "opponent": BOT_NAME,
            }


@router.post("/api/v1/tournament/enter")
async def tournament_enter(payload: dict) -> dict:
    user_id = payload.get("user_id", "")
    username = payload.get("username", "")
    if not user_id or not username:
        return {"status": "error", "error_message": "需要登录后参加竞标赛。"}

    async with _lock:
        # 尝试和已在等的玩家配对
        for other_id, other in list(_waiters.items()):
            if other["user_id"] == user_id:
                continue
            _waiters.pop(other_id, None)
            if other.get("task"):
                other["task"].cancel()
            game = _pick_game()
            try:
                room = await _create_room(game)
                opp = await _join_room(game, room["code"])
            except Exception:  # noqa: BLE001
                _results[other_id] = {
                    "status": "bot",
                    "game": game,
                    "difficulty": _pick_difficulty(),
                    "opponent": BOT_NAME,
                }
                return {
                    "status": "bot",
                    "game": game,
                    "difficulty": _pick_difficulty(),
                    "opponent": BOT_NAME,
                }
            # other（先到）执先手座（creator），当前玩家执剩余座（joiner）
            _results[other_id] = {
                "status": "matched",
                "game": game,
                "seat": room["seat"],
                "code": room["code"],
                "token": room["token"],
                "opponent": username,
            }
            return {
                "status": "matched",
                "game": game,
                "seat": opp["seat"],
                "code": room["code"],
                "token": opp["token"],
                "opponent": other["username"],
            }

        # 没人等在 -> 入队并安排 40s 超时
        wait_id = uuid.uuid4().hex
        task = asyncio.create_task(_expire(wait_id))
        _waiters[wait_id] = {
            "wait_id": wait_id,
            "user_id": user_id,
            "username": username,
            "enqueued_at": _time.monotonic(),
            "task": task,
        }
        return {"status": "waiting", "wait_id": wait_id}


@router.get("/api/v1/tournament/status")
async def tournament_status(wait_id: str = "", user_id: str = "") -> dict:
    async with _lock:
        if wait_id in _results:
            return _results[wait_id]
        waiter = _waiters.get(wait_id)
        if waiter:
            elapsed = int(_time.monotonic() - waiter["enqueued_at"])
            return {"status": "waiting", "wait_id": wait_id, "elapsed": elapsed}
    return {"status": "error", "error_message": "找不到匹配会话。"}


@router.post("/api/v1/tournament/report")
async def tournament_report(payload: dict) -> dict:
    match_id = payload.get("match_id", "")
    user_id = payload.get("user_id", "")
    username = payload.get("username", "")
    won = bool(payload.get("won", False))

    if not user_id:
        return {"status": "error", "error_message": "缺少用户。"}
    key = f"{match_id}:{user_id}"
    if key in _applied:
        return {"status": "ok", "already": True}
    _applied.add(key)

    delta = WIN_DELTA if won else LOSE_DELTA
    ok = apply_score(user_id, username, delta, won)
    return {"status": "ok" if ok else "error", "delta": delta, "ok": ok}
