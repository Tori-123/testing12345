import { useEffect, useState } from "react";

export const START_FEN = "1b1b1b1b/b1b1b1b1/1b1b1b1b/8/8/w1w1w1w1/1w1w1w1w/w1w1w1w1 b";

export function hopsFromUci(uci) {
  const hops = [];
  const raw = uci || "";
  for (let index = 0; index + 2 <= raw.length; index += 2) {
    hops.push(raw.slice(index, index + 2));
  }
  return hops;
}

export function capturedSquares(uci) {
  const hops = hopsFromUci(uci);
  const caps = [];
  for (let index = 0; index < hops.length - 1; index += 1) {
    const from = hops[index];
    const to = hops[index + 1];
    const df = to.charCodeAt(0) - from.charCodeAt(0);
    const dr = Number(to[1]) - Number(from[1]);
    if (Math.abs(df) === 2 && Math.abs(dr) === 2) {
      const file = String.fromCharCode((from.charCodeAt(0) + to.charCodeAt(0)) / 2);
      const rank = String((Number(from[1]) + Number(to[1])) / 2);
      caps.push(`${file}${rank}`);
    }
  }
  return caps;
}

function isDark(square) {
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]);
  return (file + rank) % 2 === 1;
}

function squareBox(square) {
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]);
  return {
    left: `${file * 12.5}%`,
    top: `${(8 - rank) * 12.5}%`,
  };
}

function squareName(file, rank) {
  return `${String.fromCharCode(97 + file)}${rank}`;
}

export function squaresFromFen(fen) {
  const placement = (fen || "").split(" ")[0];
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
          squares.push({ name: squareName(fileIndex, rank), code: "" });
          fileIndex += 1;
        }
      } else {
        squares.push({ name: squareName(fileIndex, rank), code: ch });
        fileIndex += 1;
      }
    }
    while (fileIndex < 8) {
      squares.push({ name: squareName(fileIndex, rank), code: "" });
      fileIndex += 1;
    }
  }
  return squares;
}

function boardMapFromFen(fen) {
  const map = {};
  for (const sq of squaresFromFen(fen)) map[sq.name] = sq.code;
  return map;
}

function fenFromBoardMap(map, turn) {
  const ranks = [];
  for (let rank = 8; rank >= 1; rank -= 1) {
    let empty = 0;
    let row = "";
    for (let fileIndex = 0; fileIndex < 8; fileIndex += 1) {
      const code = map[squareName(fileIndex, rank)] || "";
      if (!code) {
        empty += 1;
      } else {
        if (empty) {
          row += String(empty);
          empty = 0;
        }
        row += code;
      }
    }
    if (empty) row += String(empty);
    ranks.push(row);
  }
  return `${ranks.join("/")} ${turn}`;
}

export function pieceAtFen(fen, square) {
  return squaresFromFen(fen).find((sq) => sq.name === square)?.code || "";
}

export function applyUciToFen(fen, uci) {
  const hops = hopsFromUci(uci);
  if (hops.length < 2) return fen;
  const rest = (fen || "").split(" ").slice(1);
  const turn = rest[0] === "w" ? "b" : "w";
  const map = boardMapFromFen(fen);
  const start = hops[0];
  let piece = map[start] || "";
  map[start] = "";
  for (const square of capturedSquares(uci)) map[square] = "";
  const end = hops[hops.length - 1];
  if (piece === "w" && end[1] === "8") piece = "W";
  if (piece === "b" && end[1] === "1") piece = "B";
  map[end] = piece;
  return fenFromBoardMap(map, turn);
}

function ManGlyph({ code, flying = false }) {
  if (!code) return null;
  const white = code === "w" || code === "W";
  const king = code === "W" || code === "B";
  return (
    <span
      className={`relative flex h-[72%] w-[72%] items-center justify-center rounded-full ${
        flying ? "draughts-man-fly" : ""
      } ${
        white
          ? "bg-[#f4efe6] shadow-[inset_-2px_-2px_4px_rgba(0,0,0,0.18),0_2px_3px_rgba(0,0,0,0.28)]"
          : "bg-neutral-950 shadow-[inset_-2px_-2px_4px_rgba(255,255,255,0.14),0_2px_3px_rgba(0,0,0,0.4)]"
      }`}
      aria-hidden="true"
    >
      {king ? (
        <span
          className={`h-[42%] w-[42%] rounded-full border-2 ${
            white ? "border-neutral-800" : "border-neutral-200"
          }`}
        />
      ) : null}
    </span>
  );
}

