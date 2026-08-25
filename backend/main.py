import io
import json
import os
import re
import subprocess
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Literal

import chess
import chess.pgn
import httpx
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

try:
    from .rapfi import get_rapfi_engine
except ImportError:
    from rapfi import get_rapfi_engine

ROOT_DIR = Path(__file__).resolve().parent.parent
load_dotenv(ROOT_DIR / ".env")

MINIMAX_API_KEY = os.getenv("MINIMAX_API_KEY", "")
MINIMAX_API_BASE = os.getenv("MINIMAX_API_BASE", "https://api.minimax.chat/v1")
CHESS_API_URL = os.getenv("CHESS_API_URL", "https://chess-api.com/v1")
CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    ).split(",")
    if origin.strip()
]

SAMPLE_PATH = Path(__file__).resolve().parent / "sample_game.json"
with SAMPLE_PATH.open(encoding="utf-8") as sample_file:
    SAMPLE_GAME = json.load(sample_file)

MAX_PLIES = 80
CHESS_TIMEOUT = 5.0
LLM_TIMEOUT = 20.0
CHESS_WORKERS = 4
PLAY_DEPTH = 6
GOMOKU_BOARD_SIZE = 15
GOMOKU_SEARCH_MS = 800
BEGINNER_MISTAKE_PERCENT = 20
GOMOKU_DIFFICULTY_STRENGTH = {
    "beginner": 20,
    "easy": 20,
    "normal": 60,
    "hard": 100,
}

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class AnalyzeRequest(BaseModel):
    pgn: str


class AnalyzeResponse(BaseModel):
    status: str
    error_message: str
    degraded: bool
    fen: str
    move_number: int
    side: str
    user_san: str
    user_uci: str
    from_square: str
    to_square: str
    engine_san: str
    engine_uci: str
    eval_before: float
    eval_after: float
    eval_drop: float
    mistake: str
    plan: str
    cue: str


class PlyRecord(BaseModel):
    move_number: int
    side: str
    user_san: str
    user_uci: str
    from_square: str
    to_square: str
    fen_before: str
    fen_after: str


def empty_error(message: str) -> AnalyzeResponse:
    return AnalyzeResponse(
        status="error",
        error_message=message,
        degraded=False,
        fen="",
        move_number=0,
        side="",
        user_san="",
        user_uci="",
        from_square="",
        to_square="",
        engine_san="",
        engine_uci="",
        eval_before=0,
        eval_after=0,
        eval_drop=0,
        mistake="",
        plan="",
        cue="",
    )


def sample_board_payload() -> dict:
    keys = (
        "fen",
        "move_number",
        "side",
        "user_san",
        "user_uci",
        "from_square",
        "to_square",
        "engine_san",
        "engine_uci",
        "eval_before",
        "eval_after",
        "eval_drop",
        "mistake",
        "plan",
        "cue",
    )
    return {key: SAMPLE_GAME[key] for key in keys}


def parse_pgn(pgn: str) -> list[PlyRecord] | None:
    game = chess.pgn.read_game(io.StringIO(pgn))
    if game is None:
        return None
    if getattr(game, "errors", None):
        return None

    board = game.board()
    plies: list[PlyRecord] = []
    try:
        for move in game.mainline_moves():
            if not board.is_legal(move):
                return None
            side = "white" if board.turn == chess.WHITE else "black"
            record = PlyRecord(
                move_number=board.fullmove_number,
                side=side,
                user_san=board.san(move),
                user_uci=move.uci(),
                from_square=chess.square_name(move.from_square),
                to_square=chess.square_name(move.to_square),
                fen_before=board.fen(),
                fen_after="",
            )
            board.push(move)
            record.fen_after = board.fen()
            plies.append(record)
    except (ValueError, chess.IllegalMoveError, chess.InvalidMoveError):
        return None

    if not plies:
        return None
    return plies


def parse_eval(value) -> float | None:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value).strip().replace("+", "")
    try:
        return float(text)
    except ValueError:
        return None


def call_chess_api(fen: str, depth: int | None = None) -> dict:
    response = httpx.post(
        CHESS_API_URL,
        json={
            "fen": fen,
            "depth": PLAY_DEPTH if depth is None else depth,
            "maxThinkingTime": 50,
            "variants": 1,
        },
        timeout=CHESS_TIMEOUT,
        headers={"Content-Type": "application/json"},
    )
    if response.status_code == 429:
        raise RuntimeError("chess api 429")
    response.raise_for_status()
    try:
        payload = response.json()
    except json.JSONDecodeError as exc:
        raise RuntimeError("chess api non-json") from exc
    if not isinstance(payload, dict):
        raise RuntimeError("chess api non-json")
    return payload


