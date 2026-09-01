# PlyHan API Schema

前后端唯一契约。无状态。禁止增加第二个业务接口。禁止 WebSocket / SSE / GraphQL。

---

## 1. API 路由定义 (Endpoint)

- Path: `POST /api/v1/analyze`
- Method: `POST`
- Description: 唯一业务接口。后端用棋规拆 PGN、调 chess-api.com 定位掉分最大的一手，再调用大模型把该局面翻译成三段中文；前端只打这一枪拿齐棋盘与讲解。

---

## 2. 请求数据结构 (Request Schema)

扁平 JSON，仅一层。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `pgn` | String | Required | 完整 PGN 文本。前端「载入示例」只负责把示例字符串写入该字段再提交。空字符串非法。 |

约束（服务端执行，不另开字段）：半步超过 80 则拒绝。无 `user_id`、无 token、无时间戳。

示例请求：

```json
{
  "pgn": "[Event \"Casual\"]\n[White \"1420rapid\"]\n[Black \"Online\"]\n[Result \"0-1\"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. d3 Bc5 5. c3 d6 6. O-O O-O 7. Nbd2 a6 8. Bb3 Ba7 9. h3 h6 10. Re1 Be6 11. Bc2 Re8 12. Nf1 d5 13. exd5 Bxd5 14. Ng3 Qd7 15. Be3 Bxe3 16. Rxe3 Rad8 17. Qe2 Qc8 18. Rd1 Rd7 19. Nf5 Ne7 20. Nxe7+ Rdxe7 21. Nxe5 Qxh3 22. g4 Qxe3+ 0-1"
}
```

（上段 PGN 仅示意请求形态；前端 Mock 以第 4 节响应为准，不必在联调前下完整合法谱。）

---

## 3. 响应数据结构 (Response Schema)

全部字段提在第一层。禁止 `data: { ... }` 包裹。禁止数组套对象。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `status` | String | Required | 仅 `"success"` 或 `"error"` |
| `error_message` | String | Required | 成功时为 `""`。失败时一句中文：如 PGN 非法、半步过多、分析失败 |
| `degraded` | Boolean | Required | `true` 表示引擎挂了、已改走预置示例局面，讲解仍可能成功 |
| `fen` | String | Required | 败着走完后的局面。失败时为 `""` |
| `move_number` | Int | Required | 回合号，如 `26`。失败时为 `0` |
| `side` | String | Required | 走出败着的一方：`"white"` 或 `"black"`。失败时为 `""` |
| `user_san` | String | Required | 用户实际着法，如 `"g4"` |
| `user_uci` | String | Required | 如 `"g2g4"` |
| `from_square` | String | Required | 高亮起点，如 `"g2"` |
| `to_square` | String | Required | 高亮终点，如 `"g4"` |
| `engine_san` | String | Required | 引擎在该手应走的着法 |
| `engine_uci` | String | Required | 如 `"e5c6"` |
| `eval_before` | Number | Required | 走败着前评估（白正）。失败时为 `0` |
| `eval_after` | Number | Required | 走败着后评估。失败时为 `0` |
| `eval_drop` | Number | Required | 对走棋方的掉分量，正数。失败时为 `0` |
| `mistake` | String | Required | 大模型：错在哪。禁止 Markdown。失败且无预写稿时为 `""` |
| `plan` | String | Required | 大模型：当时该执行什么计划 |
| `cue` | String | Required | 大模型：下次同类形状先看哪条线索 |

`status` 为 `"error"` 时：棋盘与三句讲解字段按上表置空/零，只展示 `error_message`。  
`status` 为 `"success"` 且 `degraded` 为 `true` 时：棋盘与三句仍有内容，前端可在角落标「已用示例局面」。

大模型只映射到 `mistake` / `plan` / `cue`。禁止把模型原文塞进单一 `content` 字段。

---

## 4. 前端救命稻草：逼真的 Mock JSON 数据

前端在后端接通前，用下面这一份渲染整屏。情境：高二 Rapid 1420，意大利开局后第 26 步 `g4` 赶马，无根 e 兵被吃，评估从 +1.6 掉到 -2.8。