function FlyingMan({ hops, code, duration, flipped = false, onDone }) {
  const [index, setIndex] = useState(0);
  const [pos, setPos] = useState(squareBox(hops[0]));
  const [moving, setMoving] = useState(false);

  useEffect(() => {
    setIndex(0);
    setMoving(false);
    setPos(squareBox(hops[0]));
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setMoving(true);
        setPos(squareBox(hops[1] || hops[0]));
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [hops, code, duration]);

  useEffect(() => {
    if (!moving) return undefined;
    const timer = window.setTimeout(() => {
      const next = index + 1;
      if (next >= hops.length - 1) {
        onDone?.();
        return;
      }
      setIndex(next);
      setMoving(false);
      setPos(squareBox(hops[next]));
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setMoving(true);
          setPos(squareBox(hops[next + 1]));
        });
      });
    }, duration);
    return () => window.clearTimeout(timer);
  }, [moving, index, hops, duration, onDone]);

  return (
    <div
      className="pointer-events-none absolute z-10 flex h-[12.5%] w-[12.5%] items-center justify-center"
      style={{
        left: pos.left,
        top: pos.top,
        transition: moving
          ? `left ${duration}ms ease-in-out, top ${duration}ms ease-in-out`
          : "none",
      }}
    >
      <span
        className="flex h-full w-full items-center justify-center"
        style={flipped ? { transform: "rotate(180deg)" } : undefined}
      >
        <ManGlyph code={code} flying />
      </span>
    </div>
  );
}

export default function DraughtsBoard({
  fen,
  from_square,
  to_square,
  selected,
  targets = [],
  captureFrom = [],
  hiddenSquares = [],
  fadingSquares = [],
  flight = null,
  onSquareClick,
  disabled = false,
  flipped = false,
}) {
  const squares = squaresFromFen(fen);
  const clickable = typeof onSquareClick === "function" && !disabled;
  const hidden = new Set(hiddenSquares);
  const fading = new Set(fadingSquares);
  const jumpers = new Set(captureFrom);

  return (
    <div className="board-slot">
      <div
        className="board-fit-square grid grid-cols-8 grid-rows-8"
        aria-label="跳棋棋盘"
        style={flipped ? { transform: "rotate(180deg)" } : undefined}
      >
        {squares.map((sq) => {
          const lastMove = sq.name === from_square || sq.name === to_square;
          const isSelected = sq.name === selected;
          const isTarget = targets.includes(sq.name);
          const canJump = jumpers.has(sq.name);
          return (
            <button
              key={sq.name}
              type="button"
              data-square={sq.name}
              disabled={!clickable}
              onClick={() => onSquareClick?.(sq.name)}
              className={`relative flex touch-manipulation items-center justify-center ${
                isDark(sq.name) ? "bg-[#7a4b28]" : "bg-[#e8c992]"
              } ${lastMove || isSelected || canJump ? "ring-2 ring-inset ring-red-600" : ""} ${
                isTarget ? "bg-red-600/35" : ""
              } ${clickable ? "cursor-pointer" : "cursor-default"}`}
            >
              {hidden.has(sq.name) ? null : (
                <span
                  className={`flex h-full w-full items-center justify-center ${
                    fading.has(sq.name) ? "draughts-captured" : ""
                  }`}
                  style={flipped ? { transform: "rotate(180deg)" } : undefined}
                >
                  <ManGlyph code={sq.code} />
                </span>
              )}
              {isTarget && !sq.code ? (
                <span className="absolute h-[22%] w-[22%] max-h-3 max-w-3 min-h-[0.4rem] min-w-[0.4rem] rounded-full bg-red-600" />
              ) : null}
            </button>
          );
        })}
        {flight ? (
          <FlyingMan
            key={flight.uci}
            hops={flight.hops}
            code={flight.code}
            duration={flight.duration}
            flipped={flipped}
            onDone={flight.onDone}
          />
        ) : null}
      </div>
    </div>
  );
}
