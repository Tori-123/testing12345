# 启动前必做（Basic Setting）

电脑重启、关掉终端、或重新打开项目之后，**先做完这一页，再打开网页下棋**。  
Rapfi / Pikafish 不进 git。没装引擎时，中国象棋会报「未安装 Pikafish」，五子棋人机同样会失败。

以下命令都在项目根目录执行：

`testing12345/`

---

## 1. 每次启动都跑（按顺序）

### 1.1 环境文件

```bash
test -f .env || cp .env.example .env
test -f frontend/.env || cp frontend/.env.example frontend/.env
```

本机开发保持：

```dotenv
# .env
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173

# frontend/.env
VITE_API_BASE_URL=http://127.0.0.1:8000
```

### 1.2 虚拟环境和依赖

```bash
test -x backend/.venv/bin/python || python3 -m venv backend/.venv
backend/.venv/bin/pip install -r backend/requirements.txt
npm --prefix frontend install
```

### 1.3 安装本机引擎（可重复执行）

已安装时脚本会直接跳过，不会重下。

```bash
backend/.venv/bin/python backend/setup_rapfi.py
backend/.venv/bin/python backend/setup_pikafish.py
```

必须用 `backend/.venv/bin/python`，不要用系统自带的 `python`。

装完应能看到：

- `backend/Rapfi-engine/`
- `backend/Pikafish-engine/`（里面有当前平台的二进制和 `pikafish.nnue`）

### 1.4 启动后端（先开这个）

另开一个终端，保持运行：

```bash
backend/.venv/bin/uvicorn main:app \
  --app-dir backend \
  --host 0.0.0.0 \
  --port 8000 \
  --workers 1
```

检查：

```bash
curl http://127.0.0.1:8000/health
```

应返回 `{"status":"Backend is Ready"}`。

### 1.5 启动前端

再开一个终端：

```bash
npm --prefix frontend run dev -- --host 0.0.0.0
```

浏览器打开：<http://127.0.0.1:5173>

---

## 2. 看到这张报错时

界面类似：

> 中国象棋引擎暂时不可用：未安装 Pikafish，请先运行 python backend/setup_pikafish.py

按下面做，**不要只跑报错里的 `python ...`**：

```bash
backend/.venv/bin/python backend/setup_pikafish.py
backend/.venv/bin/python backend/setup_rapfi.py
```

然后停掉后端终端（`Ctrl+C`），重新执行 **1.4**。引擎是后端启动时加载的，只刷新网页不够。

五子棋人机报 Rapfi 不可用时，同样先跑 `setup_rapfi.py`，再重启后端。

---

## 3. 不要做的事

- 先开前端、后开后端（棋盘能点，引擎一定失败）
- 用 `python backend/setup_pikafish.py` 而不是虚拟环境里的 Python
- 后端加 `--workers` 大于 1（五子棋联机房间会对不上）
- 只刷新浏览器，不重启 uvicorn（刚装完引擎时）