def eval_drop_for_side(side: str, eval_before: float, eval_after: float) -> float:
    if side == "white":
        return eval_before - eval_after
    return eval_after - eval_before


def analyze_plies(plies: list[PlyRecord]) -> dict:
    evals: dict[str, float] = {}
    engine_by_fen: dict[str, tuple[str, str]] = {}

    unique_fens: list[str] = []
    for ply in plies:
        for fen in (ply.fen_before, ply.fen_after):
            if fen not in unique_fens:
                unique_fens.append(fen)

    def fetch_one(fen: str) -> tuple[str, float, str, str]:
        payload = call_chess_api(fen, depth=8)
        score = parse_eval(payload.get("eval"))
        if score is None:
            raise RuntimeError("chess api missing eval")
        move_uci = str(payload.get("move") or payload.get("lan") or "")
        move_san = str(payload.get("san") or "")
        return fen, score, move_san, move_uci

    pool = ThreadPoolExecutor(max_workers=CHESS_WORKERS)
    futures = [pool.submit(fetch_one, fen) for fen in unique_fens]
    try:
        for fut in as_completed(futures):
            fen, score, move_san, move_uci = fut.result()
            evals[fen] = score
            engine_by_fen[fen] = (move_san, move_uci)
    finally:
        pool.shutdown(wait=False, cancel_futures=True)

    worst: dict | None = None
    worst_drop = float("-inf")
    for ply in plies:
        eval_before = evals[ply.fen_before]
        eval_after = evals[ply.fen_after]
        drop = eval_drop_for_side(ply.side, eval_before, eval_after)
        if drop > worst_drop:
            worst_drop = drop
            engine_san, engine_uci = engine_by_fen.get(ply.fen_before, ("", ""))
            worst = {
                "fen": ply.fen_after,
                "move_number": ply.move_number,
                "side": ply.side,
                "user_san": ply.user_san,
                "user_uci": ply.user_uci,
                "from_square": ply.from_square,
                "to_square": ply.to_square,
                "engine_san": engine_san,
                "engine_uci": engine_uci,
                "eval_before": eval_before,
                "eval_after": eval_after,
                "eval_drop": drop,
            }
    if worst is None:
        raise RuntimeError("no ply")
    return worst


def extract_json_object(text: str) -> dict | None:
    cleaned = text.strip()
    fence = re.search(r"```(?:json)?\s*([\s\S]*?)```", cleaned)
    if fence:
        cleaned = fence.group(1).strip()
    try:
        payload = json.loads(cleaned)
        if isinstance(payload, dict):
            return payload
    except json.JSONDecodeError:
        pass
    match = re.search(r"\{[\s\S]*\}", cleaned)
    if not match:
        return None
    try:
        payload = json.loads(match.group(0))
    except json.JSONDecodeError:
        return None
    return payload if isinstance(payload, dict) else None


def minimax_url() -> str:
    base = MINIMAX_API_BASE.rstrip("/")
    if base.endswith("/chat/completions") or base.endswith("/text/chatcompletion_v2"):
        return base
    return f"{base}/chat/completions"


def call_minimax(board: dict) -> dict | None:
    if not MINIMAX_API_KEY:
        return None
    prompt = (
        "只返回一个 JSON 对象，键必须且只能是 mistake、plan、cue，值都是中文短句。"
        "禁止 Markdown，禁止代码块，禁止发明着法或评估数字。"
        f"\n局面FEN：{board['fen']}"
        f"\n走棋方：{board['side']}"
        f"\n用户着法：{board['user_san']}（{board['user_uci']}）"
        f"\n引擎该走：{board['engine_san']}（{board['engine_uci']}）"
        f"\n评估从 {board['eval_before']} 到 {board['eval_after']}，掉分 {board['eval_drop']}"
    )
    body = {
        "model": os.getenv("MINIMAX_MODEL", "MiniMax-Text-01"),
        "messages": [
            {
                "role": "system",
                "content": "你是国际象棋复盘讲解员。棋力已由引擎给出，你只把因果写成三句中文。",
            },
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.3,
    }
    try:
        response = httpx.post(
            minimax_url(),
            json=body,
            timeout=LLM_TIMEOUT,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {MINIMAX_API_KEY}",
            },
        )
        response.raise_for_status()
        payload = response.json()
    except (httpx.HTTPError, json.JSONDecodeError, ValueError):
        return None

    content = ""
    if isinstance(payload, dict):
        choices = payload.get("choices") or []
        if choices:
            message = choices[0].get("message") or {}
            content = message.get("content") or choices[0].get("text") or ""
        if not content:
            content = payload.get("reply") or payload.get("content") or ""
        if not content:
            base_resp = payload.get("base_resp") or {}
            if base_resp.get("status_code") not in (None, 0):
                return None

    parsed = extract_json_object(str(content))
    if not parsed:
        return None
    mistake = parsed.get("mistake")
    plan = parsed.get("plan")
    cue = parsed.get("cue")
    if not isinstance(mistake, str) or not isinstance(plan, str) or not isinstance(cue, str):
        return None
    if not mistake.strip() or not plan.strip() or not cue.strip():
        return None
    return {"mistake": mistake, "plan": plan, "cue": cue}


