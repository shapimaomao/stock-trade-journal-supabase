# 智股手账 · 股票交易日志 (Stock Trade Journal)

个人专用的股票/ETF/基金交易对账系统。**数据存储已从 Firebase 迁移至 Supabase**，支持电脑/手机多设备访问，数据实时互通。

## 技术栈

- Vite 6 + React 19 + TypeScript + Tailwind CSS v4
- **Supabase** (PostgreSQL + Auth 邮箱密码登录 + RLS 行级安全 + Realtime)
- Recharts 图表 / xlsx Excel 导入导出

## 安全设计

- **登录**: Supabase Auth 邮箱 + 密码，无前端硬编码密码
- **数据保护**: PostgreSQL RLS 行级安全 — 仅登录用户本人可读写自己的数据
- **防伪造**: 数据库触发器强制 `user_id = auth.uid()`，客户端无法伪造归属
- **密钥管理**: anon key 公开无害（受 RLS 保护），service_role key 严禁进入前端

## 本地开发

1. 安装依赖: `npm install`
2. 创建 `.env.local`:
   ```
   VITE_SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
   VITE_SUPABASE_ANON_KEY="eyJhbGciOi..."
   ```
   (获取: Supabase Dashboard → Project Settings → API)
3. 启动: `npm run dev`

## 数据库 Schema

执行 `supabase/schema.sql` (在 Supabase Dashboard → SQL Editor 中运行):

```sql
-- 包含: trades / grid_configs 建表 + RLS 策略 + 触发器
```

## 数据迁移 (Firebase → Supabase)

详见 `scripts/migrate-firestore-to-supabase.mjs`:

```bash
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
TARGET_USER_EMAIL=you@email.com TARGET_USER_PASSWORD=strong_password \
node scripts/migrate-firestore-to-supabase.mjs
```

> ⚠️ 迁移完成后立即在 Dashboard 轮换 service_role key!

## 部署到 GitHub Pages

1. 创建 **Private 私有仓库** (资金数据, 不要公开!)
2. 推送代码
3. 仓库 Settings → Secrets and variables → Actions 添加:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
4. 推送 `main` 分支自动触发部署

## 功能

- 交易对账明细 (桌面表格 / 移动卡片)
- 收益统计图表 (胜率/回撤/盈亏分布)
- 持仓分析与清仓周期统计
- 网格策略管理
- Excel 导入导出
- 撤销/重做 (Ctrl+Z / Ctrl+Y)
