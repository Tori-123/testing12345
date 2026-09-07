"""Play one tournament seat through the existing room WebSocket + play APIs."""

from __future__ import annotations

import asyncio
import json
import random

import httpx
import websockets

SELF_URL = "http://127.0.0.1:8000"
HUMAN_SEAT = {
    "chess": "white",
    "gomoku": "black",
    "xiangqi": "red",
    "draughts": "black",
}
_TIER_ORDER = ("beginner", "easy", "normal", "hard")


def points_tier(points: int) -> str:
    if points <= 7:
        return "beginner"
    if points <= 13:
        return "easy"
    if points <= 23:
        return "normal"
    return "hard"


def _ply_count(game: str, state: dict) -> int:
    if game == "gomoku":
        return len(state.get("moves") or [])
    return len(state.get("sans") or [])


def rematch_probability(
    game: str,
    ply: int,
    bot_difficulty: str,
    human_points: int,
) -> float:
    if game == "gomoku":
        short = ply < 12
        long_game = ply >= 20
    else:
        short = ply < 16
        long_game = ply >= 24
    if short:
        chance = 0.10
    elif long_game:
        chance = 0.70
    else:
        chance = 0.40

    bot_tier = bot_difficulty if bot_difficulty in _TIER_ORDER else "normal"
    gap = abs(_TIER_ORDER.index(bot_tier) - _TIER_ORDER.index(points_tier(human_points)))
    if gap >= 2:
        chance = min(chance, 0.10)
    return chance


def _both_ready(game: str, state: dict) -> bool:
    first = HUMAN_SEAT[game]
    second = {
        "chess": "black",
        "gomoku": "white",
        "xiangqi": "black",
        "draughts": "white",
    }[game]
    return bool(state.get(f"{first}_ready") and state.get(f"{second}_ready"))


async def _engine_move(game: str, state: dict, difficulty: str) -> dict | None:
    human = HUMAN_SEAT[game]
    async with httpx.AsyncClient(base_url=SELF_URL, timeout=25.0) as client:
        if game == "gomoku":
            resp = await client.post(
                "/api/v1/gomoku/play",
                json={
                    "moves": state.get("moves") or [],
                    "difficulty": difficulty,
                    "side": human,
                },
            )
            data = resp.json()
            move = data.get("engine_move")
            if not move:
                return None
            return {"type": "move", "row": move["row"], "col": move["col"]}

        path = {
            "chess": "/api/v1/play",
            "xiangqi": "/api/v1/xiangqi/play",
            "draughts": "/api/v1/draughts/play",
        }[game]
        resp = await client.post(
            path,
            json={
                "fen": state.get("fen") or "",
                "uci": "",
                "difficulty": difficulty,
                "side": human,
            },
        )
        data = resp.json()
        uci = (data.get("engine_uci") or "").strip()
        if not uci:
            return None
        return {"type": "move", "uci": uci}


async def run_virtual_player(
    game: str,
    code: str,
    token: str,
    seat: str,
    difficulty: str,
    human_points: int = 0,
) -> None:
    uri = (
        f"ws://127.0.0.1:8000/api/v1/{game}/rooms/{code}/ws"
        f"?token={token}"
    )
    moving = False
    agreeing = False
    try:
        async with websockets.connect(uri, open_timeout=10, max_size=2**20) as ws:
            async for raw in ws:
                try:
                    state = json.loads(raw)
                except json.JSONDecodeError:
                    continue
                if state.get("type") != "state":
                    continue

                if (
                    state.get("game_over")
                    and state.get(f"restart_{HUMAN_SEAT[game]}")
                    and not state.get(f"restart_{seat}")
                    and not agreeing
                ):
                    agreeing = True
                    chance = rematch_probability(
                        game, _ply_count(game, state), difficulty, human_points
                    )

                    async def _decide() -> None:
                        await asyncio.sleep(1.0)
                        try:
                            if random.random() < chance:
                                await ws.send(json.dumps({"type": "restart"}))
                            else:
                                await ws.close()
                        except Exception:
                            pass

                    asyncio.create_task(_decide())
                    continue

                if not state.get("game_over"):
                    agreeing = False

                if (
                    moving
                    or state.get("game_over")
                    or not _both_ready(game, state)
                    or state.get("turn") != seat
                ):
                    continue

                moving = True

                async def _play(snapshot: dict) -> None:
                    nonlocal moving
                    try:
                        await asyncio.sleep(0.4 + random.random() * 0.8)
                        payload = await _engine_move(game, snapshot, difficulty)
                        if payload:
                            await ws.send(json.dumps(payload))
                    except Exception as exc:  # noqa: BLE001
                        print(f"[tournament-bot] move failed: {exc}", flush=True)
                    finally:
                        moving = False

                asyncio.create_task(_play(state))
    except Exception as exc:  # noqa: BLE001
        print(f"[tournament-bot] socket closed: {exc}", flush=True)
