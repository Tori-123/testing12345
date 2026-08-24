const UNICODE = {
  K: "♔",
  Q: "♕",
  R: "♖",
  B: "♗",
  N: "♘",
  P: "♙",
  k: "♚",
  q: "♛",
  r: "♜",
  b: "♝",
  n: "♞",
  p: "♟",
};

function squaresFromFen(fen) {
  const placement = (fen || "").split(" ")[0];
  if (!placement) return [];

  const ranks = placement.split("/");
  const squares = [];

  for (let rankIndex = 0; rankIndex < 8; rankIndex += 1) {
    const rank = 8 - rankIndex;
    const row = ranks[rankIndex] || "";
    let fileIndex = 0;
    for (const ch of row) {
      if (fileIndex >= 8) break;
      if (ch >= "1" && ch <= "8") {
        const empty = Number(ch);
        for (let i = 0; i < empty && fileIndex < 8; i += 1) {
          const file = String.fromCharCode(97 + fileIndex);
          squares.push({ name: `${file}${rank}`, piece: "" });
          fileIndex += 1;
        }
      } else {
        const file = String.fromCharCode(97 + fileIndex);
        squares.push({ name: `${file}${rank}`, piece: UNICODE[ch] || ch });
        fileIndex += 1;
      }
    }
    while (fileIndex < 8) {
      const file = String.fromCharCode(97 + fileIndex);
      squares.push({ name: `${file}${rank}`, piece: "" });
      fileIndex += 1;
    }
  }

  return squares;
}

function isDark(square) {
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]);
  return (file + rank) % 2 === 1;
}

export default function ChessBoard({ fen, from_square, to_square }) {
  const squares = squaresFromFen(fen);

  return (
    <div
      className="grid aspect-square w-full max-h-full grid-cols-8 grid-rows-8"
      aria-label="棋盘"
    >
      {squares.map((sq) => {
        const highlighted = sq.name === from_square || sq.name === to_square;
        return (
          <div
            key={sq.name}
            className={`flex items-center justify-center text-2xl leading-none ${
              isDark(sq.name) ? "bg-neutral-700" : "bg-neutral-300"
            } ${highlighted ? "ring-2 ring-inset ring-red-600" : ""}`}
          >
            {sq.piece}
          </div>
        );
      })}
    </div>
  );
}
