"""English / American draughts on an 8x8 board. Dark squares only. No flying kings."""

from __future__ import annotations

import time

FILES = "abcdefgh"
START_FEN = "1b1b1b1b/b1b1b1b1/1b1b1b1b/8/8/w1w1w1w1/1w1w1w1w/w1w1w1w1 b"
MAN_VALUE = 100
KING_VALUE = 180
MATE = 100000
INF = 10**9

WHITE_MAN_DIRS = ((-1, 1), (1, 1))
BLACK_MAN_DIRS = ((-1, -1), (1, -1))
KING_DIRS = ((-1, -1), (-1, 1), (1, -1), (1, 1))


def square_name(file: int, rank0: int) -> str:
    return f"{FILES[file]}{rank0 + 1}"


def parse_square(text: str) -> tuple[int, int] | None:
    raw = text.strip().lower()
    if len(raw) != 2 or raw[0] not in FILES or not raw[1].isdigit():
        return None
    file = FILES.find(raw[0])
    rank = int(raw[1])
    if file < 0 or rank < 1 or rank > 8:
        return None
    return file, rank - 1


def parse_uci(text: str) -> list[tuple[int, int]] | None:
    raw = text.strip().lower()
    if len(raw) < 4 or len(raw) % 2:
        return None
    squares: list[tuple[int, int]] = []
    for index in range(0, len(raw), 2):
        square = parse_square(raw[index : index + 2])
        if square is None:
            return None
        squares.append(square)
    return squares


def uci_from_path(path: list[tuple[int, int]]) -> str:
    return "".join(square_name(file, rank0) for file, rank0 in path)


def in_board(file: int, rank0: int) -> bool:
    return 0 <= file < 8 and 0 <= rank0 < 8


def is_dark(file: int, rank0: int) -> bool:
    return (file + rank0) % 2 == 0


def is_white(piece: str) -> bool:
    return piece in "wW"


def is_black(piece: str) -> bool:
    return piece in "bB"


def is_king(piece: str) -> bool:
    return piece in "WB"


def same_side(left: str, right: str) -> bool:
    return (is_white(left) and is_white(right)) or (is_black(left) and is_black(right))


def move_dirs(piece: str) -> tuple[tuple[int, int], ...]:
    if is_king(piece):
        return KING_DIRS
    return WHITE_MAN_DIRS if is_white(piece) else BLACK_MAN_DIRS


def promote(piece: str, rank0: int) -> str:
    if piece == "w" and rank0 == 7:
        return "W"
    if piece == "b" and rank0 == 0:
        return "B"
    return piece


