import argparse
import hashlib
import platform
import shutil
import tempfile
import urllib.request
from pathlib import Path

import py7zr

RELEASE_URL = (
    "https://github.com/official-pikafish/Pikafish/releases/download/"
    "Pikafish-2026-01-02/Pikafish.2026-01-02.7z"
)
RELEASE_SHA256 = "84257063905615919fb4ee6a70273a94843bb6ec04c45e3ac706098838bc1a49"
BACKEND_DIR = Path(__file__).resolve().parent
ENGINE_DIR = BACKEND_DIR / "Pikafish-engine"


def download(url: str, destination: Path) -> None:
    print(f"下载 Pikafish：{url}")
    with urllib.request.urlopen(url, timeout=120) as response:
        with destination.open("wb") as output:
            shutil.copyfileobj(response, output)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def expected_binary() -> str:
    system = platform.system()
    machine = platform.machine().lower()
    if system == "Darwin" and machine in {"arm64", "aarch64"}:
        return "MacOS/pikafish-apple-silicon"
    if system == "Linux" and machine in {"x86_64", "amd64"}:
        return "Linux/pikafish-sse41-popcnt"
    raise RuntimeError(f"暂不支持自动安装：{system} {platform.machine()}")


def install(force: bool) -> None:
    binary_rel = expected_binary()
    if ENGINE_DIR.exists():
        if not force:
            existing = list(ENGINE_DIR.rglob(Path(binary_rel).name))
            nnue = list(ENGINE_DIR.rglob("pikafish.nnue"))
            if existing and nnue:
                print(f"{ENGINE_DIR} 已存在；如需重装，请加 --force")
                return
        shutil.rmtree(ENGINE_DIR)

    with tempfile.TemporaryDirectory(prefix="plyhan-pikafish-") as temp:
        temp_dir = Path(temp)
        archive = temp_dir / "Pikafish.7z"
        extracted = temp_dir / "extracted"
        download(RELEASE_URL, archive)
        actual_hash = sha256(archive)
        if actual_hash != RELEASE_SHA256:
            raise RuntimeError(
                f"Pikafish 包校验失败：期望 {RELEASE_SHA256}，实际 {actual_hash}"
            )

        print("解压 Pikafish…")
        extracted.mkdir(parents=True, exist_ok=True)
        with py7zr.SevenZipFile(archive, mode="r") as package:
            package.extractall(path=extracted)

        ENGINE_DIR.mkdir(parents=True, exist_ok=True)
        binary_src = extracted / binary_rel
        if not binary_src.is_file():
            raise RuntimeError(f"安装包内没有当前平台文件：{binary_rel}")
        binary_dst = ENGINE_DIR / binary_src.name
        shutil.copy2(binary_src, binary_dst)
        binary_dst.chmod(binary_dst.stat().st_mode | 0o111)

        nnue_src = extracted / "pikafish.nnue"
        if not nnue_src.is_file():
            raise RuntimeError("安装包内没有 pikafish.nnue")
        shutil.copy2(nnue_src, ENGINE_DIR / "pikafish.nnue")

    print(f"Pikafish 安装完成：{ENGINE_DIR / Path(binary_rel).name}")
    print(f"NNUE：{ENGINE_DIR / 'pikafish.nnue'}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="安装 PlyHan 使用的 Pikafish 引擎")
    parser.add_argument("--force", action="store_true", help="覆盖现有 Pikafish-engine")
    args = parser.parse_args()
    install(force=args.force)
