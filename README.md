# PlyHan

单屏三棋种人机对弈：国际象棋使用 chess-api.com，五子棋使用本机 Rapfi，中国象棋使用本机 Pikafish。无账号、无数据库、刷新即清空。

## 功能

- 首屏选择“国际象棋”、“五子棋”或“中国象棋”。
- 国际象棋：用户执白，后端校验棋规并请求 chess-api.com 返回电脑着法；默认「简单」，可选入门、简单、普通、困难四档（搜索深度 + 次优着 + 稳定失误率）。入门/简单不强制一步杀。
- 五子棋：15×15 自由规则。可对人机（Rapfi），或进入棋种后创建房间、发链接与对方联机（创建者执黑，加入者执白，不调引擎）。
- 中国象棋：9×10，用户执红，后端校验棋规并通过本机 Pikafish（UCI）回黑；默认「简单」。四档映射搜索深度、MultiPV 与失误注入，界面补足最短思考动画。
- 人机模式支持落子历史、重新开局、引擎失败重试和胜负提示。

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

## 五子棋联机

首页仍先选棋种。点进五子棋后可选「自己对电脑」或「创建房间」。

1. 一方点「创建房间」，复制房间码或链接（`http://127.0.0.1:5173/?game=gomoku&r=房间码`）。
2. 另一方点链接，或在五子棋页输入房间码加入。创建者执黑，加入者执白。
3. 走子经 WebSocket 同步，不调用 Rapfi。

本机可用两个浏览器窗口测试（或一个普通窗口加一个无痕窗口）。房间存在后端内存里，约 2 小时无着法会解散。同一标签页刷新会坐回原位。

上云（一台机器、一个进程）：

```bash
backend/.venv/bin/uvicorn main:app \
  --app-dir backend \
  --host 0.0.0.0 \
  --port 8000 \
  --workers 1
```

构建前端时设置 `VITE_API_BASE_URL` 为后端公网地址。Nginx 反代 `/api/` 时要打开 WebSocket 升级：

```nginx
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
```

不要用多个 uvicorn worker，否则房间状态对不上。

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