```json
{
  "status": "success",
  "error_message": "",
  "degraded": false,
  "fen": "r1b2rk1/pp3pp1/4r2p/4N3/2BPP1Pq/3Q4/PP3P2/R3R1K1 b - - 0 26",
  "move_number": 26,
  "side": "white",
  "user_san": "g4",
  "user_uci": "g2g4",
  "from_square": "g2",
  "to_square": "g4",
  "engine_san": "Nf3",
  "engine_uci": "e5f3",
  "eval_before": 1.6,
  "eval_after": -2.8,
  "eval_drop": 4.4,
  "mistake": "你第 26 步把 g 兵推到 g4 去赶对面的后，自以为在进攻。问题是这步打开了自己王前，同时让 e 线上的兵彻底没人护。对面没有退后，直接后吃 e3 带将，你的中心和王翼一起塌。",
  "plan": "当时你并不需要赶后。马在 e5 是好马，先用马换或把后从 d3 撤到能看住 e3、顺带护王的格子。短句原则：先补自己的无根兵，再去驱赶对方的棋子。引擎这手 Nf3 是回防，不是示弱。",
  "cue": "下次想冲兵赶子之前，先问两件事：被赶的棋有没有比退让更狠的吃法；自己营地里有没有一只棋正少保护。尤其是王前兵和中心兵，少看一步就会变成今晚这种 Qxe3+。"
}
```

---

## 5. 五子棋房间（人对人）

无账号。房间存在服务端内存，TTL 约 2 小时。不调用 Rapfi。创建者自选执黑或执白，加入者拿剩下的颜色。黑方仍先走。

### `POST /api/v1/gomoku/rooms`

```json
{ "seat": "black" }
```

`seat` 为 `"black"` 或 `"white"`，默认 `"black"`。成功时返回房间码、创建者 `token` 与所选 `seat`。

### `POST /api/v1/gomoku/rooms/{code}/join`

```json
{ "token": "" }
```

`token` 可空（新白方）或带回刷新前的座位令牌。房间已满且 token 对不上则 `status` 为 `"error"`。

### `GET /api/v1/gomoku/rooms/{code}?token=`

只读快照。

房间响应第一层字段：`status` `error_message` `code` `seat` `token` `black_ready` `white_ready` `moves` `turn` `game_over` `result` `end_reason` `clock_ms` `clock_limit_ms` `restart_black` `restart_white`。`moves` 项为 `{ "row", "col", "player" }`，`player` 为 `"black"` 或 `"white"`。`end_reason` 为 `""` `"five"` `"draw"` `"resign"` `"timeout"`。双方到齐后每手 `clock_limit_ms`（默认 60000）倒计时，超时判负。创建房间时可传 `"clock": false` 关闭步时，此时 `clock_limit_ms` 为 `0`。`restart_black` / `restart_white` 表示该座位已申请再来一局；两边都为 `true` 时服务端才清空棋盘并重新计时。任意一方落子会清掉未完成的申请。

### WebSocket `/api/v1/gomoku/rooms/{code}/ws?token=`

服务端推送 `{ "type": "state", ...快照字段 }` 或 `{ "type": "error", "error_message": "..." }`。

客户端：

```json
{ "type": "move", "row": 7, "col": 7 }
```

```json
{ "type": "resign" }
```

```json
{ "type": "restart" }
```

`restart` 是投票，不是立刻重开。一方发送后快照里对应 `restart_*` 变为 `true`；另一方再发送后才 `reset`。

前端邀请链接用查询串，不引入路由库：`/?game=gomoku&r={code}`。

---

## 6. 国际象棋房间（人对人）

无账号。房间存在服务端内存，TTL 约 2 小时。不调用 chess-api。创建者自选执白或执黑，加入者拿剩下的颜色。白方仍先走。走子用 UCI。升变一律成后。

### `POST /api/v1/chess/rooms`

```json
{ "seat": "white", "clock": true }
```

`clock` 默认 `true`（每手 60 秒）；`false` 则不限时。

### `POST /api/v1/chess/rooms/{code}/join`

```json
{ "token": "" }
```

房间响应第一层字段：`status` `error_message` `code` `seat` `token` `fen` `turn` `legal_uci` `sans` `from_square` `to_square` `game_over` `result` `end_reason` `clock_ms` `clock_limit_ms` `white_ready` `black_ready` `restart_white` `restart_black`。`result` 为 `"white"` `"black"` `"draw"` 或空。`end_reason` 为 `""` `"mate"` `"draw"` `"resign"` `"timeout"`。再来一局同样要双方 `restart` 投票。

### WebSocket `/api/v1/chess/rooms/{code}/ws?token=`

```json
{ "type": "move", "uci": "e2e4" }
```

```json
{ "type": "resign" }
```

```json
{ "type": "restart" }
```

邀请链接：`/?game=chess&r={code}`。

---

## 7. 中国象棋房间（人对人）

无账号。房间存在服务端内存，TTL 约 2 小时。不调用 Pikafish。创建者自选执红或执黑，加入者拿剩下的颜色。红方仍先走。走子用 UCI（如 `b2e2`）。

### `POST /api/v1/xiangqi/rooms`

```json
{ "seat": "red" }
```

房间字段与国际象棋房间相同，另有 `red_ready` `restart_red`。`turn` / `result` 用 `"red"` `"black"`。

邀请链接：`/?game=xiangqi&r={code}`。