class Board:
    def __init__(self, fen: str | None = None):
        self.grid: list[list[str | None]] = [[None] * 8 for _ in range(8)]
        self.turn = "b"
        self.set_fen(fen or START_FEN)

    def copy(self) -> Board:
        clone = Board.__new__(Board)
        clone.grid = [row[:] for row in self.grid]
        clone.turn = self.turn
        return clone

    def piece_at(self, file: int, rank0: int) -> str | None:
        return self.grid[rank0][file]

    def set_piece(self, file: int, rank0: int, piece: str | None) -> None:
        self.grid[rank0][file] = piece

    def set_fen(self, fen: str) -> None:
        parts = fen.strip().split()
        if not parts:
            raise ValueError("empty fen")
        rows = parts[0].split("/")
        if len(rows) != 8:
            raise ValueError("fen ranks")
        grid: list[list[str | None]] = [[None] * 8 for _ in range(8)]
        for fen_index, row in enumerate(rows):
            rank0 = 7 - fen_index
            file = 0
            for char in row:
                if char.isdigit():
                    file += int(char)
                    if file > 8:
                        raise ValueError("fen files")
                    continue
                if char not in "bBwW":
                    raise ValueError("fen piece")
                if file >= 8:
                    raise ValueError("fen files")
                if not is_dark(file, rank0):
                    raise ValueError("piece on light square")
                grid[rank0][file] = char
                file += 1
            if file != 8:
                raise ValueError("fen files")
        self.grid = grid
        self.turn = parts[1] if len(parts) > 1 else "b"
        if self.turn not in {"w", "b"}:
            raise ValueError("fen turn")

    def fen(self) -> str:
        ranks: list[str] = []
        for fen_index in range(8):
            rank0 = 7 - fen_index
            empty = 0
            cells: list[str] = []
            for file in range(8):
                piece = self.grid[rank0][file]
                if piece is None:
                    empty += 1
                    continue
                if empty:
                    cells.append(str(empty))
                    empty = 0
                cells.append(piece)
            if empty:
                cells.append(str(empty))
            ranks.append("".join(cells))
        return f"{'/'.join(ranks)} {self.turn}"

    def _pieces(self, white: bool) -> list[tuple[int, int, str]]:
        found: list[tuple[int, int, str]] = []
        for rank0 in range(8):
            for file in range(8):
                piece = self.grid[rank0][file]
                if piece and is_white(piece) == white:
                    found.append((file, rank0, piece))
        return found

    def _capture_sequences(
        self,
        file: int,
        rank0: int,
        piece: str,
        captured: set[tuple[int, int]],
        path: list[tuple[int, int]],
    ) -> list[list[tuple[int, int]]]:
        sequences: list[list[tuple[int, int]]] = []
        for df, dr in move_dirs(piece):
            mid_f, mid_r = file + df, rank0 + dr
            land_f, land_r = file + 2 * df, rank0 + 2 * dr
            if not in_board(land_f, land_r):
                continue
            mid = self.grid[mid_r][mid_f]
            if mid is None or same_side(mid, piece):
                continue
            if (mid_f, mid_r) in captured:
                continue
            if self.grid[land_r][land_f] is not None:
                continue
            next_piece = promote(piece, land_r)
            next_path = path + [(land_f, land_r)]
            if next_piece != piece:
                sequences.append(next_path)
                continue
            saved_from = self.grid[rank0][file]
            saved_mid = self.grid[mid_r][mid_f]
            saved_land = self.grid[land_r][land_f]
            self.grid[rank0][file] = None
            self.grid[mid_r][mid_f] = None
            self.grid[land_r][land_f] = next_piece
            further = self._capture_sequences(
                land_f,
                land_r,
                next_piece,
                captured | {(mid_f, mid_r)},
                next_path,
            )
            self.grid[rank0][file] = saved_from
            self.grid[mid_r][mid_f] = saved_mid
            self.grid[land_r][land_f] = saved_land
            if further:
                sequences.extend(further)
            else:
                sequences.append(next_path)
        return sequences

    def generate_legal_moves(self) -> list[str]:
        white = self.turn == "w"
        captures: list[str] = []
        quiet: list[str] = []
        for file, rank0, piece in self._pieces(white):
            sequences = self._capture_sequences(file, rank0, piece, set(), [(file, rank0)])
            for path in sequences:
                captures.append(uci_from_path(path))
            if captures:
                continue
            for df, dr in move_dirs(piece):
                dest_f, dest_r = file + df, rank0 + dr
                if not in_board(dest_f, dest_r):
                    continue
                if self.grid[dest_r][dest_f] is not None:
                    continue
                if not is_dark(dest_f, dest_r):
                    continue
                quiet.append(uci_from_path([(file, rank0), (dest_f, dest_r)]))
        if captures:
            return sorted(set(captures))
        return sorted(set(quiet))

    def is_legal(self, uci: str) -> bool:
        return uci.strip().lower() in self.generate_legal_moves()

    def push_uci(self, uci: str) -> None:
        path = parse_uci(uci)
        if path is None or len(path) < 2:
            raise ValueError("bad uci")
        start_f, start_r = path[0]
        piece = self.grid[start_r][start_f]
        if piece is None:
            raise ValueError("empty start")
        self.grid[start_r][start_f] = None
        for index in range(len(path) - 1):
            a_f, a_r = path[index]
            b_f, b_r = path[index + 1]
            if abs(b_f - a_f) == 2 and abs(b_r - a_r) == 2:
                mid_f = (a_f + b_f) // 2
                mid_r = (a_r + b_r) // 2
                self.grid[mid_r][mid_f] = None
        end_f, end_r = path[-1]
        self.grid[end_r][end_f] = promote(piece, end_r)
        if self.turn == "b":
            self.turn = "w"
        else:
            self.turn = "b"

    def game_over(self) -> bool:
        return not self.generate_legal_moves()

    def result(self) -> str:
        if not self.game_over():
            return ""
        return "white" if self.turn == "b" else "black"

    def san_like(self, uci: str) -> str:
        path = parse_uci(uci)
        if path is None:
            return uci
        names = [square_name(file, rank0) for file, rank0 in path]
        capture = any(
            abs(path[index + 1][0] - path[index][0]) == 2
            for index in range(len(path) - 1)
        )
        joiner = "x" if capture else "-"
        return joiner.join(names)


