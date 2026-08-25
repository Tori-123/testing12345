import io
import json
import os
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import chess
import chess.pgn
import httpx
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

ROOT_DIR = Path(__file__).resolve().parent.parent
load_dotenv(ROOT_DIR / ".env")

MINIMAX_API_KEY = os.getenv("MINIMAX_API_KEY", "")
MINIMAX_API_BASE = os.getenv("MINIMAX_API_BASE", "https://api.minimax.chat/v1")
CHESS_API_URL = os.getenv("CHESS_API_URL", "https://chess-api.com/v1")

SAMPLE_PATH = Path(__file__).resolve().parent / "sample_game.json"
with SAMPLE_PATH.open(encoding="utf-8") as sample_file:
    SAMPLE_GAME = json.load(sample_file)

MAX_PLIES = 80
CHESS_TIMEOUT = 5.0
LLM_TIMEOUT = 20.0
CHESS_WORKERS = 4
PLAY_DEPTH = 6

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
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
