const FILES = "abcdefghi";
const RANKS = "9876543210"; // display top (black) to bottom (red)

export const XIANGQI_START_FEN =
  "rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1";

const PIECE_LABEL = {
  K: "帅",
  A: "仕",
  B: "相",
  N: "马",
  R: "车",
  C: "炮",
  P: "兵",
  k: "将",
  a: "士",
  b: "象",
  n: "马",
  r: "车",
  c: "炮",
  p: "卒",
};

function parseBoard(fen) {
  const placement = (fen || XIANGQI_START_FEN).split(" ")[0];
  const rows = placement.split("/");
  const board = Array.from({ length: 10 }, () => Array(9).fill(null));
  rows.forEach((row, fenIndex) => {
    const rank = 9 - fenIndex;
    let file = 0;
    for (const char of row) {
      if (char >= "1" && char <= "9") {
        file += Number(char);
        continue;
      }
      board[rank][file] = char;
      file += 1;
    }
  });
  return board;
}

function squareFromCoords(file, rank) {
  return `${FILES[file]}${rank}`;
}

export default function XiangqiBoard({
  fen,
  selected,
  legalTargets,
  lastMove,
  animating,
  disabled,
  onSquareClick,
  flipped = false,
}) {
  const board = parseBoard(fen);
  const targetSet = new Set(legalTargets || []);
  const lastFrom = lastMove?.from || "";
  const lastTo = lastMove?.to || "";

  return (
    <div className="board-slot">
      <div
        className="board-fit-xiangqi"
        style={{
          background:
            "radial-gradient(circle at 30% 20%, #f3e0c2 0%, #d7b07a 55%, #b8894d 100%)",
          transform: flipped ? "rotate(180deg)" : undefined,
        }}
      >
        <svg
          viewBox="0 0 900 1000"
          className="absolute inset-0 h-full w-full"
          aria-hidden="true"
        >
          <rect
            x="50"
            y="50"
            width="800"
            height="900"
            fill="none"
            stroke="#5c3418"
            strokeWidth="4"
          />
          {Array.from({ length: 10 }, (_, rankIndex) => {
            const y = 50 + rankIndex * 100;
            return (
              <line
                key={`h-${rankIndex}`}
                x1="50"
                y1={y}
                x2="850"
                y2={y}
                stroke="#5c3418"
                strokeWidth="2"
              />
            );
          })}
          {Array.from({ length: 9 }, (_, fileIndex) => {
            const x = 50 + fileIndex * 100;
            return (
              <g key={`v-${fileIndex}`}>
                <line
                  x1={x}
                  y1="50"
                  x2={x}
                  y2="450"
                  stroke="#5c3418"
                  strokeWidth="2"
                />
                <line
                  x1={x}
                  y1="550"
                  x2={x}
                  y2="950"
                  stroke="#5c3418"
                  strokeWidth="2"
                />
              </g>
            );
          })}
          <line x1="50" y1="450" x2="50" y2="550" stroke="#5c3418" strokeWidth="2" />
          <line x1="850" y1="450" x2="850" y2="550" stroke="#5c3418" strokeWidth="2" />
          <line x1="350" y1="50" x2="550" y2="250" stroke="#5c3418" strokeWidth="2" />
          <line x1="550" y1="50" x2="350" y2="250" stroke="#5c3418" strokeWidth="2" />
          <line x1="350" y1="750" x2="550" y2="950" stroke="#5c3418" strokeWidth="2" />
          <line x1="550" y1="750" x2="350" y2="950" stroke="#5c3418" strokeWidth="2" />
          <text
            x="450"
            y="515"
            textAnchor="middle"
            fontSize="36"
            fill="#7a4a22"
            opacity="0.55"
            transform={flipped ? "rotate(180 450 515)" : undefined}
          >
            楚河  汉界
          </text>
        </svg>

        <div className="absolute inset-0 grid grid-cols-9 grid-rows-10">
          {RANKS.split("").map((rankChar) =>
            FILES.split("").map((fileChar) => {
              const square = `${fileChar}${rankChar}`;
              const rank = Number(rankChar);
              const file = FILES.indexOf(fileChar);
              const piece = board[rank][file];
              const isSelected = selected === square;
              const isTarget = targetSet.has(square);
              const isLast = square === lastFrom || square === lastTo;
              const isRed = piece && piece === piece.toUpperCase();
              const animateHere =
                animating &&
                animating.to === square &&
                piece &&
                piece === piece.toLowerCase();

              return (
                <button
                  key={square}
                  type="button"
                  disabled={disabled}
                  onClick={() => onSquareClick?.(square)}
                  className={`relative flex touch-manipulation items-center justify-center outline-none ${
                    disabled ? "cursor-default" : "cursor-pointer"
                  }`}
                  aria-label={square}
                >
                  {isLast ? (
                    <span className="absolute inset-[18%] rounded-full bg-red-600/15" />
                  ) : null}
                  {isSelected ? (
                    <span className="absolute inset-[12%] rounded-full border-2 border-red-600" />
                  ) : null}
                  {isTarget ? (
                    <span className="absolute h-[22%] w-[22%] max-h-3 max-w-3 min-h-[0.4rem] min-w-[0.4rem] rounded-full bg-red-600/70" />
                  ) : null}
                  {piece ? (
                    <span
                      className="relative z-10 flex h-[72%] w-[72%] items-center justify-center"
                      style={flipped ? { transform: "rotate(180deg)" } : undefined}
                    >
                      <span
                        className={`flex h-full w-full items-center justify-center rounded-full border-2 text-[clamp(0.65rem,8cqi,1.35rem)] font-bold shadow-sm ${
                          isRed
                            ? "border-red-700 bg-[#fff4e8] text-red-700"
                            : "border-neutral-800 bg-[#f7f2ea] text-neutral-900"
                        } ${animateHere ? "xiangqi-ai-drop" : ""}`}
                      >
                        {PIECE_LABEL[piece] || piece}
                      </span>
                    </span>
                  ) : null}
                </button>
              );
            }),
          )}
        </div>
      </div>
    </div>
  );
}

