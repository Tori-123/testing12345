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
  "pgn": "[Event \"Casual\"]\n[White \"1420rapid\"]\n[Black \"Online\"]\n[Result \"0-1\"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. d3 Bc5 5. c3 d6 6. O-O O-O 7. Nbd2 a6 8. Bb3 Ba7 9. h3 h6 10. Re1 Be6 11. Bc2 Re8 12. Nf1 d5 13. exd5 Bxd5 14. Ng3 Qd7 15. Be3 Bxe3 16. Rxe3 Rad8 17. Qe2 Qc8 18. Rd1 Rd7 19. Nf5 Ne7 20. Nxe7+ Rxe7 21. Nxe5 Rde7 22. d4 c5 23. Qd3 cxd4 24. cxd4 Bb8 25. Qb3 Qxh3 26. g4 Qxe3+ 27. Kh1 Qh3+ 0-1"
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
