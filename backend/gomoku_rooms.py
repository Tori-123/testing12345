import asyncio
import secrets
import time
from typing import Literal

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field

BOARD_SIZE = 15
ROOM_TTL_SECONDS = 2 * 60 * 60
CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
CODE_LENGTH = 4

router = APIRouter()


class GomokuRoomMove(BaseModel):
    row: int = Field(ge=0, lt=BOARD_SIZE)
    col: int = Field(ge=0, lt=BOARD_SIZE)
    player: Literal["black", "white"]


class JoinRoomRequest(BaseModel):
    token: str = ""


class RoomMoveRequest(BaseModel):
    row: int = Field(ge=0, lt=BOARD_SIZE)
    col: int = Field(ge=0, lt=BOARD_SIZE)


class RoomResponse(BaseModel):
    status: Literal["success", "error"]
    error_message: str
    code: str = ""
    seat: Literal["black", "white", ""] = ""
    token: str = ""
    black_ready: bool = False
    white_ready: bool = False
    moves: list[GomokuRoomMove] = Field(default_factory=list)
    turn: Literal["black", "white", ""] = ""
    game_over: bool = False
    result: Literal["black", "white", "draw", ""] = ""


def _winner(moves: list[dict]) -> str:
    occupied = {(move["row"], move["col"]): move["player"] for move in moves}
    for move in moves:
        for row_step, col_step in ((1, 0), (0, 1), (1, 1), (1, -1)):
            count = 1
            for direction in (-1, 1):
                row = move["row"] + row_step * direction
                col = move["col"] + col_step * direction
                while occupied.get((row, col)) == move["player"]:
                    count += 1
                    row += row_step * direction
                    col += col_step * direction
            if count >= 5:
                return move["player"]
    return ""


def _new_code() -> str:
    return "".join(secrets.choice(CODE_ALPHABET) for _ in range(CODE_LENGTH))


class Room:
    def __init__(self, code: str, black_token: str):
        self.code = code
        self.black_token = black_token
        self.white_token: str | None = None
        self.moves: list[dict] = []
        self.last_active = time.monotonic()
        self.sockets: set[WebSocket] = set()

    def touch(self) -> None:
        self.last_active = time.monotonic()

    def seat_for(self, token: str) -> str:
        if token and token == self.black_token:
            return "black"
        if token and token == self.white_token:
            return "white"
        return ""

    def snapshot(self) -> dict:
        winner = _winner(self.moves)
        full = len(self.moves) == BOARD_SIZE * BOARD_SIZE
        game_over = bool(winner) or full
        result = winner or ("draw" if full else "")
        turn = "" if game_over else ("black" if len(self.moves) % 2 == 0 else "white")
        return {
            "type": "state",
            "status": "success",
            "error_message": "",
            "code": self.code,
            "black_ready": True,
            "white_ready": bool(self.white_token),
            "moves": list(self.moves),
            "turn": turn,
            "game_over": game_over,
            "result": result,
        }


class RoomStore:
    def __init__(self):
        self._rooms: dict[str, Room] = {}
        self._lock = asyncio.Lock()

    def _purge(self) -> None:
        now = time.monotonic()
        expired = [
            code
            for code, room in self._rooms.items()
            if now - room.last_active > ROOM_TTL_SECONDS
        ]
        for code in expired:
            self._rooms.pop(code, None)

    async def create(self) -> tuple[Room, str]:
        async with self._lock:
            self._purge()
            for _ in range(20):
                code = _new_code()
                if code not in self._rooms:
                    token = secrets.token_urlsafe(16)
                    room = Room(code, token)
                    self._rooms[code] = room
                    return room, token
            raise RuntimeError("无法分配房间码")

    async def get(self, code: str) -> Room | None:
        async with self._lock:
            self._purge()
            return self._rooms.get(code.upper())

    async def join(self, code: str, token: str) -> tuple[Room | None, str, str]:
        async with self._lock:
            self._purge()
            room = self._rooms.get(code.upper())
            if room is None:
                return None, "", ""
            room.touch()
            existing = room.seat_for(token)
            if existing:
                return room, existing, token
            if room.white_token is None:
                white_token = secrets.token_urlsafe(16)
                room.white_token = white_token
                return room, "white", white_token
            return room, "", ""