def with_coaching(board: dict, degraded: bool) -> AnalyzeResponse:
    coaching = call_minimax(board)
    if coaching is None:
        coaching = {
            "mistake": SAMPLE_GAME["mistake"],
            "plan": SAMPLE_GAME["plan"],
            "cue": SAMPLE_GAME["cue"],
        }
    return AnalyzeResponse(
        status="success",
        error_message="",
        degraded=degraded,
        fen=board["fen"],
        move_number=int(board["move_number"]),
        side=board["side"],
        user_san=board["user_san"],
        user_uci=board["user_uci"],
        from_square=board["from_square"],
        to_square=board["to_square"],
        engine_san=board["engine_san"],
        engine_uci=board["engine_uci"],
        eval_before=float(board["eval_before"]),
        eval_after=float(board["eval_after"]),
        eval_drop=float(board["eval_drop"]),
        mistake=coaching["mistake"],
        plan=coaching["plan"],
        cue=coaching["cue"],
    )


@app.get("/health")
def health():
    return {"status": "Backend is Ready"}


@app.post("/api/v1/analyze", response_model=AnalyzeResponse)
def analyze(payload: AnalyzeRequest) -> AnalyzeResponse:
    if not payload.pgn or not payload.pgn.strip():
        return empty_error("请粘贴一段棋谱再分析。")

    plies = parse_pgn(payload.pgn)
    if plies is None:
        return empty_error("这段 PGN 非法，无法拆谱。")

    if len(plies) > MAX_PLIES:
        return empty_error("先截到败着附近再贴")

    try:
        board = analyze_plies(plies)
        degraded = False
    except (httpx.HTTPError, httpx.RequestError, RuntimeError, KeyError, TypeError, ValueError):
        board = sample_board_payload()
        degraded = True

    return with_coaching(board, degraded=degraded)


class PlayRequest(BaseModel):
    fen: str = ""
    uci: str = ""


class PlayResponse(BaseModel):
    status: str
    error_message: str
    fen: str
    turn: str
    legal_uci: list[str]
    user_san: str
    user_uci: str
    engine_san: str
    engine_uci: str
    from_square: str
    to_square: str
    eval: float
    game_over: bool
    result: str


def legal_uci_list(board: chess.Board) -> list[str]:
    return [move.uci() for move in board.legal_moves]


def parse_user_uci(board: chess.Board, uci: str) -> chess.Move | None:
    raw = uci.strip().lower()
    candidates = [raw]
    if len(raw) == 4:
        candidates.append(raw + "q")
    for candidate in candidates:
        try:
            move = chess.Move.from_uci(candidate)
        except ValueError:
            continue
        if move in board.legal_moves:
            return move
    return None


def parse_engine_move(board: chess.Board, payload: dict) -> chess.Move | None:
    uci = str(payload.get("move") or payload.get("lan") or "").strip()
    if uci:
        try:
            move = chess.Move.from_uci(uci)
            if move in board.legal_moves:
                return move
        except ValueError:
            pass
    san = payload.get("san")
    if san:
        try:
            move = board.parse_san(str(san))
            if move in board.legal_moves:
                return move
        except ValueError:
            pass
    return None


def play_state(
    board: chess.Board,
    *,
    error: str = "",
    user_san: str = "",
    user_uci: str = "",
    engine_san: str = "",
    engine_uci: str = "",
    from_square: str = "",
    to_square: str = "",
    eval_score: float = 0,
) -> PlayResponse:
    game_over = board.is_game_over(claim_draw=True)
    return PlayResponse(
        status="error" if error else "success",
        error_message=error,
        fen=board.fen(),
        turn="white" if board.turn == chess.WHITE else "black",
        legal_uci=legal_uci_list(board),
        user_san=user_san,
        user_uci=user_uci,
        engine_san=engine_san,
        engine_uci=engine_uci,
        from_square=from_square,
        to_square=to_square,
        eval=float(eval_score),
        game_over=game_over,
        result=board.result(claim_draw=True) if game_over else "",
    )


