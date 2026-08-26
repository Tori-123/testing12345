"""Minimal Xiangqi rules matching Pikafish FEN / UCI coordinates."""

from __future__ import annotations

FILES = "abcdefghi"
RANKS = "0123456789"
START_FEN = "rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1"

RED_PALACE = {(f, r) for f in range(3, 6) for r in range(0, 3)}
BLACK_PALACE = {(f, r) for f in range(3, 6) for r in range(7, 10)}


def square_name(file: int, rank: int) -> str:
    return f"{FILES[file]}{RANKS[rank]}"


def parse_square(text: str) -> tuple[int, int] | None:
    raw = text.strip().lower()
    if len(raw) != 2:
        return None
    file = FILES.find(raw[0])
    rank = RANKS.find(raw[1])
    if file < 0 or rank < 0:
        return None
    return file, rank


def parse_uci(text: str) -> tuple[tuple[int, int], tuple[int, int]] | None:
    raw = text.strip().lower()
    if len(raw) != 4:
        return None
    start = parse_square(raw[:2])
    end = parse_square(raw[2:])
    if start is None or end is None:
        return None
    return start, end


def is_red(piece: str) -> bool:
    return piece.isupper()


def is_black(piece: str) -> bool:
    return piece.islower()


def same_side(a: str, b: str) -> bool:
    return (is_red(a) and is_red(b)) or (is_black(a) and is_black(b))


