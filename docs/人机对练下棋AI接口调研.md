# 人机对练下棋 AI 可用接口调研

- 调研日期：2026-08-24
- 范围：国际象棋、中国象棋、围棋
- 目的：找出能直接接到自己程序里、用于「人走一步 → AI 回一步」的接口
- 本文不做产品方案，只记录可用接口与实测结果

---

## 结论

真正开箱即用的 **HTTP API** 主要集中在国际象棋。中国象棋有云开局库，但中残局要靠本地引擎。围棋几乎没有稳定的公共免费云引擎 API。

| 棋种 | 现在就能 HTTP 调用 | 适合完整对练 | 本地引擎备选 |
| --- | --- | --- | --- |
| 国际象棋 | [chess-api.com](https://chess-api.com/)（Stockfish 18） | 是 | WASM Stockfish、Maia UCI |
| 国际象棋（像人） | Lichess 挑战 Maia bot | 是（走平台，不是单局面 API） | Maia-3 UCI |
| 中国象棋 | [chessdb.cn 云库](http://www.chessdb.cn/cloudbook_api.html) | 仅开局较稳 | Pikafish（UCI） |
| 围棋 | 无广泛可用的公共云引擎 API | 否 | KataGo（GTP / JSON） |

**不要用：** Chess.com 公开接口（只读，不能走子）、Lichess `cloud-eval`（缓存评估，不是对练引擎）、LLM 直接下棋（易出非法着）。

---

## 1. 国际象棋

### 1.1 chess-api.com（优先推荐）

云端 Stockfish 18。把当前局面（FEN）发出去，拿回 AI 着法。最适合自己做棋盘做人机对练。

| 项 | 内容 |
| --- | --- |
| REST | `POST https://chess-api.com/v1` |
| WebSocket | `wss://chess-api.com/v1` |
| 鉴权 | 免费档无需 key |
| 文档 | https://chess-api.com/ |
| 2026-08-24 实测 | 开局 FEN 返回 `move: "d2d4"`，`eval: 0.3`，可用 |

请求示例：

```bash
curl -X POST https://chess-api.com/v1 \
  -H "Content-Type: application/json" \
  -d '{
    "fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    "depth": 8,
    "maxThinkingTime": 50,
    "variants": 1
  }'
```

常用请求字段：

| 字段 | 说明 |
| --- | --- |
| `fen` | 当前局面，FEN 字符串 |
| `depth` | 搜索深度，免费档约 1–18，默认 12 |
| `maxThinkingTime` | 思考时间（毫秒），免费档上限约 100 |
| `variants` | 候选着数量，最多约 5 |

常用返回字段：

| 字段 | 说明 |
| --- | --- |
| `move` / `lan` | UCI 着法，如 `d2d4` |
| `san` | 短代数记谱，如 `d4` |
| `from` / `to` | 起点、终点格子 |
| `eval` | 局面评估（负值表示黑优） |
| `centipawns` | 以百分兵为单位的评估 |
| `winChance` | 白胜率估计 |
| `depth` | 实际搜索深度 |
| `continuationArr` | 后续变化 |

难度粗调：`depth` 1–3 偏入门，7–9 中级，12 约 2300 Elo 量级。这是「限时/限深度的最强引擎」，棋风不像人类。免费档思考时间很短，无官方 SLA，个人项目可用。

浏览器也可直接 `fetch`，官方文档按前端 JavaScript 设计。

---

### 1.2 Lichess API

文档：https://lichess.org/api  
基址：`https://lichess.org`  
限流：不要并发狂打；收到 429 需等待约 1 分钟。本次调研环境请求 `cloud-eval` 时被限流（Too many requests）。

| 能力 | 端点 | 适不适合人机对练 |
| --- | --- | --- |
| 挑战 Bot / 人 | `POST /api/challenge/{username}` | 适合。可挑战 `maia1` / `maia5` / `maia9` |
| 人类客户端走子 | Board API（OAuth 范围 `board:play`） | 适合自己做棋盘去打 Lichess 上的 bot |
| 程序当 bot | Bot API（需把账号升级为 bot） | 反了：是「你的 AI 去打别人」 |
| 云评估缓存 | `GET /api/cloud-eval?fen=` | 不适合当对练引擎。开局常见局面有缓存，中残局常 404 |
| 残局库 | `https://tablebase.lichess.ovh` | 辅助。标准棋 7 子以内完美着法 |
| 开局统计 | `https://explorer.lichess.ovh` | 统计着法，不是 AI 对练 |

挑战像人的 bot 的思路：申请 [Personal Access Token](https://lichess.org/account/oauth/token) → `POST /api/challenge/maia5` → 用 Board API 流式收棋、提交走子。

Lichess 在线 Maia：

| 账号 | 大致等级 |
| --- | --- |
| [@maia1](https://lichess.org/@/maia1) | 约 1100 |
| [@maia5](https://lichess.org/@/maia5) | 约 1500 |
| [@maia9](https://lichess.org/@/maia9) | 约 1900 |

---

### 1.3 没有官方托管 HTTP、但可本地接

**Maia / Maia-3**  
训练目标是「预测该等级人类会怎么走」，比 Stockfish 更适合练棋。本地用 UCI：Maia 1 需 [lc0](https://lczero.org) + 权重；[Maia-3](https://github.com/CSSLab/maia3) 可当 UCI 引擎。没有官方云 HTTP。

**浏览器 WASM Stockfish**  
[stockfish.js](https://github.com/nmrugg/stockfish.js)（Stockfish 18）。Web Worker 跑，零服务器、零费用。难度用 `Skill Level` / `depth` / `movetime`。不算云 API，但是 Web 人机最稳的方案之一。

**自托管 Stockfish HTTP**  
例如 [tim-bits/stockfishweb](https://github.com/tim-bits/stockfishweb)：自己跑进程，对外暴露 REST。协议底层仍是 UCI。

---

### 1.4 不推荐当主方案

- **RapidAPI「Chess StockFish 16」**：`POST /best-move`，要付费 key，稳定性不如 chess-api.com 或自托管。
- **Chess.com Published Data API**：只读对局/玩家数据，**不能走子、不能对人机**。

---

## 2. 中国象棋

### 2.1 中国象棋云库 chessdb.cn（可用 HTTP）

公开云开局库 / 部分计算缓存。不用 key。适合开局自动出步，**不是完整对局引擎**。

| 项 | 内容 |
| --- | --- |
| 基址 | `http://www.chessdb.cn/chessdb.php` |
| 备用 | `http://api.chessdb.cn:81/chessdb.php` |
| 文档 | http://www.chessdb.cn/cloudbook_api.html |
| 2026-08-24 实测 | `action=querybest` 初始局面返回 `move:c3c4`，可用 |

请求格式：

```
GET http://www.chessdb.cn/chessdb.php?action={ACTION}&board={FEN}
```

实测示例：

```bash
curl --get "http://www.chessdb.cn/chessdb.php" \
  --data-urlencode "action=querybest" \
  --data-urlencode "board=rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w"
```

常用 `action`：

| action | 作用 | 对练建议 |
| --- | --- | --- |
| `querybest` | 最佳着 | 每盘容易重复 |
| `query` | 随机/候选着 | 更适合对练 |
| `queryall` | 所有已知着法 + 分值/胜率 | 展示候选 |
| `queryscore` | 评估分 | 分析用 |
| `querypv` | 思考变化 | 分析用 |
| `queryrule` | 棋规裁定（循环/犯规） | 规则辅助 |
| `queue` | 提交后台计算 | 非即时出步 |

返回可能是 `move:c3c4`，也可能是 `unknown` / `nobestmove` / `invalid board` / `checkmate`。中残局未入库时必须改走本地引擎。

对练组合：开局走云库 `query`，云库没有着再交给 Pikafish。

---

### 2.2 Pikafish（皮卡鱼）— 本地 UCI，无官方 HTTP

当前最强开源中国象棋引擎（Stockfish 衍生，NNUE）。

| 项 | 内容 |
| --- | --- |
| 官网 | https://www.pikafish.com/ |
| GitHub | https://github.com/official-pikafish/Pikafish |
| 协议 | 本地 UCI（stdin/stdout） |
| 官方 HTTP | 无 |

自己包一层 HTTP 即可当对练后端。难度用 `Skill Level` / `depth` / `movetime`。二进制旁必须放对 `EvalFile`（`.nnue`），否则引擎会退出。

同类：Fairy-Stockfish（多棋种，含象棋，UCI/UCCI）。棋力一般认为不如 Pikafish。

LLM 下象棋能接 OpenAI 兼容 API，但会非法着、棋力不稳，只适合玩具。

---

## 3. 围棋

### 3.1 KataGo（事实标准，仅本地）

没有广泛使用的公共免费云 HTTP（算力贵）。标准做法：本机或服务器跑 KataGo，再自己暴露 REST。

两种本地模式：

| 模式 | 协议 | 适合 |
| --- | --- | --- |
| GTP | `play` / `genmove` | 一来一回对弈 |
| Analysis Engine | 逐行 JSON | 做成自己的 `/analyze` 或 `/move` |

macOS 可用 `brew install katago`（Metal）。权重从 https://katagotraining.org/ 下载。9 路、超大棋盘需单独网络。

Analysis Engine 请求形态（需自己起进程后读写 stdin/stdout）：

```json
{
  "id": "query1",
  "moves": [["B", "Q16"], ["W", "D4"]],
  "rules": "chinese",
  "komi": 7.5,
  "boardXSize": 19,
  "boardYSize": 19,
  "maxVisits": 400
}
```

---

### 3.2 OGS（Online Go Server）

人可以在 https://online-go.com/ 上下平台 bot。  
开发者侧是 [gtp2ogs](https://github.com/online-go/gtp2ogs)：把本地 KataGo 挂成 OGS bot（需要独立 bot 账号、管理员标记、API key）。

这是「把你的 AI 接到平台」，不是「调用别人的云引擎 HTTP」。

野狐、弈城等国内平台基本没有稳定、文档化的第三方对弈 API。

---

## 4. 按场景怎么选

1. **只要国际象棋、尽快调通一手**：`POST https://chess-api.com/v1`，传 FEN，读 `move`。
2. **国际象棋练棋、对手像人**：Lichess 挑战 Maia；或本地 Maia-3 UCI。
3. **Web 端不想依赖云**：浏览器 WASM Stockfish。
4. **中国象棋**：开局 chessdb.cn；中残局 Pikafish 本地 UCI。不要指望单一云 API 下完整一盘。
5. **围棋**：本机/服务器 KataGo，不要等公共云 API。

---

## 5. 实测记录（2026-08-24）

| 接口 | 结果 |
| --- | --- |
| `POST https://chess-api.com/v1` 开局 FEN、depth=8 | 成功。`d2d4`，`eval=0.3`，`depth=8` |
| `GET https://lichess.org/api/cloud-eval?...` 开局 FEN | 本环境 429 Too many requests。接口本身存在，需注意限流 |
| `GET http://www.chessdb.cn/chessdb.php?action=querybest&board=...` | 成功。`move:c3c4` |

---

## 6. 参考链接

- chess-api.com：https://chess-api.com/
- Lichess API：https://lichess.org/api
- Maia：https://www.maiachess.com/
- Maia-3：https://github.com/CSSLab/maia3
- stockfish.js：https://github.com/nmrugg/stockfish.js
- 中国象棋云库文档：http://www.chessdb.cn/cloudbook_api.html
- Pikafish：https://www.pikafish.com/
- KataGo：https://github.com/lightvector/KataGo
- OGS gtp2ogs：https://github.com/online-go/gtp2ogs
