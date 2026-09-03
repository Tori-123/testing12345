-- ============================================================
-- 竞标赛积分表 + 排行榜（Supabase SQL 编辑器里执行一次）
-- 说明：
--   - 读取：任何人都能读（匿名可读排行榜），因为榜单要在登录/未登录都能看。
--   - 写入：仅允许 service_role（后端持有，前端绝不暴露），anon/authenticated 一律拒绝，
--     避免用户自行改分。
-- ============================================================

create table if not exists public.tournament_scores (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  username   text not null,
  points     integer not null default 0,
  wins       integer not null default 0,
  losses     integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.tournament_scores enable row level security;

-- 任何人可读（排行榜）
drop policy if exists "public read tournament leaderboard" on public.tournament_scores;
create policy "public read tournament leaderboard"
  on public.tournament_scores
  for select
  using (true);

-- 拒绝 anon/authenticated 写入，只允许 service_role（绕过 RLS）
drop policy if exists "no anon write tournament scores" on public.tournament_scores;
create policy "no anon write tournament scores"
  on public.tournament_scores
  for all
  using (false)
  with check (false);

-- 原子加分函数：胜 +delta，负 -delta，分数最低为 0。由后端 service_role 调用。
create or replace function public.bump_score(
  p_uid uuid,
  p_username text,
  p_delta integer,
  p_win boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.tournament_scores (user_id, username, points, wins, losses)
  values (
    p_uid,
    p_username,
    greatest(coalesce(p_delta, 0), 0),
    case when p_win then 1 else 0 end,
    case when coalesce(p_win, false) then 0 else 1 end
  )
  on conflict (user_id) do update
    set points     = greatest(public.tournament_scores.points + coalesce(p_delta, 0), 0),
        username   = excluded.username,
        wins       = public.tournament_scores.wins   + excluded.wins,
        losses     = public.tournament_scores.losses + excluded.losses,
        updated_at = now();
end $$;

-- 排行榜查询：后端/前端均可直接 select，按积分降序
-- select username, points, wins, losses
-- from public.tournament_scores
-- order by points desc, username asc
-- limit 50;