class Board:
    def __init__(self, fen: str | None = None):
        self.grid: list[list[str | None]] = [[None] * 9 for _ in range(10)]
        self.turn = "w"
        self.halfmove = 0
        self.fullmove = 1
        self.set_fen(fen or START_FEN)

    def copy(self) -> Board:
        clone = Board.__new__(Board)
        clone.grid = [row[:] for row in self.grid]
        clone.turn = self.turn
        clone.halfmove = self.halfmove
        clone.fullmove = self.fullmove
        return clone

    def piece_at(self, file: int, rank: int) -> str | None:
        return self.grid[rank][file]

    def set_piece(self, file: int, rank: int, piece: str | None) -> None:
        self.grid[rank][file] = piece

    def set_fen(self, fen: str) -> None:
        parts = fen.strip().split()
        if len(parts) < 1:
            raise ValueError("empty fen")
        rows = parts[0].split("/")
        if len(rows) != 10:
            raise ValueError("fen ranks")
        grid: list[list[str | None]] = [[None] * 9 for _ in range(10)]
        for fen_index, row in enumerate(rows):
            rank = 9 - fen_index
            file = 0
            for char in row:
                if char.isdigit():
                    file += int(char)
                    if file > 9:
                        raise ValueError("fen files")
                    continue
                if char not in "KkAaBbNnRrCcPp":
                    raise ValueError("fen piece")
                if file >= 9:
                    raise ValueError("fen files")
                grid[rank][file] = char
                file += 1
            if file != 9:
                raise ValueError("fen files")
        self.grid = grid
        self.turn = parts[1] if len(parts) > 1 else "w"
        if self.turn not in {"w", "b"}:
            raise ValueError("fen turn")
        self.halfmove = int(parts[4]) if len(parts) > 4 else 0
        self.fullmove = int(parts[5]) if len(parts) > 5 else 1

    def fen(self) -> str:
        ranks: list[str] = []
        for fen_index in range(10):
            rank = 9 - fen_index
            empty = 0
            cells: list[str] = []
            for file in range(9):
                piece = self.grid[rank][file]
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
        return f"{'/'.join(ranks)} {self.turn} - - {self.halfmove} {self.fullmove}"

    def find_king(self, red: bool) -> tuple[int, int] | None:
        target = "K" if red else "k"
        for rank in range(10):
            for file in range(9):
                if self.grid[rank][file] == target:
                    return file, rank
        return None

    def _path_clear(self, file1: int, rank1: int, file2: int, rank2: int) -> bool:
        if file1 == file2:
            step = 1 if rank2 > rank1 else -1
            for rank in range(rank1 + step, rank2, step):
                if self.grid[rank][file1] is not None:
                    return False
            return True
        if rank1 == rank2:
            step = 1 if file2 > file1 else -1
            for file in range(file1 + step, file2, step):
                if self.grid[rank1][file] is not None:
                    return False
            return True
        return False

    def _generates_pseudo(
        self,
        file: int,
        rank: int,
        piece: str,
    ) -> list[tuple[int, int]]:
        targets: list[tuple[int, int]] = []
        kind = piece.upper()
        red = is_red(piece)

        def add(tf: int, tr: int) -> None:
            if not (0 <= tf < 9 and 0 <= tr < 10):
                return
            dest = self.grid[tr][tf]
            if dest is not None and same_side(piece, dest):
                return
            targets.append((tf, tr))

        if kind == "K":
            palace = RED_PALACE if red else BLACK_PALACE
            for df, dr in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                tf, tr = file + df, rank + dr
                if (tf, tr) in palace:
                    add(tf, tr)
            # Flying general capture
            enemy = self.find_king(not red)
            if enemy and enemy[0] == file and self._path_clear(file, rank, enemy[0], enemy[1]):
                add(enemy[0], enemy[1])
            return targets

        if kind == "A":
            palace = RED_PALACE if red else BLACK_PALACE
            for df, dr in ((1, 1), (1, -1), (-1, 1), (-1, -1)):
                tf, tr = file + df, rank + dr
                if (tf, tr) in palace:
                    add(tf, tr)
            return targets

        if kind == "B":
            for df, dr in ((2, 2), (2, -2), (-2, 2), (-2, -2)):
                tf, tr = file + df, rank + dr
                eye_f, eye_r = file + df // 2, rank + dr // 2
                if not (0 <= tf < 9 and 0 <= tr < 10):
                    continue
                if red and tr > 4:
                    continue
                if not red and tr < 5:
                    continue
                if self.grid[eye_r][eye_f] is not None:
                    continue
                add(tf, tr)
            return targets

        if kind == "N":
            for df, dr, block_f, block_r in (
                (1, 2, 0, 1),
                (-1, 2, 0, 1),
                (1, -2, 0, -1),
                (-1, -2, 0, -1),
                (2, 1, 1, 0),
                (2, -1, 1, 0),
                (-2, 1, -1, 0),
                (-2, -1, -1, 0),
            ):
                bf, br = file + block_f, rank + block_r
                if not (0 <= bf < 9 and 0 <= br < 10):
                    continue
                if self.grid[br][bf] is not None:
                    continue
                add(file + df, rank + dr)
            return targets

        if kind == "R":
            for df, dr in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                tf, tr = file + df, rank + dr
                while 0 <= tf < 9 and 0 <= tr < 10:
                    dest = self.grid[tr][tf]
                    if dest is None:
                        targets.append((tf, tr))
                    else:
                        if not same_side(piece, dest):
                            targets.append((tf, tr))
                        break
                    tf += df
                    tr += dr
            return targets

        if kind == "C":
            for df, dr in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                jumped = False
                tf, tr = file + df, rank + dr
                while 0 <= tf < 9 and 0 <= tr < 10:
                    dest = self.grid[tr][tf]
                    if not jumped:
                        if dest is None:
                            targets.append((tf, tr))
                        else:
                            jumped = True
                    else:
                        if dest is not None:
                            if not same_side(piece, dest):
                                targets.append((tf, tr))
                            break
                    tf += df
                    tr += dr
            return targets

        if kind == "P":
            forward = 1 if red else -1
            add(file, rank + forward)
            crossed = (red and rank >= 5) or ((not red) and rank <= 4)
            if crossed:
                add(file - 1, rank)
                add(file + 1, rank)
            return targets

        return targets

    def is_in_check(self, red: bool) -> bool:
        king = self.find_king(red)
        if king is None:
            return True
        kf, kr = king
        for rank in range(10):
            for file in range(9):
                piece = self.grid[rank][file]
                if piece is None:
                    continue
                if is_red(piece) == red:
                    continue
                for tf, tr in self._generates_pseudo(file, rank, piece):
                    if tf == kf and tr == kr:
                        return True
        return False

    def generate_legal_moves(self) -> list[str]:
        red_to_move = self.turn == "w"
        moves: list[str] = []
        for rank in range(10):
            for file in range(9):
                piece = self.grid[rank][file]
                if piece is None:
                    continue
                if is_red(piece) != red_to_move:
                    continue
                for tf, tr in self._generates_pseudo(file, rank, piece):
                    uci = square_name(file, rank) + square_name(tf, tr)
                    trial = self.copy()
                    trial._push_unchecked(file, rank, tf, tr)
                    if not trial.is_in_check(red_to_move):
                        moves.append(uci)
        return moves

    def _push_unchecked(self, sf: int, sr: int, tf: int, tr: int) -> None:
        piece = self.grid[sr][sf]
        captured = self.grid[tr][tf]
        self.grid[sr][sf] = None
        self.grid[tr][tf] = piece
        if (piece and piece.upper() == "P") or captured is not None:
            self.halfmove = 0
        else:
            self.halfmove += 1
        if self.turn == "b":
            self.fullmove += 1
        self.turn = "b" if self.turn == "w" else "w"

    def is_legal(self, uci: str) -> bool:
        return uci.strip().lower() in self.generate_legal_moves()

    def push_uci(self, uci: str) -> None:
        parsed = parse_uci(uci)
        if parsed is None:
            raise ValueError("bad uci")
        (sf, sr), (tf, tr) = parsed
        legal = self.generate_legal_moves()
        key = square_name(sf, sr) + square_name(tf, tr)
        if key not in legal:
            raise ValueError("illegal")
        self._push_unchecked(sf, sr, tf, tr)

    def game_over(self) -> bool:
        return len(self.generate_legal_moves()) == 0

    def result(self) -> str:
        if not self.game_over():
            return ""
        # Side to move cannot move: loses (checkmate or 困毙).
        return "0-1" if self.turn == "w" else "1-0"

    def san_like(self, uci: str) -> str:
        """Compact Chinese-board style label: piece + destination."""
        parsed = parse_uci(uci)
        if parsed is None:
            return uci
        (sf, sr), (tf, tr) = parsed
        piece = self.piece_at(sf, sr) or "?"
        names = {
            "K": "帅",
            "k": "将",
            "A": "仕",
            "a": "士",
            "B": "相",
            "b": "象",
            "N": "马",
            "n": "马",
            "R": "车",
            "r": "车",
            "C": "炮",
            "c": "炮",
            "P": "兵",
            "p": "卒",
        }
        return f"{names.get(piece, piece)}{square_name(tf, tr)}"
