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

export default function GomokuBoard({
  moves,
  disabled,
  onPointClick,
}) {
  const occupied = new Map(
    moves.map((move) => [`${move.row}:${move.col}`, move.player]),
  );
  const lastMove = moves[moves.length - 1];

  return (
    <div
      className="relative aspect-square max-h-full w-full overflow-hidden bg-[#d9a45f]"
      aria-label="十五乘十五五子棋棋盘"
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

      <div className="absolute inset-0 grid grid-cols-[repeat(15,minmax(0,1fr))] grid-rows-[repeat(15,minmax(0,1fr))]">
        {Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, index) => {
          const row = Math.floor(index / BOARD_SIZE);
          const col = index % BOARD_SIZE;
          const player = occupied.get(`${row}:${col}`);
          const isLast =
            lastMove?.row === row && lastMove?.col === col;
          return (
            <button
              key={`${row}:${col}`}
              type="button"
              aria-label={`${pointName(row, col)}${
                player ? ` ${player === "black" ? "黑子" : "白子"}` : " 空位"
              }`}
              disabled={disabled || Boolean(player)}
              onClick={() => onPointClick(row, col)}
              className="group relative flex items-center justify-center disabled:cursor-default"
            >
              {player ? (
                <span
                  className={`relative block h-[82%] w-[82%] rounded-full border ${
                    player === "black"
                      ? "border-black bg-neutral-950 shadow-[inset_-2px_-2px_4px_rgba(255,255,255,0.12),0_2px_3px_rgba(0,0,0,0.35)]"
                      : "border-neutral-300 bg-neutral-50 shadow-[inset_-2px_-2px_4px_rgba(0,0,0,0.12),0_2px_3px_rgba(0,0,0,0.25)]"
                  } ${
                    isLast && player === "white" ? "gomoku-ai-drop" : ""
                  }`}
                >
                  {isLast ? (
                    <span className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-600" />
                  ) : null}
                </span>
              ) : (
                <span className="h-2.5 w-2.5 rounded-full bg-red-600 opacity-0 transition-opacity group-hover:opacity-60" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
