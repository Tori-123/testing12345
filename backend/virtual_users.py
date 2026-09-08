"""Fixed roster of 30 tournament stand-ins. IDs are stable uuid5 values."""

from __future__ import annotations

import random
import uuid

NS = uuid.UUID("6c8f0a1e-2b7d-4c3a-9e11-7f4d2a91b0c3")

_RAW = [
    ("baozi88", "beginner", 2, 1, 5),
    ("路过看看", "beginner", 0, 0, 3),
    ("qian2qian", "beginner", 4, 2, 4),
    ("不想取名", "beginner", 3, 1, 3),
    ("lei4k2", "beginner", 6, 3, 6),
    ("摸鱼选手", "beginner", 1, 0, 2),
    ("napping", "beginner", 5, 2, 5),
    ("xiaobei7", "beginner", 2, 1, 4),
    ("xQuietPawnx", "easy", 8, 4, 6),
    ("今晚开一局", "easy", 10, 5, 5),
    ("minghao92", "easy", 7, 3, 4),
    ("菜就多练", "easy", 12, 6, 6),
    ("GRUFFPIRATE", "easy", 9, 4, 5),
    ("junpark", "easy", 11, 5, 4),
    ("随便一把", "easy", 6, 3, 6),
    ("VRookV", "easy", 8, 4, 7),
    ("NightOwl9", "normal", 16, 8, 6),
    ("老王爱下棋", "normal", 18, 9, 5),
    ("adrianchen", "normal", 20, 10, 6),
    ("躺平第一", "normal", 15, 7, 6),
    ("xRedRiverx", "normal", 22, 11, 5),
    ("啊这能赢", "normal", 14, 6, 5),
    ("Kaito3b", "normal", 19, 9, 6),
    ("pawnstorm", "normal", 17, 8, 5),
    ("slowdrip", "hard", 28, 14, 4),
    ("新手求放过", "hard", 32, 16, 4),
    ("SILENTMOVE", "hard", 26, 13, 5),
    ("棋盘上睡觉", "hard", 35, 17, 3),
    ("xEndgamex", "hard", 30, 15, 4),
    ("blitz4fun", "hard", 38, 19, 3),
]

VIRTUAL_USERS = [
    {
        "id": str(uuid.uuid5(NS, name)),
        "username": name,
        "difficulty": difficulty,
        "points": points,
        "wins": wins,
        "losses": losses,
    }
    for name, difficulty, points, wins, losses in _RAW
]

_BY_ID = {row["id"]: row for row in VIRTUAL_USERS}
_BY_NAME = {row["username"]: row for row in VIRTUAL_USERS}
_busy: set[str] = set()


def find_virtual(user_id: str = "", username: str = "") -> dict | None:
    if user_id and user_id in _BY_ID:
        return _BY_ID[user_id]
    if username and username in _BY_NAME:
        return _BY_NAME[username]
    return None


def claim_virtual() -> dict | None:
    free = [row for row in VIRTUAL_USERS if row["id"] not in _busy]
    if not free:
        free = list(VIRTUAL_USERS)
    chosen = random.choice(free)
    _busy.add(chosen["id"])
    return chosen


def release_virtual(user_id: str) -> None:
    _busy.discard(user_id)