def evaluate(board: Board) -> int:
    score = 0
    for rank0 in range(8):
        for file in range(8):
            piece = board.grid[rank0][file]
            if piece is None:
                continue
            value = KING_VALUE if is_king(piece) else MAN_VALUE
            if piece in "wW":
                if piece == "w":
                    value += rank0 * 4
                score -= value
            else:
                if piece == "b":
                    value += (7 - rank0) * 4
                score += value
    return score if board.turn == "b" else -score


def _negamax(
    board: Board,
    depth: int,
    alpha: int,
    beta: int,
    ply: int,
    table: dict[str, tuple[int, int]],
) -> int:
    key = board.fen()
    cached = table.get(key)
    if cached and cached[0] >= depth:
        return cached[1]
    moves = board.generate_legal_moves()
    if not moves:
        score = -MATE + ply
        table[key] = (99, score)
        return score
    if depth <= 0:
        score = evaluate(board)
        table[key] = (0, score)
        return score
    moves.sort(key=len, reverse=True)
    best = -INF
    for uci in moves:
        child = board.copy()
        child.push_uci(uci)
        value = -_negamax(child, depth - 1, -beta, -alpha, ply + 1, table)
        if value > best:
            best = value
        if best > alpha:
            alpha = best
        if alpha >= beta:
            break
    table[key] = (depth, best)
    return best


def immediate_win(board: Board) -> str:
    for uci in board.generate_legal_moves():
        child = board.copy()
        child.push_uci(uci)
        if child.game_over():
            return uci
    return ""


def best_move(board: Board, depth: int, max_ms: float | None = 1.6) -> str:
    win = immediate_win(board)
    if win:
        return win
    moves = board.generate_legal_moves()
    if not moves:
        return ""
    moves.sort(key=len, reverse=True)
    best_uci = moves[0]
    started = time.monotonic()
    table: dict[str, tuple[int, int]] = {}
    for current_depth in range(1, max(1, depth) + 1):
        if max_ms is not None and time.monotonic() - started > max_ms:
            break
        alpha = -INF
        depth_best = best_uci
        depth_score = -INF
        for uci in moves:
            if max_ms is not None and time.monotonic() - started > max_ms:
                break
            child = board.copy()
            child.push_uci(uci)
            score = -_negamax(child, current_depth - 1, -INF, -alpha, 1, table)
            if score > depth_score:
                depth_score = score
                depth_best = uci
            if score > alpha:
                alpha = score
        else:
            best_uci = depth_best
            moves = [best_uci] + [uci for uci in moves if uci != best_uci]
    return best_uci


def scored_moves(board: Board, depth: int) -> list[tuple[int, str]]:
    table: dict[str, tuple[int, int]] = {}
    ranked: list[tuple[int, str]] = []
    for uci in board.generate_legal_moves():
        child = board.copy()
        child.push_uci(uci)
        if child.game_over():
            score = MATE
        else:
            score = -_negamax(child, max(0, min(depth, 2) - 1), -INF, INF, 1, table)
        ranked.append((score, uci))
    ranked.sort(key=lambda item: (-item[0], item[1]))
    return ranked
