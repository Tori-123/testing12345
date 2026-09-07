-- 竞标赛虚拟用户：去掉对 auth.users 的外键，写入 30 个种子账号。
-- 在 Supabase SQL 编辑器执行一次。

alter table public.tournament_scores
  drop constraint if exists tournament_scores_user_id_fkey;

insert into public.tournament_scores (user_id, username, points, wins, losses)
values
  ('bc791832-85df-5153-aff4-fd8a13de2df3', '林晓舟', 2, 1, 5),
  ('7e9364f1-c72a-51df-9d5a-deaef8396bd0', '陈小北', 0, 0, 3),
  ('7d7c3ed8-5a1c-5ea3-a41e-88f402f90f78', '赵晚晴', 4, 2, 4),
  ('1338a140-7a6f-5875-af0d-5812c100bdb1', '周予安', 3, 1, 3),
  ('33ce2edc-7022-5537-9e91-9b8ad7e6e3be', '吴青禾', 6, 3, 6),
  ('75cf015d-ead2-53f8-a649-16e644715567', '郑拾光', 1, 0, 2),
  ('08a0955b-839a-59c2-9f0b-17c37efbf01a', '冯疏影', 5, 2, 5),
  ('40db0e7d-06b1-52d9-a470-764a8611c9b6', '蒋南山', 2, 1, 4),
  ('f84106fd-fb97-587c-a151-417467f8b61e', '何清越', 8, 4, 6),
  ('0906de56-6064-557e-ab54-90b48bde3f04', '罗望舒', 10, 5, 5),
  ('e7b63493-2178-5ba6-b974-ea7787e72f52', '韩听雨', 7, 3, 4),
  ('a1aad758-e717-59a2-8514-f69a37975486', '唐远舟', 12, 6, 6),
  ('bda4a8fe-ae45-51f8-99fe-80735e42f0a1', '曹暮云', 9, 4, 5),
  ('312a23a7-6c88-5de2-9e04-a8aa0242127d', '彭见山', 11, 5, 4),
  ('7a20d557-f08a-51b6-84af-b085e34c7edf', '董怀远', 6, 3, 6),
  ('2308ac58-8eb3-54af-ad62-ec3e11f17741', '袁听潮', 8, 4, 7),
  ('1b80115e-fd37-5444-9d51-943b3f0d272c', '萧知秋', 16, 8, 6),
  ('5f8984cd-56b4-5744-913d-b3d88b8e4f5f', '沈南枝', 18, 9, 5),
  ('614569d6-cbb2-58b9-a165-40d53877fc09', '吕承野', 20, 10, 6),
  ('28bc8c70-5e87-59dc-9cb9-5864ea386c80', '魏长风', 15, 7, 6),
  ('3708d464-37aa-572b-aaae-1da0f2c078ea', '崔望川', 22, 11, 5),
  ('2c8dbf61-a701-5b19-a6c8-6290752618c5', '任晚舟', 14, 6, 5),
  ('83dde0c7-2120-5c21-b1ac-49574df70b39', '苏北辰', 19, 9, 6),
  ('4cda7292-3b11-5d9a-bd0e-15a12c68a259', '钱听雪', 17, 8, 5),
  ('fe74337e-d1c7-5d2f-bff2-f259b4357cfd', '顾承安', 28, 14, 4),
  ('5e505b48-7d3f-5448-b200-b38bf54bee5a', '叶无白', 32, 16, 4),
  ('26732819-eba7-52c7-a2e3-b18c6bf903df', '陆临渊', 26, 13, 5),
  ('46a662da-584a-53f8-b51f-69d7ff3e7c5d', '谢长夜', 35, 17, 3),
  ('83b64f0c-77fb-506e-91cd-c37aef75af80', '方既见', 30, 15, 4),
  ('902fc744-b2b8-5c45-b6ab-1c1356c87381', '裴听潮', 38, 19, 3)
on conflict (user_id) do update
  set username = excluded.username,
      points = excluded.points,
      wins = excluded.wins,
      losses = excluded.losses,
      updated_at = now();
