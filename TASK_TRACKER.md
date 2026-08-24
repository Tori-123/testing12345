# 🎯 36 小时黑客松任务看板 (Task Tracker)

产品：PlyHan。法源：`docs/PRD.md`、`docs/schema.md`、`docs/UI_BLUEPRINT.md`。  
执行纪律：任何卡顿报错超过 1 小时的 `[ ]` 任务，Tech Lead 必须划掉或降级，核心回路优先。

---

## 阶段一：后端主线 (Backend Pipeline) - 预计耗时 2 小时

只改 `backend/`。禁止数据库。禁止碰 `frontend/`。

- [ ] 在 `backend/main.py` 用 `python-dotenv` 从**项目根目录** `.env` 读取 `MINIMAX_API_KEY`、`MINIMAX_API_BASE`、`CHESS_API_URL`（`os.getenv`，密钥禁止写进源码）
- [ ] 在 `backend/requirements.txt` 增加拆谱所需的 `python-chess`（仅棋规，不算棋力）
- [ ] 在 `backend/` 新增 `sample_game.json`：写入与 `docs/schema.md` 第 4 节 Mock 同结构的预置成功响应（含 `fen`、`g4`、`mistake`/`plan`/`cue`）
- [ ] 在 `backend/main.py` 定义 Pydantic 模型 `AnalyzeRequest`，仅一个必填字段 `pgn: str`
- [ ] 在 `backend/main.py` 定义 Pydantic 模型 `AnalyzeResponse`，字段名与 Schema **逐字一致**：`status` `error_message` `degraded` `fen` `move_number` `side` `user_san` `user_uci` `from_square` `to_square` `engine_san` `engine_uci` `eval_before` `eval_after` `eval_drop` `mistake` `plan` `cue`
- [ ] 在 `backend/main.py` 创建 `POST /api/v1/analyze`（路径必须是 `/api/v1/analyze`，不是 `/api/analyze`）
- [ ] 空 `pgn` 或纯空白：返回 `status="error"`，`error_message` 为一句中文，其余棋盘字段按 Schema 置空/零
- [ ] 用 `python-chess` 解析 PGN；非法谱：不调引擎、不调大模型，直接 `status="error"`，文案说明 PGN 非法
- [ ] 半步（ply）超过 80：拒绝，`error_message` 为「先截到败着附近再贴」
- [ ] 对每步局面调用 `POST {CHESS_API_URL}`，请求体含 `fen`，只读取返回的 `eval` 与 `move`/`san`
- [ ] 用相邻 `eval` 差选出对走棋方掉分最大的 **1** 手，填入 `move_number` `side` `user_san` `user_uci` `from_square` `to_square` `eval_before` `eval_after` `eval_drop`
- [ ] 将该手的 FEN、用户着法、引擎着法、分数差发给 MiniMax；要求模型只返回 JSON 三字段 `mistake` `plan` `cue`；禁止用模型生成着法或评估
- [ ] 模型缺字段/非 JSON：视为失败，改用 `sample_game.json` 里预写的三句，不得把模型原文塞进单一 `content`
- [ ] chess-api.com 超时、429、非 JSON：设 `degraded=true`，改用 `sample_game.json` 的局面数据，仍尝试调大模型讲解该示例局面
- [ ] 用 `curl` 或 FastAPI TestClient POST 一段短合法 PGN，确认响应 JSON 键集合与 Schema 完全一致
- [ ] 确认 `/health` 仍返回 `{"status": "Backend is Ready"}`，且没有第二个业务路由

---

## 阶段二：前端主线 (Frontend Pipeline) - 预计耗时 3 小时

只改 `frontend/`。先不要 fetch 后端。把 Schema 第 4 节 Mock JSON 复制为本地常量。禁止 `react-router`、Redux、打字机库。

