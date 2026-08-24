# UI 蓝图：红条特写 (Redbar Crop)

前端 Agent 最高视觉指令。禁止发明 Schema 中不存在的字段。禁止引入路由库、动画库、3D、毛玻璃、打字机效果。

选定风格：杂志裁切。近黑底 + 中央白皮讲解卡。强调色只有 `red-600`。

---

## 1. 架构原则 (Architecture Rules)

- 强制单屏：严禁多页面跳转，严禁 `react-router` 或任何前端路由。体验在一个 `100vh` 工作区内闭环。
- 三态只靠条件渲染：`idle` | `loading` | `result`。`status === "error"` 仍留在本屏，于输入区下方显示 `error_message`，不跳页、不弹模态全屏。
- 工作区本身 `overflow-hidden`，禁止浏览器窗口级滚动。PGN 文本框与白皮讲解卡各自内部滚动。
- 全局无 NavBar、无 Sidebar、无页脚链接、无「首页/设置/关于」。顶栏只有产品名与一句 slogan 文本，不可点击跳转。
- 前端未接后端时，用 `docs/schema.md` 第 4 节 Mock JSON 驱动 `result` 态，接口固定 `POST /api/v1/analyze`，请求体只有 `{ pgn }`。
- 棋盘用 8×8 CSS Grid + Unicode 棋子即可，禁止 chess 3D / WebGL。高亮用格子 `outline`/`ring`，禁止箭头动画。

---

## 2. 全局设计规范 (Design System)

- 主题色 (Primary Color): 唯一强调色 `red-600`。引擎对照色不要第二套品牌色：引擎着法用 `neutral-500` 小字，不要 teal/green。
- 背景与文字 (Background & Text): 页面背景 `neutral-950`，纯色无材质、无网格、无扫描线。主文案 `neutral-100`，弱文案 `neutral-500`。讲解卡背景 `white`，卡内文字 `neutral-900`，形成杂志剪贴高对比。
- 组件风格 (Component Style): 直角优先 `rounded-none`。扁平、无阴影或最多 `shadow-sm` 用在白皮卡。禁止 glassmorphism、禁止渐变背景、禁止发光。按钮：主按钮实心 `red-600` 白字；「载入示例」是 `neutral-400` 下划线文字链，看起来不像导航。字体全 `font-sans`。字重拉开：`user_san` 为 `text-6xl font-bold`，`engine_san` 为 `text-xl font-medium`。

---

## 3. 核心交互状态 (State Management)

前端本地状态：`view: "idle" | "loading" | "result"`，外加 `pgn: string` 与可选的响应对象。无用户会话。

### 初始状态 (Initial/Idle)

- 视觉焦点：一进入即 `focus` 到 PGN `<textarea>`。
- 可见：顶栏 slogan、矮文本框、文字链「载入示例」、主按钮「复盘这一手」。
- 隐藏：红条、棋盘、白皮卡。
- 「载入示例」只把内置示例 PGN 字符串写入 textarea，不发请求、不换页。
- 主按钮在 `pgn` 去掉空白后为空时禁用。

### 加载状态 (Loading/Waiting)

- 点击主按钮后 200ms 内切到 `loading`。按钮禁用，文案改为「正在找败着」。
- 文本框保留但变矮、只读。
- 中区只出现一根 `h-1` 的 `red-600` 横条：用 Tailwind `transition-all duration-1000` 把宽度从 `w-full` 收到 `w-1/12`（只过渡一次）。禁止无限循环动画库。
- 横条下固定一句：`正在找掉分最大的一手`。不要文案轮播。
- 隐藏棋盘与白皮卡。请求为一次 `fetch` POST，禁止 WebSocket / SSE。

### 结果状态 (Result)

仅当响应 `status === "success"`。字段落地如下（全部来自 Schema，名称不得改写）：

