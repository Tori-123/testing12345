try:
    from .board_rooms import build_board_room_router
except ImportError:
    from board_rooms import build_board_room_router

try:
    from .draughts import START_FEN, Board
except ImportError:
    from draughts import START_FEN, Board


class DraughtsRules:
    game = "draughts"
    first = "black"
    second = "white"
    start_fen = START_FEN

    def turn(self, fen: str) -> str:
        board = Board(fen)
        return "black" if board.turn == "b" else "white"

    def legal_uci(self, fen: str) -> list[str]:
        return Board(fen).generate_legal_moves()

    def play(self, fen: str, uci: str) -> tuple[str, str, str]:
        board = Board(fen)
        raw = (uci or "").strip().lower()
        if not board.is_legal(raw):
            return fen, "", "这步不合法。"
        san = board.san_like(raw)
        board.push_uci(raw)
        return board.fen(), san, ""

    def outcome(self, fen: str) -> tuple[bool, str, str]:
        board = Board(fen)
        if not board.game_over():
            return False, "", ""
        return True, board.result(), "mate"

    def move_squares(self, uci: str) -> tuple[str, str]:
        raw = (uci or "").strip().lower()
        if len(raw) < 4:
            return "", ""
        return raw[:2], raw[-2:]


router = build_board_room_router(DraughtsRules())
