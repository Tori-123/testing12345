# PlyHan

单屏双棋种人机对弈：国际象棋使用 chess-api.com，五子棋使用本机或云主机上的 Rapfi。无账号、无数据库、刷新即清空。

## 功能

- 首屏选择“国际象棋”或“五子棋”。
- 国际象棋：用户执白，后端校验棋规并请求 chess-api.com 返回电脑着法。
- 五子棋：15×15 自由规则，用户执黑，后端校验落子并通过 Rapfi 返回电脑着法；可选入门、简单、普通、困难四档。入门档大部分时间采用 Rapfi 简单着法，约 20% 的局面稳定选择一次较弱但合法的落子；其他档使用 Rapfi 原生棋力控制，界面统一补足思考时间。
- 两种模式均支持落子历史、重新开局、引擎失败重试和胜负提示。

## 环境安装

```bash
cp .env.example .env
python3 -m venv backend/.venv
backend/.venv/bin/pip install -r backend/requirements.txt
npm --prefix frontend install
```

安装 Rapfi 官方引擎。脚本支持 macOS Apple Silicon 与 Linux x86_64，并校验官方发布包：

```bash
backend/.venv/bin/python backend/setup_rapfi.py
```

如果服务器已经安装 Rapfi，可在根目录 `.env` 直接指定：

```dotenv
RAPFI_BINARY=/absolute/path/to/pbrain-rapfi
RAPFI_BOARD_SIZE=15
RAPFI_TIMEOUT_TURN=1500
```

Linux 云主机执行相同的 Python 安装命令和 `setup_rapfi.py` 即可，不需要 Docker。运行账户必须有执行 Rapfi 二进制的权限。

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
