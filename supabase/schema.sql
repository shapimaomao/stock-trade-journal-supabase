-- ============================================================
-- 股票交易日志 - Supabase 数据库 Schema
-- 用于从 Firebase Firestore 迁移
-- 安全模型: 邮箱+密码登录 + RLS 行级安全，仅本人可访问
-- ============================================================

-- 扩展 (UUID 生成)
create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- 1. trades 表 (交易记录)
-- ------------------------------------------------------------
drop table if exists public.trades cascade;
create table public.trades (
  id text primary key,                 -- 保留原 trade_xxx / imp_xxx / demo_xxx 格式
  user_id uuid not null,               -- 归属用户 (auth.users.id)
  stock_code text not null,
  stock_name text not null,
  account text,
  strategy_name text,
  strategy_type text,
  trade_date text,                     -- YYYY-MM-DD 或 YYYY-MM-DD HH:mm
  order_type text,
  trade_action text,                   -- buy / sell / dividend
  fee double precision default 0,
  price double precision default 0,
  quantity double precision default 0,
  amount double precision default 0,
  accumulated_capital double precision default 0,
  accumulated_position double precision default 0,
  position_cost double precision default 0,
  gain_loss_ratio double precision default 0,
  position_pnl_percent double precision default 0,
  position_pnl double precision default 0,
  accumulated_pnl double precision default 0,
  final_pnl double precision,
  final_return_rate double precision,
  total_buy_cost double precision,
  total_sell_net double precision,
  notes text,
  notes_completed boolean default false,
  is_pending_confirmation boolean default false,
  asset_type text,                     -- stock / etf / fund
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_trades_user on public.trades (user_id);
create index idx_trades_user_date on public.trades (user_id, trade_date desc);

-- ------------------------------------------------------------
-- 2. grid_configs 表 (网格策略配置)
-- ------------------------------------------------------------
drop table if exists public.grid_configs cascade;
create table public.grid_configs (
  id text primary key,                 -- 保留原 id
  user_id uuid not null,
  stock_code text not null,
  stock_name text not null,
  account text,
  strategy_name text,
  step_percent double precision default 0,
  grid_quantity double precision default 0,
  grid_amount double precision,
  upper_price double precision,
  lower_price double precision,
  base_price double precision,
  image_url text,                      -- Base64 截图数据
  notes text,
  updated_at timestamptz default now()
);

create index idx_grid_configs_user on public.grid_configs (user_id);
create index idx_grid_configs_user_code on public.grid_configs (user_id, stock_code);

-- ------------------------------------------------------------
-- 3. RLS 行级安全策略 (核心安全)
--    仅允许已登录的本人 (auth.uid() = user_id) 访问自己的数据
-- ------------------------------------------------------------
alter table public.trades enable row level security;
alter table public.grid_configs enable row level security;

-- trades: 全部操作(增删改查)仅限本人
create policy "trades_select_own" on public.trades
  for select using (auth.uid() = user_id);

create policy "trades_insert_own" on public.trades
  for insert with check (auth.uid() = user_id);

create policy "trades_update_own" on public.trades
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "trades_delete_own" on public.trades
  for delete using (auth.uid() = user_id);

-- grid_configs: 全部操作(增删改查)仅限本人
create policy "grid_configs_select_own" on public.grid_configs
  for select using (auth.uid() = user_id);

create policy "grid_configs_insert_own" on public.grid_configs
  for insert with check (auth.uid() = user_id);

create policy "grid_configs_update_own" on public.grid_configs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "grid_configs_delete_own" on public.grid_configs
  for delete using (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 4. 实时订阅权限 (Supabase Realtime)
--    开启后前端可实时同步其他设备的变更
-- ------------------------------------------------------------
alter publication supabase_realtime add table public.trades;
alter publication supabase_realtime add table public.grid_configs;

-- 触发器: 自动更新 updated_at
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- 触发器: 插入时强制 user_id = 当前登录用户
-- 防止客户端伪造 user_id 访问他人数据 (配合 RLS 双重保险)
create or replace function public.set_user_id()
returns trigger as $$
begin
  new.user_id = auth.uid();
  return new;
end;
$$ language plpgsql security definer;

create trigger trg_trades_user_id before insert on public.trades
  for each row execute function public.set_user_id();

create trigger trg_grid_configs_user_id before insert on public.grid_configs
  for each row execute function public.set_user_id();

create trigger trg_trades_updated_at before update on public.trades
  for each row execute function public.set_updated_at();

create trigger trg_grid_configs_updated_at before update on public.grid_configs
  for each row execute function public.set_updated_at();