def apply_engine_move(board: chess.Board) -> tuple[str, str, str, str, float]:
    payload = call_chess_api(board.fen())
    score = parse_eval(payload.get("eval")) or 0.0
    move = parse_engine_move(board, payload)
    if move is None:
        legal = list(board.legal_moves)
        if not legal:
            raise RuntimeError("engine no move")
        move = legal[0]
    engine_san = board.san(move)
    engine_uci = move.uci()
    from_square = chess.square_name(move.from_square)
    to_square = chess.square_name(move.to_square)
    board.push(move)
    return engine_san, engine_uci, from_square, to_square, score


@app.post("/api/v1/play", response_model=PlayResponse)
def play(payload: PlayRequest) -> PlayResponse:
    fen = (payload.fen or "").strip() or chess.STARTING_FEN
    try:
        board = chess.Board(fen)
    except ValueError:
        return play_state(chess.Board(), error="局面无效。")

    user_san = ""
    user_uci = ""
    engine_san = ""
    engine_uci = ""
    from_square = ""
    to_square = ""
    eval_score = 0.0

    uci = (payload.uci or "").strip()
    if uci:
        if board.turn != chess.WHITE:
            return play_state(board, error="还没轮到你走。")
        move = parse_user_uci(board, uci)
        if move is None:
            return play_state(board, error="这步不合法。")
        user_san = board.san(move)
        user_uci = move.uci()
        from_square = chess.square_name(move.from_square)
        to_square = chess.square_name(move.to_square)
        board.push(move)
        if board.is_game_over(claim_draw=True):
            return play_state(
                board,
                user_san=user_san,
                user_uci=user_uci,
                from_square=from_square,
                to_square=to_square,
            )

    if board.turn == chess.BLACK and not board.is_game_over(claim_draw=True):
        try:
            engine_san, engine_uci, from_square, to_square, eval_score = apply_engine_move(board)
        except (httpx.HTTPError, httpx.RequestError, RuntimeError, KeyError, TypeError, ValueError):
            return play_state(
                board,
                error="下棋引擎暂时不可用，点「让电脑走」再试。",
                user_san=user_san,
                user_uci=user_uci,
            )

    return play_state(
        board,
        user_san=user_san,
        user_uci=user_uci,
        engine_san=engine_san,
        engine_uci=engine_uci,
        from_square=from_square,
        to_square=to_square,
        eval_score=eval_score,
    )


class GomokuMove(BaseModel):
    row: int = Field(ge=0, lt=GOMOKU_BOARD_SIZE)
    col: int = Field(ge=0, lt=GOMOKU_BOARD_SIZE)
    player: Literal["black", "white"]


class GomokuPlayRequest(BaseModel):
    moves: list[GomokuMove] = Field(default_factory=list, max_length=225)
    difficulty: Literal["beginner", "easy", "normal", "hard"] = "normal"


class GomokuPlayResponse(BaseModel):
    status: Literal["success", "error"]
    error_message: str
    moves: list[GomokuMove]
    turn: Literal["black", "white", ""]
    user_move: GomokuMove | None
    engine_move: GomokuMove | None
    game_over: bool
    result: Literal["black", "white", "draw", ""]


def gomoku_winner(moves: list[GomokuMove]) -> str:
    occupied = {(move.row, move.col): move.player for move in moves}
    for move in moves:
        for row_step, col_step in ((1, 0), (0, 1), (1, 1), (1, -1)):
            count = 1
            for direction in (-1, 1):
                row = move.row + row_step * direction
                col = move.col + col_step * direction
                while occupied.get((row, col)) == move.player:
                    count += 1
                    row += row_step * direction
                    col += col_step * direction
            if count >= 5:
                return move.player
    return ""


def gomoku_history_seed(moves: list[GomokuMove]) -> int:
    return sum(
        (index + 1)
        * (
            (move.row + 1) * 31
            + (move.col + 1) * 17
            + (1 if move.player == "black" else 2)
        )
        for index, move in enumerate(moves)
    )