- [ ] 删除 `App.jsx` 里的 `"Frontend is Ready"`，按蓝图搭 `<SingleScreenWorkspace>`：`h-screen overflow-hidden bg-neutral-950`，无窗口滚动
- [ ] 实现 `<BrandStrip>`：左 `PlyHan`，右 slogan「对着红条发呆的那五分钟，把棋谱扔进来。」两者均不可点击跳转
- [ ] 用 `useState` 管理 `view: "idle" | "loading" | "result"` 和 `pgn: string`，无全局 store
- [ ] 实现 `<PgnTextarea>`：矮、`font-mono`、内部滚动；进入页面自动 `focus`
- [ ] 实现 `<SampleLink>` 文字链「载入示例」：只把内置示例 PGN 字符串写入 textarea，不发网络请求
- [ ] 实现 `<SubmitButton>`：文案「复盘这一手」；`pgn` 去空白为空时 `disabled`；主色 `bg-red-600`、直角 `rounded-none`
- [ ] `idle`：隐藏红条、棋盘、白皮卡；只显示顶栏 + 输入条
- [ ] 点击提交后 200ms 内切到 `loading`：按钮禁用并改为「正在找败着」；文本框只读
- [ ] 实现 `<RedBar>`：`h-1 bg-red-600`，仅用 Tailwind `transition-all duration-1000` 从 `w-full` 收到 `w-1/12` 一次；下方固定文案「正在找掉分最大的一手」
- [ ] 在 `src/` 新建常量文件，原样粘贴 `docs/schema.md` 第 4 节 Mock JSON（`g4` / `+1.6` / `-2.8` / 三句中文）
- [ ] `loading` 用 `setTimeout` 约 1 秒后切到 `result`，把该 Mock 当作成功响应（此时仍不调用后端）
- [ ] 实现 `<PlyCaption>`：绑定 Mock 的 `move_number` 与 `side`（`white`→「白」，`black`→「黑」）
- [ ] 实现 `<EvalRow>`：`eval_before` 删除线 `text-neutral-500`；`eval_after` 为 `text-red-600 font-mono`；`eval_drop` 显示「掉 {n}」
- [ ] 实现 `<ChessBoard>`：8×8 CSS Grid + Unicode 棋子，渲染 Mock `fen`；`from_square`/`to_square`（`g2`/`g4`）用 `ring-2 ring-red-600`；禁止箭头动画
- [ ] 实现 `<MovePair>`：`user_san` 为 `text-6xl font-bold`，`title={user_uci}`；`engine_san` 为 `text-xl`，前缀「该走」，`title={engine_uci}`，颜色 `neutral-500`
- [ ] 实现 `<TalkCard>`：`bg-white text-neutral-900 overflow-y-auto rounded-none`；三节固定标题「错在哪 / 当时该怎样 / 下次先看什么」，正文分别绑 `mistake` `plan` `cue`
- [ ] `degraded === true` 时在 `<BrandStrip>` 显示「已用示例局面」；Mock 为 `false` 时该标记必须隐藏
- [ ] 写死一份 `status="error"` 的本地对象，临时触发后只在按钮下显示 `error_message`，棋盘与白皮卡保持隐藏、不弹窗
- [ ] 目视核对：无 NavBar、无 Sidebar、无第二页、强调色只有红、讲解为静态文本不是打字机

---

## 阶段三：跨海大桥合拢 (Integration) - 预计耗时 2 小时

前后端联调。前端去掉「用 timeout 喂 Mock」作为主路径。

- [ ] 在 `backend/main.py` 为 FastAPI 加上 CORSMiddleware，允许 `http://localhost:5173` 与 `http://127.0.0.1:5173`
- [ ] 前端提交改为一次 `fetch("http://127.0.0.1:8000/api/v1/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pgn }) })`，禁止 WebSocket / SSE
- [ ] 点击提交立即 `view="loading"`，等完整 JSON 返回后再切 `result` 或显示错误
- [ ] `status === "success"`：用响应字段替换原先 Mock 绑定（字段名不得改写）
- [ ] `status === "error"`：`view` 回到可编辑输入，渲染 `error_message`，隐藏棋盘与白皮卡
- [ ] 浏览器实际粘贴一段 **短于 80 半步** 的合法 PGN，确认能出棋盘高亮和三句中文
- [ ] 点「载入示例」再提交，确认走的是 textarea 里的 PGN，而不是前端私自换路由
- [ ] 确认响应里没有 `data` 包裹层，前端只读第一层字段

---

## 阶段四：验收底线防线 (Acceptance & Fallback) - 预计耗时 1 小时

对照 PRD 验收底线，保证路演不翻车。

- [ ] 前端在 `fetch` 外包 30 秒 `AbortController` 超时：超时显示一句中文失败，禁止无限转圈
- [ ] 后端或网络失败时：前端改用本地 Mock JSON 渲染结果，并把 `degraded` 视为 true，显示「已用示例局面」（演示兜底；不要 Service Worker）
- [ ] 无网评委路径：不启动后端，只点「载入示例」+ 提交，仍能靠前端兜底看到 `g4` 棋盘和三句话
- [ ] 过长 PGN（>80 半步）走一遍，确认出现「先截到败着附近再贴」，不把页面卡死
- [ ] 非法 PGN 走一遍，确认只有 `error_message`、没有空白死屏
- [ ] `degraded=true` 的后端响应走一遍，角落印章可见且三句话仍在
- [ ] 刷新页面后输入和结果全部消失（无 localStorage、无账号）
- [ ] 路演清单：先开后端 `uvicorn`，再开前端 `npm run dev`；备用：只开前端走 Mock 兜底

> 任何卡顿报错超过 1 小时的 `[ ]` 任务，Tech Lead 必须果断将其无情划掉或降级，确保核心回路不受阻碍。