| 位置 | 形式 | 绑定字段 |
| --- | --- | --- |
| 棋盘上方小字 | 「第 {n} 手 · 白/黑」 | `move_number` + `side`（`white` 显示「白」，`black` 显示「黑」） |
| 棋盘上方评估行 | `eval_before` 用 `line-through text-neutral-500`；箭头；`eval_after` 用 `text-red-600 font-mono`；右侧小字掉分 | `eval_before` `eval_after` `eval_drop` |
| 棋盘 | 8×8 渲染 `fen`；`from_square` 与 `to_square` 格子 `ring-2 ring-red-600` | `fen` `from_square` `to_square` |
| 棋盘下方并置 | 左侧超大 `user_san`；右侧较小「该走 {engine_san}」 | `user_san` `engine_san` |
| 着法 title 提示 | 鼠标悬停显示 UCI，不单独占布局 | `user_uci` `engine_uci` |
| 白皮卡内三节 | 标题固定「错在哪 / 当时该怎样 / 下次先看什么」，正文纯文本 | `mistake` `plan` `cue` |
| 工作区右上角小标 | 仅 `degraded === true` 时显示「已用示例局面」 | `degraded` |
| 不渲染 | `status` 只用于分支，成功时不画出来 | `status` |

`status === "error"`：`view` 回到可编辑输入（视为 idle 变体），在按钮下显示一行 `text-red-600` 的 `error_message`。棋盘与白皮卡保持隐藏。`error_message` 为空时不渲染该行。

成功后允许再次编辑 PGN 并重新提交，覆盖结果。刷新页面一切归零。

---

## 4. DOM 组件树映射 (Component Tree)

- `<SingleScreenWorkspace>`（`h-screen overflow-hidden bg-neutral-950 text-neutral-100`，flex 列，无路由）
  - `<BrandStrip>`（顶 8%，不可点击。左：`PlyHan`。右：slogan 文本「对着红条发呆的那五分钟，把棋谱扔进来。」）
    - `<DegradedMark>`（仅 `degraded === true` 时出现，文案「已用示例局面」，`text-xs text-red-600`。绑定 `degraded`）
  - `<InputStrip>`（顶区输入，始终存在）
    - `<PgnTextarea>`（矮、`font-mono text-sm`，内部滚动。绑定本地 `pgn`，提交时作为 Request.`pgn`）
    - `<SampleLink>`（文字链「载入示例」，写入 textarea，不是导航）
    - `<SubmitButton>`（「复盘这一手」 / loading 时「正在找败着」+ disabled）
    - `<ErrorLine>`（仅 `status === "error"`。绑定 `error_message`）
  - `<LoadingStrip>`（仅 `view === "loading"`）
    - `<RedBar>`（`bg-red-600 h-1` 宽度一次过渡）
    - `<LoadingCaption>`（固定文案「正在找掉分最大的一手」）
  - `<ResultStage>`（仅 `view === "result"` 且 `status === "success"`。下半屏左右分栏，`flex-1 min-h-0`）
    - `<BoardColumn>`（左，深色棋盘区）
      - `<PlyCaption>`（绑定 `move_number` `side`）
      - `<EvalRow>`
        - `<EvalBefore>`（删除线。绑定 `eval_before`，正数前加 `+`）
        - `<EvalAfter>`（`text-red-600`。绑定 `eval_after`）
        - `<EvalDrop>`（文案「掉 {n}」。绑定 `eval_drop`）
      - `<ChessBoard>`（绑定 `fen` `from_square` `to_square`）
      - `<MovePair>`
        - `<UserSan>`（极大。绑定 `user_san`，`title={user_uci}`）
        - `<EngineSan>`（小。文案前缀「该走」。绑定 `engine_san`，`title={engine_uci}`）
    - `<TalkCard>`（右，`bg-white text-neutral-900 overflow-y-auto rounded-none`，卡内滚动）
      - `<TalkBlockMistake>`
        - `<TalkLabel>`（固定「错在哪」）
        - `<TalkBody>`（绑定 `mistake`）
      - `<TalkBlockPlan>`
        - `<TalkLabel>`（固定「当时该怎样」）
        - `<TalkBody>`（绑定 `plan`）
      - `<TalkBlockCue>`
        - `<TalkLabel>`（固定「下次先看什么」）
        - `<TalkBody>`（绑定 `cue`）

字段核对：`status` `error_message` `degraded` `fen` `move_number` `side` `user_san` `user_uci` `from_square` `to_square` `engine_san` `engine_uci` `eval_before` `eval_after` `eval_drop` `mistake` `plan` `cue` 均已出现。无 `user_id`、无 `content` 大字段、无 Schema 外属性。
