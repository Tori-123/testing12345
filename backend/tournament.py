import asyncio
import random
import time as _time
import uuid

import httpx
from fastapi import APIRouter

try:
    from .score_tournament import (
        LOSE_DELTA,
        WIN_DELTA,
        apply_score,
        get_points,
        list_scores,
        seed_virtual_scores,
    )
    from .tournament_bot import run_virtual_player
    from .virtual_users import VIRTUAL_USERS, claim_virtual, find_virtual, release_virtual
except ImportError:
    from score_tournament import (
        LOSE_DELTA,
        WIN_DELTA,
        apply_score,
        get_points,
        list_scores,
        seed_virtual_scores,
    )
    from tournament_bot import run_virtual_player
    from virtual_users import VIRTUAL_USERS, claim_virtual, find_virtual, release_virtual

SELF_URL = "http://127.0.0.1:8000"

GAMES = ["chess", "gomoku", "xiangqi", "draughts"]
MATCH_WAIT_MIN_S = 8
MATCH_WAIT_MAX_S = 15

FIRST_SEAT = {
    "chess": "white",
    "gomoku": "black",
    "xiangqi": "red",
    "draughts": "black",
}

router = APIRouter()

_waiters: dict[str, dict] = {}
_results: dict[str, dict] = {}
_applied: set[str] = set()
_lock = asyncio.Lock()
_seeded = False
LEADERBOARD_LIMIT = 40


def _merged_leaderboard() -> list[dict]:
    live = list_scores(limit=100)
    seen: set[str] = set()
    merged: list[dict] = []
    for row in live:
        uid = str(row.get("user_id") or "")
        merged.append(
            {
                "username": row.get("username") or "",
                "points": int(row.get("points") or 0),
                "wins": int(row.get("wins") or 0),
                "losses": int(row.get("losses") or 0),
            }
        )
        if uid:
            seen.add(uid)
    for bot in VIRTUAL_USERS:
        if bot["id"] in seen:
            continue
        merged.append(
            {
                "username": bot["username"],
                "points": int(bot["points"]),
                "wins": int(bot["wins"]),
                "losses": int(bot["losses"]),
            }
        )
    merged.sort(key=lambda item: (-item["points"], item["username"]))
    return merged[:LEADERBOARD_LIMIT]


async def _create_room(game: str) -> dict:
    async with httpx.AsyncClient(base_url=SELF_URL, timeout=10.0) as client:
        resp = await client.post(
            f"/api/v1/{game}/rooms",
            json={"seat": FIRST_SEAT.get(game, "white"), "clock": True},
        )
        resp.raise_for_status()
        data = resp.json()
        return {"code": data["code"], "token": data["token"], "seat": data["seat"]}


async def _join_room(game: str, code: str) -> dict:
    async with httpx.AsyncClient(base_url=SELF_URL, timeout=10.0) as client:
        resp = await client.post(
            f"/api/v1/{game}/rooms/{code}/join",
            json={"token": ""},
        )
        resp.raise_for_status()
        data = resp.json()
        return {"token": data["token"], "seat": data["seat"]}


def _matched(
    game: str,
    seat: str,
    code: str,
    token: str,
    opponent: str,
    opponent_id: str = "",
) -> dict:
    return {
        "status": "matched",
        "game": game,
        "seat": seat,
        "code": code,
        "token": token,
        "opponent": opponent,
        "opponent_id": opponent_id,
    }


async def _pair_room(game: str) -> tuple[dict, dict]:
    room = await _create_room(game)
    joiner = await _join_room(game, room["code"])
    return room, joiner


async def _match_virtual(wait_id: str, waiter: dict) -> None:
    game = waiter["game"]
    bot = claim_virtual()
    if not bot:
        return
    try:
        room, joiner = await _pair_room(game)
    except Exception as exc:  # noqa: BLE001
        print(f"[tournament] virtual room failed: {exc}", flush=True)
        release_virtual(bot["id"])
        async with _lock:
            if wait_id not in _results:
                _results[wait_id] = {
                    "status": "error",
                    "error_message": "匹配失败，请再试一次。",
                }
        return

    async with _lock:
        if wait_id in _results:
            release_virtual(bot["id"])
            return
        _results[wait_id] = _matched(
            game,
            room["seat"],
            room["code"],
            room["token"],
            bot["username"],
            bot["id"],
        )
    human_points = get_points(waiter.get("user_id", ""))
    asyncio.create_task(
        _run_bot_then_release(
            game,
            room["code"],
            joiner["token"],
            joiner["seat"],
            bot["difficulty"],
            bot["id"],
            human_points,
        )
    )


