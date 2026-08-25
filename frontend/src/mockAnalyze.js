/** Schema 第 4 节 Mock JSON，原样粘贴。后端接通前用这份驱动 result 态。 */
export const MOCK_SUCCESS = {
  status: "success",
  error_message: "",
  degraded: false,
  fen: "r1b2rk1/pp3pp1/4r2p/4N3/2BPP1Pq/3Q4/PP3P2/R3R1K1 b - - 0 26",
  move_number: 26,
  side: "white",
  user_san: "g4",
  user_uci: "g2g4",
  from_square: "g2",
  to_square: "g4",
  engine_san: "Nf3",
  engine_uci: "e5f3",
  eval_before: 1.6,
  eval_after: -2.8,
  eval_drop: 4.4,
  mistake:
    "你第 26 步把 g 兵推到 g4 去赶对面的后，自以为在进攻。问题是这步打开了自己王前，同时让 e 线上的兵彻底没人护。对面没有退后，直接后吃 e3 带将，你的中心和王翼一起塌。",
  plan: "当时你并不需要赶后。马在 e5 是好马，先用马换或把后从 d3 撤到能看住 e3、顺带护王的格子。短句原则：先补自己的无根兵，再去驱赶对方的棋子。引擎这手 Nf3 是回防，不是示弱。",
  cue: "下次想冲兵赶子之前，先问两件事：被赶的棋有没有比退让更狠的吃法；自己营地里有没有一只棋正少保护。尤其是王前兵和中心兵，少看一步就会变成今晚这种 Qxe3+。",
};

/** 写死的错误响应。临时触发：textarea 只写 `error` 再提交，或把 FORCE_ERROR_MOCK 改为 true。 */
export const FORCE_ERROR_MOCK = false;

export const MOCK_ERROR = {
  status: "error",
  error_message: "先截到败着附近再贴",
  degraded: false,
  fen: "",
  move_number: 0,
  side: "",
  user_san: "",
  user_uci: "",
  from_square: "",
  to_square: "",
  engine_san: "",
  engine_uci: "",
  eval_before: 0,
  eval_after: 0,
  eval_drop: 0,
  mistake: "",
  plan: "",
  cue: "",
};

export const SAMPLE_PGN =
  '[Event "Casual"]\n[White "1420rapid"]\n[Black "Online"]\n[Result "0-1"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. d3 Bc5 5. c3 d6 6. O-O O-O 7. Nbd2 a6 8. Bb3 Ba7 9. h3 h6 10. Re1 Be6 11. Bc2 Re8 12. Nf1 d5 13. exd5 Bxd5 14. Ng3 Qd7 15. Be3 Bxe3 16. Rxe3 Rad8 17. Qe2 Qc8 18. Rd1 Rd7 19. Nf5 Ne7 20. Nxe7+ Rdxe7 21. Nxe5 Qxh3 22. g4 Qxe3+ 0-1';