store = RoomStore()


def _response(
    room: Room | None,
    *,
    error: str = "",
    seat: str = "",
    token: str = "",
) -> RoomResponse:
    if room is None:
        return RoomResponse(status="error", error_message=error or "房间不存在。")
    data = room.snapshot()
    return RoomResponse(
        status="error" if error else "success",
        error_message=error,
        code=data["code"],
        seat=seat,
        token=token,
        black_ready=data["black_ready"],
        white_ready=data["white_ready"],
        moves=[GomokuRoomMove(**move) for move in data["moves"]],
        turn=data["turn"],
        game_over=data["game_over"],
        result=data["result"],
    )


async def _broadcast(room: Room, extra: dict | None = None) -> None:
    payload = extra or room.snapshot()
    dead: list[WebSocket] = []
    for socket in list(room.sockets):
        try:
            await socket.send_json(payload)
        except Exception:
            dead.append(socket)
    for socket in dead:
        room.sockets.discard(socket)


@router.post("/api/v1/gomoku/rooms", response_model=RoomResponse)
async def create_room() -> RoomResponse:
    try:
        room, token = await store.create()
    except RuntimeError as exc:
        return RoomResponse(status="error", error_message=str(exc))
    return _response(room, seat="black", token=token)


@router.get("/api/v1/gomoku/rooms/{code}", response_model=RoomResponse)
async def get_room(code: str, token: str = "") -> RoomResponse:
    room = await store.get(code)
    if room is None:
        return _response(None, error="房间不存在或已过期。")
    seat = room.seat_for(token)
    return _response(room, seat=seat, token=token if seat else "")


@router.post("/api/v1/gomoku/rooms/{code}/join", response_model=RoomResponse)
async def join_room(code: str, payload: JoinRoomRequest) -> RoomResponse:
    room, seat, token = await store.join(code, (payload.token or "").strip())
    if room is None:
        return _response(None, error="房间不存在或已过期。")
    if not seat:
        return _response(room, error="房间已满。")
    await _broadcast(room)
    return _response(room, seat=seat, token=token)


@router.websocket("/api/v1/gomoku/rooms/{code}/ws")
async def room_socket(websocket: WebSocket, code: str, token: str = "") -> None:
    room = await store.get(code)
    seat = room.seat_for(token) if room else ""
    if room is None or not seat:
        await websocket.accept()
        await websocket.send_json(
            {
                "type": "error",
                "status": "error",
                "error_message": "无法进入房间，请检查链接或房间码。",
            }
        )
        await websocket.close()
        return

    await websocket.accept()
    room.sockets.add(websocket)
    room.touch()
    await _broadcast(room)

    try:
        while True:
            message = await websocket.receive_json()
            room.touch()
            kind = message.get("type") if isinstance(message, dict) else ""
            if kind == "move":
                async with store._lock:
                    error = _apply_move(room, seat, message)
                if error:
                    await websocket.send_json(
                        {"type": "error", "status": "error", "error_message": error}
                    )
                    continue
                await _broadcast(room)
            elif kind == "restart":
                async with store._lock:
                    room.moves = []
                await _broadcast(room)
            else:
                await websocket.send_json(
                    {
                        "type": "error",
                        "status": "error",
                        "error_message": "无法识别的消息。",
                    }
                )
    except WebSocketDisconnect:
        pass
    finally:
        room.sockets.discard(websocket)


def _apply_move(room: Room, seat: str, message: dict) -> str:
    if not room.white_token:
        return "对方还没加入。"
    state = room.snapshot()
    if state["game_over"]:
        return "对局已经结束。"
    if state["turn"] != seat:
        return "还没轮到你走。"
    try:
        row = int(message.get("row"))
        col = int(message.get("col"))
    except (TypeError, ValueError):
        return "落点无效。"
    if not (0 <= row < BOARD_SIZE and 0 <= col < BOARD_SIZE):
        return "落点越界。"
    if any(move["row"] == row and move["col"] == col for move in room.moves):
        return "这里已经有子了。"
    room.moves.append({"row": row, "col": col, "player": seat})
    return ""
