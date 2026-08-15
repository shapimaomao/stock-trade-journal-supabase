#!/usr/bin/env node
/**
 * Excel (旧应用导出的对账单) → Supabase 一次性导入脚本
 *
 * 用法:
 *   SUPABASE_URL=... SUPABASE_SECRET_KEY=sb_secret_... \
 *   TARGET_USER_EMAIL=you@email.com \
 *   node scripts/import-excel-to-supabase.mjs <excel文件路径>
 *
 * 说明:
 *   - 读取旧应用导出的 xlsx (表头为中文), 映射为 trades 表 snake_case 字段
 *   - 用 secret key + 指定 user_id 写入 (绕过 RLS, 仅供迁移)
 */
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import xlsxPkg from 'xlsx';
const XLSX = xlsxPkg.default ?? xlsxPkg;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const TARGET_USER_EMAIL = process.env.TARGET_USER_EMAIL;
const EXCEL_PATH = process.argv[2];

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY || !TARGET_USER_EMAIL || !EXCEL_PATH) {
  console.error('缺少参数: SUPABASE_URL / SUPABASE_SECRET_KEY / TARGET_USER_EMAIL / <excel路径>');
  process.exit(1);
}

// 中文表头 → 数据库字段
const HEADER_MAP = {
  '股票代码': 'stock_code',
  '股票名称': 'stock_name',
  '股票账户行': 'account',
  '策略名称': 'strategy_name',
  '成交日期': 'trade_date',
  '成交价格': 'price',
  '成交数量': 'quantity',
  '手续费(佣金)': 'fee',
  '发生金额': 'amount',
  '累计投入金额': 'accumulated_capital',
  '累计持仓': 'accumulated_position',
  '持仓成本': 'position_cost',
  '涨跌比(%)': 'gain_loss_ratio',
  '持仓盈亏%(%)': 'position_pnl_percent',
  '持仓盈亏': 'position_pnl',
  '累计盈亏': 'accumulated_pnl',
  '备注': 'notes',
};

// 需要反向枚举映射的字段
const ORDER_TYPE_MAP = { '限价单': 'limit', '市价单': 'market', '网格条件单': 'grid', '条件单': 'conditional' };
const ACTION_MAP = { '买入': 'buy', '卖出': 'sell', '分红': 'dividend' };
const STRATEGY_TYPE_MAP = (v) => {
  if (v === '自己策略' || v === '自己') return 'self';
  if (v === '别人的策略') return 'other';
  return v; // 自定义策略归属原样保留 (如 "自己+E大S")
};

const num = (v) => {
  if (v === '' || v === null || v === undefined) return 0;
  const n = Number(v);
  return isNaN(n) ? 0 : n;
};
const str = (v) => (v === null || v === undefined ? '' : String(v).trim());

async function main() {
  // 1. 读 Excel
  const wb = XLSX.readFile(EXCEL_PATH, { cellDates: true });
  const sheetName = wb.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: '' });
  console.log(`📄 读取 ${sheetName}: ${rows.length} 行`);

  // 2. 转换
  const records = rows.map((r) => {
    const rec = { id: randomUUID() };
    for (const [header, col] of Object.entries(HEADER_MAP)) {
      if (!(header in r)) continue;
      const v = r[header];
      if (['price', 'quantity', 'fee', 'amount', 'accumulated_capital', 'accumulated_position',
        'position_cost', 'gain_loss_ratio', 'position_pnl_percent', 'position_pnl', 'accumulated_pnl'].includes(col)) {
        rec[col] = num(v);
      } else {
        rec[col] = str(v);
      }
    }
    rec.order_type = ORDER_TYPE_MAP[str(r['委托类别'])] || 'limit';
    rec.trade_action = ACTION_MAP[str(r['买卖判断'])] || 'buy';
    rec.strategy_type = STRATEGY_TYPE_MAP(str(r['策略归属']));
    rec.trade_date = str(r['成交日期']).split(' ')[0].replace(/[\/.]/g, '-');
    return rec;
  }).filter((r) => r.stock_code && r.trade_date);

  console.log(`✅ 转换完成: ${records.length} 条有效记录`);
  if (records.length === 0) process.exit(1);

  // 3. 找到目标用户
  const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: users, error: uErr } = await supabase.auth.admin.listUsers();
  if (uErr) throw new Error(uErr.message);
  const user = users.users.find((u) => u.email === TARGET_USER_EMAIL);
  if (!user) throw new Error(`用户不存在: ${TARGET_USER_EMAIL}`);
  console.log(`👤 目标用户: ${user.email} (${user.id})`);

  // 用用户登录态写入 (set_user_id 触发器要求 auth.uid() 非空)
  const USER_PASSWORD = process.env.TARGET_USER_PASSWORD;
  if (!USER_PASSWORD) throw new Error('缺少 TARGET_USER_PASSWORD');
  const { data: sign, error: sErr } = await supabase.auth.signInWithPassword({
    email: TARGET_USER_EMAIL, password: USER_PASSWORD,
  });
  if (sErr) throw new Error('登录失败: ' + sErr.message);
  console.log('🔑 已获取用户登录态');
  const userClient = createClient(SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY, {
    global: { headers: { Authorization: `Bearer ${sign.session.access_token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 4. 分批 upsert (每批 200) — 不传 user_id, 由数据库触发器自动填充
  const BATCH = 200;
  for (let i = 0; i < records.length; i += BATCH) {
    const batch = records.slice(i, i + BATCH);
    const { error } = await userClient.from('trades').upsert(batch, { onConflict: 'id' });
    if (error) throw new Error(`写入第 ${i}-${i + batch.length} 条失败: ${error.message}`);
    console.log(`  写入 ${Math.min(i + BATCH, records.length)}/${records.length}`);
  }

  // 5. 校验
  const { count, error: cErr } = await userClient
    .from('trades').select('id', { count: 'exact', head: true });
  if (cErr) throw new Error(cErr.message);
  console.log(`\n🎉 导入完成! 数据库现有 ${count} 条 trades 记录`);
}

main().catch((err) => {
  console.error('\n❌ 导入失败:', err.message);
  process.exit(1);
});
