import { useEffect, useRef, useState } from "react";
import ChessBoard from "./ChessBoard.jsx";
import {
  FORCE_ERROR_MOCK,
  MOCK_ERROR,
  MOCK_SUCCESS,
  SAMPLE_PGN,
} from "./mockAnalyze.js";

function formatEval(n) {
  if (n > 0) return `+${n}`;
  return String(n);
}

function sideLabel(side) {
  if (side === "white") return "白";
  if (side === "black") return "黑";
  return "";
}

function BrandStrip({ degraded }) {
  return (
    <header className="flex h-[8%] min-h-[3rem] shrink-0 items-center justify-between px-4">
      <span className="text-lg font-semibold tracking-tight">PlyHan</span>
      <div className="flex max-w-[70%] flex-col items-end gap-1">
        {degraded === true ? (
          <span className="text-xs text-red-600">已用示例局面</span>
        ) : null}
        <p className="text-right text-sm text-neutral-500">
          对着红条发呆的那五分钟，把棋谱扔进来。
        </p>
      </div>
    </header>
  );
}

function PgnTextarea({ pgn, setPgn, readOnly }) {
  const ref = useRef(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  return (
    <textarea
      ref={ref}
      value={pgn}
      readOnly={readOnly}
      onChange={(e) => setPgn(e.target.value)}
      placeholder="把 PGN 贴进来"
      className="h-20 w-full resize-none overflow-y-auto rounded-none border border-neutral-800 bg-neutral-900 px-3 py-2 font-mono text-sm text-neutral-100 outline-none placeholder:text-neutral-600 focus:border-red-600"
    />
  );
}

function SampleLink({ onLoad }) {
  return (
    <button
      type="button"
      onClick={onLoad}
      className="text-sm text-neutral-400 underline underline-offset-2"
    >
      载入示例
    </button>
  );
}

function SubmitButton({ disabled, loading }) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className="rounded-none bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
    >
      {loading ? "正在找败着" : "复盘这一手"}
    </button>
  );
}

function ErrorLine({ message }) {
  if (!message) return null;
  return <p className="text-sm text-red-600">{message}</p>;
}

function InputStrip({
  pgn,
  setPgn,
  view,
  errorMessage,
  onSample,
  onSubmit,
}) {
  const loading = view === "loading";
  const empty = pgn.trim() === "";

  return (
    <form
      className="shrink-0 space-y-2 px-4 pb-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <PgnTextarea pgn={pgn} setPgn={setPgn} readOnly={loading} />
      <div className="flex items-center justify-between gap-3">
        <SampleLink onLoad={onSample} />
        <SubmitButton disabled={empty || loading} loading={loading} />
      </div>
      <ErrorLine message={errorMessage} />
    </form>
  );
}

function RedBar() {
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setNarrow(true), 30);
    return () => clearTimeout(id);
  }, []);

  return (
    <div
      className={`h-1 bg-red-600 transition-all duration-1000 ${
        narrow ? "w-1/12" : "w-full"
      }`}
    />
  );
}

function LoadingStrip() {
  return (
    <div className="flex flex-1 flex-col justify-center px-4">
      <RedBar />
      <p className="mt-4 text-sm text-neutral-500">正在找掉分最大的一手</p>
    </div>
  );
}

function PlyCaption({ move_number, side }) {
  return (
    <p className="text-sm text-neutral-500">
      第 {move_number} 手 · {sideLabel(side)}
    </p>
  );
}

function EvalRow({ eval_before, eval_after, eval_drop }) {
  return (
    <div className="flex items-baseline gap-3 font-mono text-sm">
      <span className="text-neutral-500 line-through">
        {formatEval(eval_before)}
      </span>
      <span className="text-neutral-500">→</span>
      <span className="text-red-600">{formatEval(eval_after)}</span>
      <span className="text-neutral-500">掉 {eval_drop}</span>
    </div>
  );
}

function MovePair({ user_san, user_uci, engine_san, engine_uci }) {
  return (
    <div className="mt-3 flex items-baseline gap-6">
      <span title={user_uci} className="text-6xl font-bold leading-none">
        {user_san}
      </span>
      <span title={engine_uci} className="text-xl font-medium text-neutral-500">
        该走 {engine_san}
      </span>
    </div>
  );
}

function TalkBlock({ label, body }) {
  return (
    <section className="space-y-2">
      <h2 className="text-xs font-semibold tracking-wide text-neutral-500">
        {label}
      </h2>
      <p className="text-sm leading-relaxed text-neutral-900">{body}</p>
    </section>
  );
}

function TalkCard({ mistake, plan, cue }) {
  return (
    <aside className="min-h-0 flex-1 overflow-y-auto rounded-none bg-white p-6 text-neutral-900 shadow-sm">
      <div className="space-y-8">
        <TalkBlock label="错在哪" body={mistake} />
        <TalkBlock label="当时该怎样" body={plan} />
        <TalkBlock label="下次先看什么" body={cue} />
      </div>
    </aside>
  );
}

function ResultStage({ data }) {
  return (
    <div className="flex min-h-0 flex-1 gap-4 px-4 pb-4">
      <div className="flex min-h-0 w-[46%] flex-col">
        <PlyCaption move_number={data.move_number} side={data.side} />
        <EvalRow
          eval_before={data.eval_before}
          eval_after={data.eval_after}
          eval_drop={data.eval_drop}
        />
        <div className="mt-3 min-h-0 flex-1">
          <ChessBoard
            fen={data.fen}
            from_square={data.from_square}
            to_square={data.to_square}
          />
        </div>
        <MovePair
          user_san={data.user_san}
          user_uci={data.user_uci}
          engine_san={data.engine_san}
          engine_uci={data.engine_uci}
        />
      </div>
      <TalkCard mistake={data.mistake} plan={data.plan} cue={data.cue} />
    </div>
  );
}

function SingleScreenWorkspace() {
  const [view, setView] = useState("idle");
  const [pgn, setPgn] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const timerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const errorMessage =
    analysis?.status === "error" ? analysis.error_message : "";
  const showResult = view === "result" && analysis?.status === "success";

  function handleSample() {
    setPgn(SAMPLE_PGN);
  }

  function handleSubmit() {
    if (!pgn.trim() || view === "loading") return;
    setAnalysis(null);
    setView("loading");

    const submitted = pgn.trim();
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const useError = FORCE_ERROR_MOCK || submitted.toLowerCase() === "error";
      if (useError) {
        setAnalysis(MOCK_ERROR);
        setView("idle");
        return;
      }
      setAnalysis(MOCK_SUCCESS);
      setView("result");
    }, 1000);
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-neutral-950 font-sans text-neutral-100">
      <BrandStrip degraded={showResult ? analysis.degraded : false} />
      <InputStrip
        pgn={pgn}
        setPgn={setPgn}
        view={view}
        errorMessage={view === "loading" ? "" : errorMessage}
        onSample={handleSample}
        onSubmit={handleSubmit}
      />
      {view === "loading" ? <LoadingStrip /> : null}
      {showResult ? <ResultStage data={analysis} /> : null}
    </div>
  );
}

export default function App() {
  return <SingleScreenWorkspace />;
}
