# PlyHan

单屏三棋种人机对弈：国际象棋使用 chess-api.com，五子棋使用本机 Rapfi，中国象棋使用本机 Pikafish。无账号、无数据库、刷新即清空。

## 功能

- 首屏选择“国际象棋”、“五子棋”或“中国象棋”。
- 国际象棋：用户执白，后端校验棋规并请求 chess-api.com 返回电脑着法；可选入门、简单、普通、困难四档搜索深度。
- 五子棋：15×15 自由规则，用户执黑，后端校验落子并通过 Rapfi 返回电脑着法；可选入门、简单、普通、困难四档。入门档大部分时间采用 Rapfi 简单着法，约 20% 的局面稳定选择一次较弱但合法的落子；其他档使用 Rapfi 原生棋力控制，界面统一补足思考时间。
- 中国象棋：9×10，用户执红，后端校验棋规并通过本机 Pikafish（UCI）回黑；难度映射为不同 `movetime`，界面同样补足最短思考动画。
- 三种模式均支持落子历史、重新开局、引擎失败重试和胜负提示。

## 环境安装

```bash
cp .env.example .env
python3 -m venv backend/.venv
backend/.venv/bin/pip install -r backend/requirements.txt
npm --prefix frontend install
```

安装 Rapfi 官方引擎（macOS Apple Silicon 与 Linux x86_64）：

```bash
backend/.venv/bin/python backend/setup_rapfi.py
```

安装 Pikafish 官方引擎与 NNUE 权重（同样支持 macOS Apple Silicon 与 Linux x86_64）：

```bash
backend/.venv/bin/python backend/setup_pikafish.py
```

如果服务器已经安装引擎，可在根目录 `.env` 直接指定：

```dotenv
RAPFI_BINARY=/absolute/path/to/pbrain-rapfi
RAPFI_BOARD_SIZE=15
RAPFI_TIMEOUT_TURN=1500

PIKAFISH_BINARY=/absolute/path/to/pikafish-apple-silicon
PIKAFISH_EVAL_FILE=/absolute/path/to/pikafish.nnue
PIKAFISH_MOVETIME_MS=400
```

Linux 云主机执行相同的 Python 安装命令即可，不需要 Docker。运行账户必须有执行引擎二进制的权限。

前后端部署在不同域名或端口时，设置：

```dotenv
# 根目录 .env
CORS_ORIGINS=https://your-frontend.example

# frontend/.env
VITE_API_BASE_URL=https://your-backend.example
```

## 启动

后端：

```bash
backend/.venv/bin/uvicorn main:app \
  --app-dir backend \
  --host 0.0.0.0 \
  --port 8000
```

前端：

```bash
npm --prefix frontend run dev -- --host 0.0.0.0
```

打开 `http://127.0.0.1:5173`。

## 检查

```bash
curl http://127.0.0.1:8000/health
```

若五子棋提示引擎不可用：

1. 运行 `backend/.venv/bin/python backend/setup_rapfi.py`。
2. 检查 `.env` 中 `RAPFI_BINARY` 是否为绝对路径。
3. 确认可执行文件有执行权限，并重启后端。

若中国象棋提示引擎不可用：

1. 运行 `backend/.venv/bin/python backend/setup_pikafish.py`。
2. 确认 `backend/Pikafish-engine/` 内有当前平台二进制和 `pikafish.nnue`。
3. 检查 `.env` 中 `PIKAFISH_BINARY` / `PIKAFISH_EVAL_FILE` 是否为绝对路径。
4. 重启后端后再试；首次 `isready` 会加载 NNUE，可能稍慢。