def beginner_gomoku_move(
    moves: list[GomokuMove],
    rapfi_row: int,
    rapfi_col: int,
) -> tuple[int, int]:
    if gomoku_history_seed(moves) % 100 >= BEGINNER_MISTAKE_PERCENT:
        return rapfi_row, rapfi_col

    occupied = {(move.row, move.col) for move in moves}
    legal_points = [
        (row, col)
        for row in range(GOMOKU_BOARD_SIZE)
        for col in range(GOMOKU_BOARD_SIZE)
        if (row, col) not in occupied
    ]
    immediate_wins = [
        point
        for point in legal_points
        if gomoku_winner(
            [
                *moves,
                GomokuMove(row=point[0], col=point[1], player="white"),
            ]
        )
        == "white"
    ]
    if immediate_wins:
        return sorted(immediate_wins)[0]

    candidates: set[tuple[int, int]] = set()
    for move in moves:
        for row_delta in range(-2, 3):
            for col_delta in range(-2, 3):
                row = move.row + row_delta
                col = move.col + col_delta
                if (
                    0 <= row < GOMOKU_BOARD_SIZE
                    and 0 <= col < GOMOKU_BOARD_SIZE
                    and (row, col) not in occupied
                ):
                    candidates.add((row, col))

    if not candidates:
        candidates = set(legal_points)

    def weakness_key(point: tuple[int, int]) -> tuple[int, int, int, int]:
        row, col = point
        adjacent = sum(
            (row + row_delta, col + col_delta) in occupied
            for row_delta in (-1, 0, 1)
            for col_delta in (-1, 0, 1)
            if row_delta or col_delta
        )
        center_distance = abs(row - 7) + abs(col - 7)
        return adjacent, -center_distance, row, col

    ordered = sorted(candidates, key=weakness_key)
    weaker_pool = ordered[: max(1, len(ordered) // 3)]
    stable_seed = gomoku_history_seed(moves)
    return weaker_pool[stable_seed % len(weaker_pool)]


def validate_gomoku_moves(moves: list[GomokuMove]) -> str:
    occupied: set[tuple[int, int]] = set()
    for index, move in enumerate(moves):
        expected = "black" if index % 2 == 0 else "white"
        if move.player != expected:
            return f"第 {index + 1} 手颜色顺序不正确。"
        point = (move.row, move.col)
        if point in occupied:
            return f"第 {index + 1} 手落在已有棋子的位置。"
        occupied.add(point)
        if index < len(moves) - 1 and gomoku_winner(moves[: index + 1]):
            return "棋局结束后不能继续落子。"
    return ""


def gomoku_response(
    moves: list[GomokuMove],
    *,
    error: str = "",
    user_move: GomokuMove | None = None,
    engine_move: GomokuMove | None = None,
) -> GomokuPlayResponse:
    winner = gomoku_winner(moves)
    full = len(moves) == GOMOKU_BOARD_SIZE * GOMOKU_BOARD_SIZE
    game_over = bool(winner) or full
    result = winner or ("draw" if full else "")
    turn = "" if game_over else ("black" if len(moves) % 2 == 0 else "white")
    return GomokuPlayResponse(
        status="error" if error else "success",
        error_message=error,
        moves=moves,
        turn=turn,
        user_move=user_move,
        engine_move=engine_move,
        game_over=game_over,
        result=result,
    )


@app.post("/api/v1/gomoku/play", response_model=GomokuPlayResponse)
def gomoku_play(payload: GomokuPlayRequest) -> GomokuPlayResponse:
    moves = list(payload.moves)
    validation_error = validate_gomoku_moves(moves)
    if validation_error:
        return gomoku_response(moves, error=validation_error)

    if gomoku_winner(moves) or len(moves) == GOMOKU_BOARD_SIZE**2:
        return gomoku_response(moves)

    if not moves or len(moves) % 2 == 0:
        return gomoku_response(moves)

    user_move = moves[-1]
    try:
        row, col = get_rapfi_engine().best_move(
            [
                {"row": move.row, "col": move.col, "player": move.player}
                for move in moves
            ],
            timeout_ms=GOMOKU_SEARCH_MS,
            strength_level=GOMOKU_DIFFICULTY_STRENGTH[payload.difficulty],
        )
    except (OSError, RuntimeError, subprocess.SubprocessError) as exc:
        return gomoku_response(
            moves,
            error=f"五子棋引擎暂时不可用：{exc}",
            user_move=user_move,
        )

    if not (0 <= row < GOMOKU_BOARD_SIZE and 0 <= col < GOMOKU_BOARD_SIZE):
        return gomoku_response(
            moves,
            error="五子棋引擎返回了越界坐标，请重试。",
            user_move=user_move,
        )
    if any(move.row == row and move.col == col for move in moves):
        return gomoku_response(
            moves,
            error="五子棋引擎返回了已有棋子的位置，请重试。",
            user_move=user_move,
        )

    if payload.difficulty == "beginner":
        row, col = beginner_gomoku_move(moves, row, col)

    engine_move = GomokuMove(row=row, col=col, player="white")
    moves.append(engine_move)
    return gomoku_response(
        moves,
        user_move=user_move,
        engine_move=engine_move,
    )
