import argparse
import hashlib
import platform
import shutil
import tempfile
import urllib.request
from pathlib import Path

import py7zr

RELEASE_URL = (
    "https://github.com/dhbloo/rapfi/releases/download/250615/Rapfi-engine.7z"
)
RELEASE_SHA256 = "1a3e24024062a153ac079060ee9589a37c6bdd1ecc54fed3908793c519594e05"
BACKEND_DIR = Path(__file__).resolve().parent
ENGINE_DIR = BACKEND_DIR / "Rapfi-engine"


def download(url: str, destination: Path) -> None:
    print(f"下载 Rapfi：{url}")
    with urllib.request.urlopen(url, timeout=60) as response:
        with destination.open("wb") as output:
            shutil.copyfileobj(response, output)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def platform_hint() -> str:
    system = platform.system()
    machine = platform.machine().lower()
    if system == "Darwin" and machine in {"arm64", "aarch64"}:
        return "pbrain-rapfi-macos-apple-silicon"
    if system == "Linux" and machine in {"x86_64", "amd64"}:
        return "pbrain-rapfi-linux-clang-sse"
    raise RuntimeError(f"暂不支持自动安装：{system} {platform.machine()}")


def install(force: bool) -> None:
    expected_binary = platform_hint()
    if ENGINE_DIR.exists():
        if not force:
            print(f"{ENGINE_DIR} 已存在；如需重装，请加 --force")
            return
        shutil.rmtree(ENGINE_DIR)

    with tempfile.TemporaryDirectory(prefix="plyhan-rapfi-") as temp:
        temp_dir = Path(temp)
        archive = temp_dir / "Rapfi-engine.7z"
        extracted = temp_dir / "extracted"
        download(RELEASE_URL, archive)
        actual_hash = sha256(archive)
        if actual_hash != RELEASE_SHA256:
            raise RuntimeError(
                f"Rapfi 包校验失败：期望 {RELEASE_SHA256}，实际 {actual_hash}"
            )

        print("解压 Rapfi…")
        with py7zr.SevenZipFile(archive, mode="r") as package:
            package.extractall(path=extracted)
        shutil.move(str(extracted), str(ENGINE_DIR))

    matches = list(ENGINE_DIR.rglob(expected_binary))
    if not matches:
        raise RuntimeError(f"安装包内没有当前平台文件：{expected_binary}")
    binary = matches[0]
    binary.chmod(binary.stat().st_mode | 0o111)
    print(f"Rapfi 安装完成：{binary}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="安装 PlyHan 使用的 Rapfi 引擎")
    parser.add_argument("--force", action="store_true", help="覆盖现有 Rapfi-engine")
    args = parser.parse_args()
    install(force=args.force)
