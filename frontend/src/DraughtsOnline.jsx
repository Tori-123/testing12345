import { useMemo, useState } from "react";
import BoardOnline from "./BoardOnline.jsx";
import DraughtsBoard, {
  START_FEN,
  applyUciToFen,
  pieceAtFen,
} from "./DraughtsBoard.jsx";

function resultCopy(result, seat, endReason) {
  if (endReason === "resign") {
    if (result === seat) return "对方认输。你赢了。";
    return "你认输了。";
  }
  if (endReason === "timeout") {
    if (result === seat) return "对方超时。你赢了。";
    return "你超时了。";
  }
  if (result === seat) return "对方无子可走。你赢了。";
  return "对方赢了。";
}

function pairHistory(sans) {
  const rows = [];
  for (let i = 0; i < sans.length; i += 2) {
    rows.push({ n: i / 2 + 1, a: sans[i], b: sans[i + 1] || "" });
  }
  return rows;
}

function isCaptureUci(uci) {
  return uci.length > 4;
}

function nextSquares(legalUci, prefix) {
  const targets = new Set();
  for (const uci of legalUci) {
    if (!uci.startsWith(prefix) || uci.length <= prefix.length) continue;
    targets.add(uci.slice(prefix.length, prefix.length + 2));
  }
  return [...targets];
}

function DraughtsOnlineBoard({
  fen,
  legalUci,
  fromSquare,
  toSquare,
  myTurn,
  seat,
  flight,
  onMove,
}) {
  const [selected, setSelected] = useState("");
  const [path, setPath] = useState("");

  const prefix = path || selected;
  const targets = useMemo(
    () => (prefix ? nextSquares(legalUci, prefix) : []),
    [legalUci, prefix],
  );
  const captureFrom = useMemo(
    () => (myTurn ? (legalUci || []).filter(isCaptureUci).map((uci) => uci.slice(0, 2)) : []),
    [legalUci, myTurn],
  );

  function resetSelection() {
    setSelected("");
    setPath("");
  }

  function handleSquareClick(square) {
    if (!myTurn) return;
    const prefixNow = path || selected;
    if (prefixNow && targets.includes(square)) {
      const nextPath = `${prefixNow}${square}`;
      if (legalUci.includes(nextPath)) {
        onMove(nextPath, applyUciToFen(fen, nextPath));
        resetSelection();
        return;
      }
      setPath(nextPath);
      setSelected(nextPath.slice(0, 2));
      return;
    }
    if ((legalUci || []).some((uci) => uci.startsWith(square))) {
      setSelected(square);
      setPath(square);
      return;
    }
    resetSelection();
  }

  return (
    <DraughtsBoard
      fen={fen}
      from_square={fromSquare}
      to_square={toSquare}
      selected={path.length > 2 ? path.slice(-2) : selected}
      targets={targets}
      captureFrom={captureFrom}
      flight={flight}
      disabled={!myTurn}
      flipped={seat === "black"}
      onSquareClick={handleSquareClick}
    />
  );
}

export default function DraughtsOnline({
  initialCode,
  createSeat = "black",
  clockEnabled = true,
  onBack,
  onHome,
  onRoomCode,
}) {
  return (
    <BoardOnline
      game="draughts"
      initialCode={initialCode}
      createSeat={createSeat}
      clockEnabled={clockEnabled}
      firstSeat="black"
      secondSeat="white"
      startFen={START_FEN}
      storageKey="plyhan-draughts-seat"
      pairHistory={pairHistory}
      resultCopy={resultCopy}
      readPiece={pieceAtFen}
      slideMs={0}
      sloganFor={(seat) =>
        seat === "white"
          ? "你执白。把链接发给对方，对方执黑先走。"
          : "你执黑。把链接发给对方，对方执白。"
      }
      metaFor={(seat, bothReady, clockLimitMs) =>
        `8×8 英美跳棋 · 你执${seat === "white" ? "白" : "黑"}${
          bothReady ? " · 对方已加入" : " · 等待对方"
        }${
          bothReady
            ? clockLimitMs > 0
              ? ` · 每手 ${Math.round(clockLimitMs / 1000)} 秒`
              : " · 不限时"
            : ""
        }`
      }
      onBack={onBack}
      onHome={onHome}
      onRoomCode={onRoomCode}
      renderBoard={(props) => <DraughtsOnlineBoard {...props} />}
    />
  );
}