export function legalTargetsFor(selected, legalUci) {
  if (!selected) return [];
  return (legalUci || [])
    .filter((uci) => uci.startsWith(selected))
    .map((uci) => uci.slice(2));
}

export function pieceAtFen(fen, square) {
  const parsed = parseSquare(square);
  if (!parsed) return null;
  const board = parseBoard(fen);
  return board[parsed.rank][parsed.file];
}

function parseSquare(square) {
  if (!square || square.length !== 2) return null;
  const file = FILES.indexOf(square[0]);
  const rank = Number(square[1]);
  if (file < 0 || Number.isNaN(rank) || rank < 0 || rank > 9) return null;
  return { file, rank };
}

export function applyUciToFen(fen, uci) {
  const parts = (fen || XIANGQI_START_FEN).split(" ");
  const board = parseBoard(fen);
  const from = parseSquare(uci.slice(0, 2));
  const to = parseSquare(uci.slice(2, 4));
  if (!from || !to) return fen;
  const piece = board[from.rank][from.file];
  board[from.rank][from.file] = null;
  board[to.rank][to.file] = piece;
  const ranks = [];
  for (let fenIndex = 0; fenIndex < 10; fenIndex += 1) {
    const rank = 9 - fenIndex;
    let empty = 0;
    let row = "";
    for (let file = 0; file < 9; file += 1) {
      const cell = board[rank][file];
      if (!cell) {
        empty += 1;
        continue;
      }
      if (empty) {
        row += String(empty);
        empty = 0;
      }
      row += cell;
    }
    if (empty) row += String(empty);
    ranks.push(row);
  }
  const turn = parts[1] === "w" ? "b" : "w";
  const half = parts[4] || "0";
  const full = parts[5] || "1";
  return `${ranks.join("/")} ${turn} - - ${half} ${full}`;
}
