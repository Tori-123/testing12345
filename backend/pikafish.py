import atexit
import os
import platform
import queue
import re
import subprocess
import threading
import time
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent
DEFAULT_MOVETIME_MS = int(os.getenv("PIKAFISH_MOVETIME_MS", "400"))
READ_BUFFER_SECONDS = float(os.getenv("PIKAFISH_READ_BUFFER_SECONDS", "3"))
THREADS = int(os.getenv("PIKAFISH_THREADS", "1"))
HASH_MB = int(os.getenv("PIKAFISH_HASH", "16"))

MULTIPV_RE = re.compile(r"\bmultipv\s+(\d+)\b", re.IGNORECASE)
PV_RE = re.compile(r"\bpv\s+([a-i][0-9][a-i][0-9]\w*)", re.IGNORECASE)


def _binary_candidates() -> list[str]:
    system = platform.system()
    machine = platform.machine().lower()
    if system == "Darwin" and machine in {"arm64", "aarch64"}:
        return ["pikafish-apple-silicon"]
    if system == "Linux":
        if machine in {"arm64", "aarch64"}:
            return ["pikafish-armv8-dotprod", "pikafish-armv8"]
        return [
            "pikafish-sse41-popcnt",
            "pikafish-avx2",
            "pikafish-bmi2",
            "pikafish-avxvnni",
            "pikafish-avx512",
            "pikafish-vnni512",
            "pikafish-avx512icl",
        ]
    if system == "Windows":
        return [
            "pikafish-sse41-popcnt.exe",
            "pikafish-avx2.exe",
            "pikafish-bmi2.exe",
        ]
    return []


def find_pikafish_binary() -> Path:
    configured = os.getenv("PIKAFISH_BINARY", "").strip()
    if configured:
        path = Path(configured).expanduser().resolve()
        if path.is_file():
            return path
        raise RuntimeError(f"PIKAFISH_BINARY 指向的文件不存在：{path}")

    engine_dir = BACKEND_DIR / "Pikafish-engine"
    if not engine_dir.is_dir():
        raise RuntimeError("未安装 Pikafish，请先运行 python backend/setup_pikafish.py")

    files = {
        path.name: path
        for path in engine_dir.rglob("pikafish*")
        if path.is_file() and path.suffix.lower() != ".nnue"
    }
    for name in _binary_candidates():
        if name in files:
            return files[name]

    raise RuntimeError(
        f"没有适用于 {platform.system()} {platform.machine()} 的 Pikafish 可执行文件"
    )


def find_eval_file(binary: Path | None = None) -> Path:
    configured = os.getenv("PIKAFISH_EVAL_FILE", "").strip()
    if configured:
        path = Path(configured).expanduser().resolve()
        if path.is_file():
            return path
        raise RuntimeError(f"PIKAFISH_EVAL_FILE 指向的文件不存在：{path}")

    search_roots: list[Path] = []
    if binary is not None:
        search_roots.append(binary.parent)
    search_roots.append(BACKEND_DIR / "Pikafish-engine")
    search_roots.append(BACKEND_DIR)

    for root in search_roots:
        if not root.is_dir():
            continue
        direct = root / "pikafish.nnue"
        if direct.is_file():
            return direct
        matches = list(root.rglob("pikafish.nnue"))
        if matches:
            return matches[0]

    raise RuntimeError(
        "找不到 pikafish.nnue，请运行 python backend/setup_pikafish.py 或设置 PIKAFISH_EVAL_FILE"
    )


