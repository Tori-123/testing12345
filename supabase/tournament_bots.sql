-- 竞标赛虚拟用户：去掉对 auth.users 的外键，写入 30 个种子账号。
-- 在 Supabase SQL 编辑器执行一次。

alter table public.tournament_scores
  drop constraint if exists tournament_scores_user_id_fkey;

delete from public.tournament_scores
where username in (
  '林晓舟', '陈小北', '赵晚晴', '周予安', '吴青禾', '郑拾光', '冯疏影', '蒋南山',
  '何清越', '罗望舒', '韩听雨', '唐远舟', '曹暮云', '彭见山', '董怀远', '袁听潮',
  '萧知秋', '沈南枝', '吕承野', '魏长风', '崔望川', '任晚舟', '苏北辰', '钱听雪',
  '顾承安', '叶无白', '陆临渊', '谢长夜', '方既见', '裴听潮'
);

insert into public.tournament_scores (user_id, username, points, wins, losses)
values
  ('e716ee1e-d9cb-5151-920e-e4e33a5dada7', 'baozi88', 2, 1, 5),
  ('6e897b41-c81a-52b3-8cda-f4fd8cdcd8d9', '路过看看', 0, 0, 3),
  ('93d44393-a24f-505c-9d24-0b47cef4f47d', 'qian2qian', 4, 2, 4),
  ('9e4e43ee-eb1d-584b-91c3-c9397f4c0d7d', '不想取名', 3, 1, 3),
  ('3efc3b73-a527-55a3-956f-cea275fdcb45', 'lei4k2', 6, 3, 6),
  ('625c8111-128a-5263-896d-0756b9ff95b2', '摸鱼选手', 1, 0, 2),
  ('01e45d38-38b1-523f-87e0-3cb3b6e8a092', 'napping', 5, 2, 5),
  ('1af0e8c7-df45-590f-8eaa-56e2ead4e28a', 'xiaobei7', 2, 1, 4),
  ('a5dee565-cd5d-5475-85c1-abf55fb74b9d', 'xQuietPawnx', 8, 4, 6),
  ('1a78c825-08ef-5f14-abcd-4177107e6f5b', '今晚开一局', 10, 5, 5),
  ('3659b725-241c-576f-b017-30a9cd69dd3c', 'minghao92', 7, 3, 4),
  ('0e62b6f7-5e37-55c9-972e-f3a92bcf5523', '菜就多练', 12, 6, 6),
  ('b64980c8-9b07-5b40-8821-077f4a295641', 'GRUFFPIRATE', 9, 4, 5),
  ('0c264737-4159-5e6e-bb1e-55025396a963', 'junpark', 11, 5, 4),
  ('18da857d-0bf9-532b-b38b-61838f799bf6', '随便一把', 6, 3, 6),
  ('48588e37-d772-5bcd-af71-8be7e566ba15', 'VRookV', 8, 4, 7),
  ('a31ebc5c-b188-51c3-949c-d39abfb0d7cf', 'NightOwl9', 16, 8, 6),
  ('c5e76ce7-13f6-54a0-9de5-f48eea5c0540', '老王爱下棋', 18, 9, 5),
  ('9a874475-5fb6-5a9c-8fc9-8824ebe5ac90', 'adrianchen', 20, 10, 6),
  ('c2cc7297-a617-5530-bd91-9dd0eb21c73b', '躺平第一', 15, 7, 6),
  ('3edba3b7-ea7d-5476-850e-b80ab683cd98', 'xRedRiverx', 22, 11, 5),
  ('046119ca-54b0-578f-bee1-4161107fc091', '啊这能赢', 14, 6, 5),
  ('360b9037-8c55-50a2-a72d-9ca9d8185e96', 'Kaito3b', 19, 9, 6),
  ('d6faa8cb-8da9-5265-bde5-a53d22f5934e', 'pawnstorm', 17, 8, 5),
  ('54a0de4b-9ca5-5f3e-a660-2421744a0918', 'slowdrip', 28, 14, 4),
  ('2d42811b-ecb3-5b16-926f-7d1f824aa9e3', '新手求放过', 32, 16, 4),
  ('f2113f5e-9ebb-5469-9820-2503ad9c9991', 'SILENTMOVE', 26, 13, 5),
  ('bec3e4f7-5f8d-5c24-a709-05929372bdc5', '棋盘上睡觉', 35, 17, 3),
  ('0e4ff573-c085-555d-a9f1-2b3b896b118c', 'xEndgamex', 30, 15, 4),
  ('6b228ebe-7641-5efc-9c09-b8c05a5e583a', 'blitz4fun', 38, 19, 3)
on conflict (user_id) do update
  set username = excluded.username,
      points = excluded.points,
      wins = excluded.wins,
      losses = excluded.losses,
      updated_at = now();
