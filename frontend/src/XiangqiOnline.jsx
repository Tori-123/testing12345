import { useMemo, useState } from "react";
import BoardOnline from "./BoardOnline.jsx";
import XiangqiBoard, {
  XIANGQI_START_FEN,
  applyUciToFen,
  legalTargetsFor,
  pieceAtFen,
} from "./XiangqiBoard.jsx";

function resultCopy(result, seat, endReason) {
  if (endReason === "resign") {
    if (result === seat) return "对方认输。你赢了。";
    return "你认输了。";
  }
  if (endReason === "timeout") {
    if (result === seat) return "对方超时。你赢了。";
    return "你超时了。";
  }
  if (result === seat) return "将死。你赢了。";
  if (result === "red" || result === "black") return "将死。对方赢了。";
  return "对局结束。";
}

function pairHistory(sans) {
  const rows = [];
  for (let i = 0; i < sans.length; i += 2) {
    rows.push({ n: i / 2 + 1, a: sans[i], b: sans[i + 1] || "" });
  }
  return rows;
}

function XiangqiOnlineBoard({ fen, legalUci, fromSquare, toSquare, myTurn, seat, onMove }) {
  const [selected, setSelected] = useState("");
  const targets = useMemo(
    () => legalTargetsFor(selected, legalUci),
    [selected, legalUci],
  );

  function handleSquareClick(square) {
    if (!myTurn) return;
    if (selected && targets.includes(square)) {
      const uci = `${selected}${square}`;
      onMove(uci, applyUciToFen(fen, uci));
      setSelected("");
      return;
    }
    const piece = pieceAtFen(fen, square);
    const mine =
      piece &&
      (seat === "black" ? piece === piece.toLowerCase() : piece === piece.toUpperCase());
    if (mine && legalUci.some((move) => move.startsWith(square))) {
      setSelected(square);
      return;
    }
    setSelected("");
  }

  return (
    <XiangqiBoard
      fen={fen}
      selected={selected}
      legalTargets={targets}
      lastMove={
        fromSquare && toSquare ? { from: fromSquare, to: toSquare } : null
      }
      disabled={!myTurn}
      flipped={seat === "black"}
      onSquareClick={handleSquareClick}
    />
  );
}

export default function XiangqiOnline({
  initialCode,
  createSeat = "red",
  onBack,
  onHome,
  onRoomCode,
}) {
  return (
    <BoardOnline
      game="xiangqi"
      initialCode={initialCode}
      createSeat={createSeat}
      firstSeat="red"
      secondSeat="black"
      startFen={XIANGQI_START_FEN}
      storageKey="plyhan-xiangqi-seat"
      pairHistory={pairHistory}
      resultCopy={resultCopy}
      sloganFor={(seat) =>
        seat === "black"
          ? "你执黑。把链接发给对方，对方执红先走。"
          : "你执红。把链接发给对方，对方执黑。"
      }
      metaFor={(seat, bothReady, clockLimitMs) =>
        `9×10 · 你执${seat === "black" ? "黑" : "红"}${
          bothReady ? " · 对方已加入" : " · 等待对方"
        }${bothReady ? ` · 每手 ${Math.round(clockLimitMs / 1000)} 秒` : ""}`
      }
      onBack={onBack}
      onHome={onHome}
      onRoomCode={onRoomCode}
      renderBoard={(props) => <XiangqiOnlineBoard {...props} />}
    />
  );
}