class PikafishEngine:
    def __init__(self, binary: Path | None = None, eval_file: Path | None = None):
        self.binary = binary or find_pikafish_binary()
        self.eval_file = eval_file or find_eval_file(self.binary)
        self.lock = threading.Lock()
        self.process: subprocess.Popen[str] | None = None
        self.output: queue.Queue[str] = queue.Queue()

    def _send(self, command: str) -> None:
        if self.process is None or self.process.stdin is None:
            raise RuntimeError("Pikafish 进程未启动")
        self.process.stdin.write(command + "\n")
        self.process.stdin.flush()

    def _read_line(self, timeout: float) -> str:
        if self.process is None:
            raise RuntimeError("Pikafish 进程未启动")
        try:
            line = self.output.get(timeout=timeout)
        except queue.Empty as exc:
            if self.process.poll() is not None:
                raise RuntimeError("Pikafish 进程意外退出") from exc
            raise RuntimeError("Pikafish 思考超时") from exc
        return line

    def _collect_output(self, process: subprocess.Popen[str]) -> None:
        if process.stdout is None:
            return
        for line in process.stdout:
            self.output.put(line.rstrip("\n"))

    def _expect(self, token: str, timeout: float = 10.0) -> None:
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            line = self._read_line(max(0.05, deadline - time.monotonic()))
            if line.strip() == token:
                return
        raise RuntimeError(f"Pikafish 未返回 {token}")

    def start(self) -> None:
        if self.process is not None and self.process.poll() is None:
            return
        self.binary.chmod(self.binary.stat().st_mode | 0o111)
        self.output = queue.Queue()
        self.process = subprocess.Popen(
            [str(self.binary)],
            cwd=str(self.binary.parent),
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1,
        )
        threading.Thread(
            target=self._collect_output,
            args=(self.process,),
            daemon=True,
        ).start()
        self._send("uci")
        self._expect("uciok", timeout=15.0)
        self._send(f"setoption name EvalFile value {self.eval_file}")
        self._send(f"setoption name Threads value {THREADS}")
        self._send(f"setoption name Hash value {HASH_MB}")
        self._send("isready")
        self._expect("readyok", timeout=30.0)

    def close(self) -> None:
        process = self.process
        self.process = None
        if process is None:
            return
        try:
            if process.poll() is None and process.stdin is not None:
                process.stdin.write("quit\n")
                process.stdin.flush()
                process.wait(timeout=1)
        except (BrokenPipeError, subprocess.TimeoutExpired):
            process.kill()

    def restart(self) -> None:
        self.close()
        self.start()

    def _read_search(
        self,
        timeout_ms: int,
        multipv: int,
    ) -> tuple[str, list[str]]:
        deadline = time.monotonic() + timeout_ms / 1000 + READ_BUFFER_SECONDS + 5.0
        by_index: dict[int, str] = {}
        best = ""
        while time.monotonic() < deadline:
            line = self._read_line(max(0.05, deadline - time.monotonic()))
            if line.startswith("info ") and " pv " in line:
                multipv_match = MULTIPV_RE.search(line)
                pv_match = PV_RE.search(line)
                if pv_match:
                    move = pv_match.group(1).strip().lower()
                    index = int(multipv_match.group(1)) if multipv_match else 1
                    by_index[index] = move
            if line.startswith("bestmove"):
                parts = line.split()
                if len(parts) < 2:
                    raise RuntimeError("Pikafish 返回空 bestmove")
                best = parts[1].strip().lower()
                if best in {"(none)", "0000", "none"}:
                    raise RuntimeError("Pikafish 无合法着法")
                ranked = [by_index[i] for i in range(1, multipv + 1) if i in by_index]
                if best and best not in ranked:
                    ranked.insert(0, best)
                if not ranked:
                    ranked = [best]
                return best, ranked
        raise RuntimeError("Pikafish 未返回 bestmove")

    def best_move(
        self,
        fen: str,
        movetime_ms: int | None = DEFAULT_MOVETIME_MS,
        *,
        depth: int | None = None,
        multipv: int = 1,
        pick_index: int = 0,
    ) -> str:
        multipv = max(1, min(5, int(multipv)))
        pick_index = max(0, int(pick_index))
        with self.lock:
            try:
                self.start()
                self._send("ucinewgame")
                self._send("isready")
                self._expect("readyok", timeout=10.0)
                self._send(f"setoption name MultiPV value {multipv}")
                self._send(f"position fen {fen}")
                if depth is not None:
                    self._send(f"go depth {max(1, int(depth))}")
                    timeout_ms = max(500, int(depth) * 2500)
                else:
                    think = max(10, int(movetime_ms or DEFAULT_MOVETIME_MS))
                    self._send(f"go movetime {think}")
                    timeout_ms = think
                best, ranked = self._read_search(timeout_ms, multipv)
                if pick_index < len(ranked):
                    return ranked[pick_index]
                return ranked[-1] if ranked else best
            except Exception:
                self.restart()
                raise


_engine: PikafishEngine | None = None
_engine_lock = threading.Lock()


def get_pikafish_engine() -> PikafishEngine:
    global _engine
    with _engine_lock:
        if _engine is None:
            _engine = PikafishEngine()
        return _engine


def close_pikafish_engine() -> None:
    global _engine
    with _engine_lock:
        if _engine is not None:
            _engine.close()
            _engine = None


atexit.register(close_pikafish_engine)
