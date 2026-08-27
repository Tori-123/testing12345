import { useState } from "react";

const BOARD_SIZE = 15;
const STAR_POINTS = [
  [3, 3],
  [3, 11],
  [7, 7],
  [11, 3],
  [11, 11],
];

function pointName(row, col) {
  return `${String.fromCharCode(65 + col)}${row + 1}`;
}

function cellFromEvent(event) {
  const rect = event.currentTarget.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  const col = Math.floor(((event.clientX - rect.left) / rect.width) * BOARD_SIZE);
  const row = Math.floor(((event.clientY - rect.top) / rect.height) * BOARD_SIZE);
  if (row < 0 || col < 0 || row >= BOARD_SIZE || col >= BOARD_SIZE) return null;
  return { row, col };
}

export default function GomokuBoard({
  moves,
  disabled,
  onPointClick,
  animateLast = false,
}) {
  const [hover, setHover] = useState(null);
  const occupied = new Map(
    moves.map((move) => [`${move.row}:${move.col}`, move.player]),
  );
  const lastMove = moves[moves.length - 1];

  function handlePointerDown(event) {
    if (disabled) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const cell = cellFromEvent(event);
    if (!cell) return;
    if (occupied.has(`${cell.row}:${cell.col}`)) return;
    event.preventDefault();
    onPointClick(cell.row, cell.col);
  }

  function handlePointerMove(event) {
    if (disabled || event.pointerType !== "mouse") {
      if (hover) setHover(null);
      return;
    }
    const cell = cellFromEvent(event);
    if (!cell || occupied.has(`${cell.row}:${cell.col}`)) {
      if (hover) setHover(null);
      return;
    }
    if (hover?.row !== cell.row || hover?.col !== cell.col) setHover(cell);
  }

  return (
    <div className="board-slot">
      <div
        className={`board-fit-square overflow-hidden bg-[#d9a45f] touch-manipulation select-none ${
          disabled ? "cursor-default" : "cursor-pointer"
        }`}
        aria-label="十五乘十五五子棋棋盘"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerLeave={() => setHover(null)}
      >
      <svg
        viewBox="-0.5 -0.5 15 15"
        className="pointer-events-none absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        {Array.from({ length: BOARD_SIZE }, (_, index) => (
          <g key={index} stroke="#5b361d" strokeWidth="0.035">
            <line x1="0" y1={index} x2="14" y2={index} />
            <line x1={index} y1="0" x2={index} y2="14" />
          </g>
        ))}
        {STAR_POINTS.map(([row, col]) => (
          <circle
            key={`${row}:${col}`}
            cx={col}
            cy={row}
            r="0.1"
            fill="#5b361d"
          />
        ))}
      </svg>

      <div className="pointer-events-none absolute inset-0 grid grid-cols-[repeat(15,minmax(0,1fr))] grid-rows-[repeat(15,minmax(0,1fr))]">
        {Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, index) => {
          const row = Math.floor(index / BOARD_SIZE);
          const col = index % BOARD_SIZE;
          const player = occupied.get(`${row}:${col}`);
          const isLast =
            lastMove?.row === row && lastMove?.col === col;
          const isHover =
            !player && hover?.row === row && hover?.col === col;
          return (
            <div
              key={`${row}:${col}`}
              aria-hidden="true"
              className="relative flex items-center justify-center"
            >
              {player ? (
                <span
                  className={`relative block h-[82%] w-[82%] rounded-full border ${
                    player === "black"
                      ? "border-black bg-neutral-950 shadow-[inset_-2px_-2px_4px_rgba(255,255,255,0.12),0_2px_3px_rgba(0,0,0,0.35)]"
                      : "border-neutral-300 bg-neutral-50 shadow-[inset_-2px_-2px_4px_rgba(0,0,0,0.12),0_2px_3px_rgba(0,0,0,0.25)]"
                  } ${
                    isLast && animateLast ? "gomoku-ai-drop" : ""
                  }`}
                >
                  {isLast ? (
                    <span className="absolute left-1/2 top-1/2 h-[18%] w-[18%] max-h-1.5 max-w-1.5 min-h-[0.25rem] min-w-[0.25rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-600" />
                  ) : null}
                </span>
              ) : isHover ? (
                <span className="h-[18%] w-[18%] max-h-2.5 max-w-2.5 min-h-[0.35rem] min-w-[0.35rem] rounded-full bg-red-600 opacity-60" />
              ) : null}
            </div>
          );
        })}
      </div>
      <div className="sr-only">
        {moves.map((move) => (
          <span key={`${move.row}:${move.col}`}>
            {pointName(move.row, move.col)}
            {move.player === "black" ? " 黑子" : " 白子"}
          </span>
        ))}
      </div>
      </div>
    </div>
  );
}
