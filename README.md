# PlyHan

[中文](#plyhan) · [English](#plyhan-english)

单屏四棋种：国际象棋使用 chess-api.com，五子棋使用本机 Rapfi，中国象棋使用本机 Pikafish，跳棋使用本机英式规则与 alpha-beta。用户注册/登录由 Supabase Auth 提供，未登录只能看到登录/注册页，登录后才能进入棋盘。

## 功能

- 首屏选择“国际象棋”、“五子棋”、“中国象棋”或“跳棋”。前三种可以对电脑或开房间联机；跳棋目前只对人机。
- 国际象棋人机：后端校验棋规并请求 chess-api.com；默认「简单」，可选入门、简单、普通、困难。联机不调 API，创建者自选执白或执黑。
- 五子棋：15×15 自由规则。人机用 Rapfi；联机不调引擎，创建者自选执黑或执白。
- 中国象棋人机：本机 Pikafish。联机不调引擎，创建者自选执红或执黑。
- 跳棋：8×8 英美规则，本机搜索。先选执黑/执白和难度再开始；开局后不能改难度。
- 人机模式支持落子历史、重新开局、引擎失败重试和胜负提示。联机有房间码、步时、认输，再来一局需双方同意。

## 用户认证（Supabase Auth)

前端用 Supabase 做账号体系：注册、登录、登出、会话持久化。所有棋盘页和仪表盘都是受保护路由，未登录会被重定向到 `/login`。

### 结构

```
frontend/src/
├── lib/supabaseClient.js   # 封装的 Supabase 客户端（读 .env）
├── auth/AuthContext.jsx    # 会话状态 + onAuthStateChange + 登录/注册/登出
├── auth/ProtectedRoute.jsx # 路由守卫（HOC）：未登录跳 /login
├── components/AuthShell.jsx
└── pages/
    ├── LoginPage.jsx       # /login
    ├── RegisterPage.jsx    # /register
    ├── DashboardPage.jsx   # /dashboard（受保护，登出入口）
    └── HomePage.jsx        # /（受保护，棋盘选择）
```

### 配置

在 Supabase Dashboard → Project Settings → API 拿到项目 URL 和 anon(public) key，写入 `frontend/.env`：

```dotenv
VITE_API_BASE_URL=http://127.0.0.1:8000
VITE_SUPABASE_URL=https://oxijzdgtpkprhqwzffnv.supabase.co
VITE_SUPABASE_ANON_KEY=你的_anon_public_key
```

只使用 anon key，**绝不使用 `service_role` key**。`.env` 已被 `.gitignore` 忽略，不会进仓库。

### 说明

- 会话由 `@supabase/supabase-js` 自动持久化（localStorage），刷新页面会恢复登录态。
- 注册默认开启邮箱确认时，注册后会提示去邮箱验证，验证成功后才能登录。
- 生产环境用 `BrowserRouter`，若用 Nginx/静态托管 dist，请配置 SPA fallback（所有路径回退到 `index.html`），否则刷新 `/dashboard` 会 404。

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

## 联机

首页仍先选棋种。点进任意一种后可选「自己对电脑」或「创建房间」。

1. 先选自己的颜色，再点「创建房间」，复制房间码或链接。
   - 五子棋：`/?game=gomoku&r=房间码`
   - 国际象棋：`/?game=chess&r=房间码`
   - 中国象棋：`/?game=xiangqi&r=房间码`
2. 另一方点链接，或在对应棋种页输入房间码加入，拿剩下的颜色。
3. 走子经 WebSocket 同步，不调用引擎。对局结束后点「再来一局」只是申请，双方都点同意才清空棋盘。

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

---

# PlyHan (English)

One screen, four games: chess via chess-api.com, gomoku via local Rapfi, xiangqi via local Pikafish, and English draughts via an in-process alpha-beta search. User registration/login is handled by Supabase Auth. Without a session you only see the login/register pages; the game boards are behind a login.

## Features

- The home screen offers Chess, Gomoku, Xiangqi, or Draughts. The first three support vs-computer and link-based multiplayer; draughts is vs-computer only for now.
- Chess vs computer: the backend checks the rules and calls chess-api.com. Default difficulty is Easy, with Beginner, Easy, Normal, and Hard. Online play does not call the API. The room creator picks White or Black.
- Gomoku: 15×15 freestyle. Vs computer uses Rapfi. Online play does not call the engine. The room creator picks Black or White.
- Xiangqi vs computer: local Pikafish. Online play does not call the engine. The room creator picks Red or Black.
- Draughts: 8×8 English/American rules, local search. Pick Black/White and difficulty, then start. Difficulty cannot be changed after the game starts.
- Vs-computer mode has move history, restart, engine-failure retry, and a win/loss prompt. Online rooms have a room code, per-move clock, resign, and a rematch that only resets when both players agree.

## Authentication (Supabase Auth)

The frontend uses Supabase for accounts: register, login, logout, and session persistence. Every game page and the dashboard are protected routes; a logged-out user is redirected to `/login`.

### Structure

```
frontend/src/
├── lib/supabaseClient.js   # Wrapped Supabase client (reads .env)
├── auth/AuthContext.jsx    # Session state + onAuthStateChange + sign up/in/out
├── auth/ProtectedRoute.jsx # Route guard (HOC): redirects to /login when logged out
├── components/AuthShell.jsx
└── pages/
    ├── LoginPage.jsx       # /login
    ├── RegisterPage.jsx    # /register
    ├── DashboardPage.jsx   # /dashboard (protected, logout entry)
    └── HomePage.jsx        # / (protected, board picker)
```

### Configuration

Grab the project URL and anon(public) key from Supabase Dashboard → Project Settings → API, then write them to `frontend/.env`:

```dotenv
VITE_API_BASE_URL=http://127.0.0.1:8000
VITE_SUPABASE_URL=https://oxijzdgtpkprhqwzffnv.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_public_key
```

Only the anon key is used, **never the `service_role` key**. `.env` is gitignored and won't be committed.

### Notes

- The session is persisted automatically by `@supabase/supabase-js` (localStorage) and survived a refresh.
- Register uses email confirmation if enabled: after signing up you may need to verify your email before logging in.
- Production uses `BrowserRouter`; if you host the built `dist` via Nginx/static hosting, configure an SPA fallback to `index.html`, or refreshing `/dashboard` will return 404.

## Setup

```bash
cp .env.example .env
python3 -m venv backend/.venv
backend/.venv/bin/pip install -r backend/requirements.txt
npm --prefix frontend install
```

Install the official Rapfi engine (macOS Apple Silicon and Linux x86_64):

```bash
backend/.venv/bin/python backend/setup_rapfi.py
```

Install the official Pikafish engine and NNUE weights (same platforms):

```bash
backend/.venv/bin/python backend/setup_pikafish.py
```

If the engines are already on the server, set absolute paths in the root `.env`:

```dotenv
RAPFI_BINARY=/absolute/path/to/pbrain-rapfi
RAPFI_BOARD_SIZE=15
RAPFI_TIMEOUT_TURN=1500

PIKAFISH_BINARY=/absolute/path/to/pikafish-apple-silicon
PIKAFISH_EVAL_FILE=/absolute/path/to/pikafish.nnue
PIKAFISH_MOVETIME_MS=400
```

On a Linux VPS, run the same Python install commands. Docker is not required. The process user must be allowed to execute the engine binaries.

If frontend and backend are on different hosts or ports:

```dotenv
# repo-root .env
CORS_ORIGINS=https://your-frontend.example

# frontend/.env
VITE_API_BASE_URL=https://your-backend.example
```

## Run

Backend:

```bash
backend/.venv/bin/uvicorn main:app \
  --app-dir backend \
  --host 0.0.0.0 \
  --port 8000
```

Frontend:

```bash
npm --prefix frontend run dev -- --host 0.0.0.0
```

Open `http://127.0.0.1:5173`.

## Online play

Pick a game on the home screen first. Inside a game you can choose vs computer or create a room.

1. Pick your color, then click Create Room, and copy the room code or link.
   - Gomoku: `/?game=gomoku&r=ROOMCODE`
   - Chess: `/?game=chess&r=ROOMCODE`
   - Xiangqi: `/?game=xiangqi&r=ROOMCODE`
2. The other player opens the link, or enters the room code on that game’s page, and takes the remaining color.
3. Moves sync over WebSocket. The engine is not used. After the game, Rematch is only a request; the board clears when both players agree.

You can test locally with two browser windows (or one normal window and one private window). Rooms live in backend memory and expire after about two hours with no moves. Refreshing the same tab reseats you.

On a single cloud host, run one process:

```bash
backend/.venv/bin/uvicorn main:app \
  --app-dir backend \
  --host 0.0.0.0 \
  --port 8000 \
  --workers 1
```

When building the frontend, set `VITE_API_BASE_URL` to the public backend URL. If Nginx proxies `/api/`, enable WebSocket upgrades:

```nginx
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
```

Do not use multiple uvicorn workers, or room state will not match across processes.

## Checks

```bash
curl http://127.0.0.1:8000/health
```

If gomoku says the engine is unavailable:

1. Run `backend/.venv/bin/python backend/setup_rapfi.py`.
2. Check that `RAPFI_BINARY` in `.env` is an absolute path.
3. Confirm the binary is executable, then restart the backend.

If xiangqi says the engine is unavailable:

1. Run `backend/.venv/bin/python backend/setup_pikafish.py`.
2. Confirm `backend/Pikafish-engine/` has the current-platform binary and `pikafish.nnue`.
3. Check that `PIKAFISH_BINARY` / `PIKAFISH_EVAL_FILE` in `.env` are absolute paths.
4. Restart the backend and try again. The first `isready` loads the NNUE and can be slow.
