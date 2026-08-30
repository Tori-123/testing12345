try:
    from .board_rooms import build_board_room_router
except ImportError:
    from board_rooms import build_board_room_router

try:
    from .xiangqi import START_FEN, Board
except ImportError:
    from xiangqi import START_FEN, Board


class XiangqiRules:
    game = "xiangqi"
    first = "red"
    second = "black"
    start_fen = START_FEN

    def turn(self, fen: str) -> str:
        board = Board(fen)
        return "red" if board.turn == "w" else "black"

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
        result = board.result()
        if result == "1-0":
            return True, "red", "mate"
        if result == "0-1":
            return True, "black", "mate"
        return True, "", "mate"


router = build_board_room_router(XiangqiRules())
