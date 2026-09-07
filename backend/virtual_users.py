"""Fixed roster of 30 tournament stand-ins. IDs are stable uuid5 values."""

from __future__ import annotations

import random
import uuid

NS = uuid.UUID("6c8f0a1e-2b7d-4c3a-9e11-7f4d2a91b0c3")

_RAW = [
    ("林晓舟", "beginner", 2, 1, 5),
    ("陈小北", "beginner", 0, 0, 3),
    ("赵晚晴", "beginner", 4, 2, 4),
    ("周予安", "beginner", 3, 1, 3),
    ("吴青禾", "beginner", 6, 3, 6),
    ("郑拾光", "beginner", 1, 0, 2),
    ("冯疏影", "beginner", 5, 2, 5),
    ("蒋南山", "beginner", 2, 1, 4),
    ("何清越", "easy", 8, 4, 6),
    ("罗望舒", "easy", 10, 5, 5),
    ("韩听雨", "easy", 7, 3, 4),
    ("唐远舟", "easy", 12, 6, 6),
    ("曹暮云", "easy", 9, 4, 5),
    ("彭见山", "easy", 11, 5, 4),
    ("董怀远", "easy", 6, 3, 6),
    ("袁听潮", "easy", 8, 4, 7),
    ("萧知秋", "normal", 16, 8, 6),
    ("沈南枝", "normal", 18, 9, 5),
    ("吕承野", "normal", 20, 10, 6),
    ("魏长风", "normal", 15, 7, 6),
    ("崔望川", "normal", 22, 11, 5),
    ("任晚舟", "normal", 14, 6, 5),
    ("苏北辰", "normal", 19, 9, 6),
    ("钱听雪", "normal", 17, 8, 5),
    ("顾承安", "hard", 28, 14, 4),
    ("叶无白", "hard", 32, 16, 4),
    ("陆临渊", "hard", 26, 13, 5),
    ("谢长夜", "hard", 35, 17, 3),
    ("方既见", "hard", 30, 15, 4),
    ("裴听潮", "hard", 38, 19, 3),
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