async def _run_bot_then_release(
    game: str,
    code: str,
    token: str,
    seat: str,
    difficulty: str,
    bot_id: str,
    human_points: int = 0,
) -> None:
    try:
        await run_virtual_player(
            game, code, token, seat, difficulty, human_points=human_points
        )
    finally:
        release_virtual(bot_id)


async def _expire(wait_id: str, delay: float) -> None:
    try:
        await asyncio.sleep(delay)
    except asyncio.CancelledError:
        return
    async with _lock:
        waiter = _waiters.pop(wait_id, None)
        if not waiter or wait_id in _results:
            return
    await _match_virtual(wait_id, waiter)


@router.post("/api/v1/tournament/enter")
async def tournament_enter(payload: dict) -> dict:
    user_id = payload.get("user_id", "")
    username = payload.get("username", "")
    game = payload.get("game", "")
    if not user_id or not username:
        return {"status": "error", "error_message": "需要登录后参加竞标赛。"}
    if game not in GAMES:
        return {"status": "error", "error_message": "未知棋种。"}

    partner = None
    async with _lock:
        for other_id, other in list(_waiters.items()):
            if other["user_id"] == user_id:
                continue
            if other.get("game") != game:
                continue
            _waiters.pop(other_id, None)
            if other.get("task"):
                other["task"].cancel()
            partner = (other_id, other)
            break

    if partner:
        other_id, other = partner
        try:
            room, joiner = await _pair_room(game)
        except Exception:  # noqa: BLE001
            async with _lock:
                _results[other_id] = {
                    "status": "error",
                    "error_message": "匹配失败，请再试一次。",
                }
            return {"status": "error", "error_message": "匹配失败，请再试一次。"}
        async with _lock:
            _results[other_id] = _matched(
                game,
                room["seat"],
                room["code"],
                room["token"],
                username,
            )
        return _matched(
            game,
            joiner["seat"],
            room["code"],
            joiner["token"],
            other["username"],
        )

    wait_id = uuid.uuid4().hex
    delay = random.randint(MATCH_WAIT_MIN_S, MATCH_WAIT_MAX_S)
    task = asyncio.create_task(_expire(wait_id, delay))
    async with _lock:
        _waiters[wait_id] = {
            "wait_id": wait_id,
            "user_id": user_id,
            "username": username,
            "game": game,
            "enqueued_at": _time.monotonic(),
            "task": task,
        }
    return {"status": "waiting", "wait_id": wait_id, "game": game}


@router.post("/api/v1/tournament/cancel")
async def tournament_cancel(payload: dict) -> dict:
    wait_id = payload.get("wait_id", "")
    async with _lock:
        waiter = _waiters.pop(wait_id, None)
        if waiter and waiter.get("task"):
            waiter["task"].cancel()
    return {"status": "ok"}


@router.get("/api/v1/tournament/leaderboard")
async def tournament_leaderboard() -> dict:
    global _seeded
    if not _seeded and seed_virtual_scores(VIRTUAL_USERS):
        _seeded = True
    return {"status": "ok", "rows": _merged_leaderboard()}


@router.get("/api/v1/tournament/status")
async def tournament_status(wait_id: str = "", user_id: str = "") -> dict:
    async with _lock:
        if wait_id in _results:
            return _results[wait_id]
        waiter = _waiters.get(wait_id)
        if waiter:
            elapsed = int(_time.monotonic() - waiter["enqueued_at"])
            return {
                "status": "waiting",
                "wait_id": wait_id,
                "elapsed": elapsed,
                "game": waiter.get("game", ""),
            }
    return {"status": "error", "error_message": "找不到匹配会话。"}


@router.post("/api/v1/tournament/report")
async def tournament_report(payload: dict) -> dict:
    match_id = payload.get("match_id", "")
    user_id = payload.get("user_id", "")
    username = payload.get("username", "")
    won = bool(payload.get("won", False))
    opponent = payload.get("opponent", "")
    opponent_id = payload.get("opponent_id", "")

    if not user_id:
        return {"status": "error", "error_message": "缺少用户。"}
    key = f"{match_id}:{user_id}"
    if key in _applied:
        return {"status": "ok", "already": True}
    _applied.add(key)

    delta = WIN_DELTA if won else LOSE_DELTA
    ok = apply_score(user_id, username, delta, won)
    bot = find_virtual(opponent_id, opponent)
    if bot:
        apply_score(bot["id"], bot["username"], WIN_DELTA if not won else LOSE_DELTA, not won)
    return {"status": "ok" if ok else "error", "delta": delta, "ok": ok}
