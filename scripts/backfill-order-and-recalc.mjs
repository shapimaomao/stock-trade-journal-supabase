#!/usr/bin/env node
/**
 * 一次性修正脚本:
 * 1. 按 Excel 行序回填 created_at (同日多笔交易的先后顺序依据)
 * 2. 用与前端 calculator.ts 相同的口径 (成本法 + 清仓归零 + 输入顺序)
 *    重算 accumulated_capital / accumulated_position / position_cost /
 *    gain_loss_ratio / position_pnl / position_pnl_percent / accumulated_pnl /
 *    final_pnl / final_return_rate / total_buy_cost / total_sell_net
 * 3. 回写 Supabase
 *
 * 用法:
 *   node scripts/backfill-order-and-recalc.mjs <excel路径> [--dry]
 * 环境变量:
 *   SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY / TARGET_USER_EMAIL / TARGET_USER_PASSWORD
 */
import xlsxPkg from 'xlsx';
import { createClient } from '@supabase/supabase-js';
const XLSX = xlsxPkg.default ?? xlsxPkg;

const DRY = process.argv.includes('--dry');
const EXCEL_PATH = process.argv[2];
const SUPABASE_URL = process.env.SUPABASE_URL;
const PK = process.env.SUPABASE_PUBLISHABLE_KEY;
const EMAIL = process.env.TARGET_USER_EMAIL;
const PASSWORD = process.env.TARGET_USER_PASSWORD;

if (!EXCEL_PATH || !SUPABASE_URL || !PK || !EMAIL || !PASSWORD) {
  console.error('缺少参数: EXCEL_PATH / SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY / TARGET_USER_EMAIL / TARGET_USER_PASSWORD');
  process.exit(1);
}

const num = (v) => { const n = Number(v); return isNaN(n) ? 0 : n; };
const str = (v) => (v === null || v === undefined ? '' : String(v).trim());
const r3 = (x) => Math.round(x * 1000) / 1000;
const r2 = (x) => Math.round(x * 100) / 100;
const ACTION_MAP = { '买入': 'buy', '卖出': 'sell', '分红': 'dividend' };

// created_at 回填基准: 2000-01-01T00:00:00Z + 行号×60秒 (1462 行约跨 61 天, 均早于任何真实时间戳)
const BASE_MS = Date.parse('2000-01-01T00:00:00Z');

// ---------- 1. 读 Excel, 生成带行号顺序的记录 ----------
const wb = XLSX.readFile(EXCEL_PATH, { cellDates: true });
const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
console.log(`📄 Excel 读取 ${rows.length} 行`);

const excelRecs = [];
rows.forEach((r, idx) => {
  const code = str(r['股票代码']);
  const date = str(r['成交日期']).split(' ')[0].replace(/[\/.]/g, '-');
  if (!code || !date) return;
  excelRecs.push({
    seq: idx,
    key: `${code}|${date}|${ACTION_MAP[str(r['买卖判断'])] || 'buy'}|${num(r['成交价格'])}|${num(r['成交数量'])}`,
  });
});
console.log(`✅ 有效 Excel 记录 ${excelRecs.length} 条`);

// ---------- 2. 登录 ----------
const anon = createClient(SUPABASE_URL, PK, { auth: { autoRefreshToken: false, persistSession: false } });
const { data: sign, error: sErr } = await anon.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
if (sErr) throw new Error('登录失败: ' + sErr.message);
const db = createClient(SUPABASE_URL, PK, {
  global: { headers: { Authorization: `Bearer ${sign.session.access_token}` } },
  auth: { autoRefreshToken: false, persistSession: false },
});
console.log('🔑 登录成功:', sign.session.user.email);

// ---------- 3. 拉取全部 DB 记录 ----------
const all = [];
const PAGE = 500;
for (let from = 0; ; from += PAGE) {
  const { data, error } = await db.from('trades').select('*').range(from, from + PAGE - 1).order('trade_date', { ascending: true });
  if (error) throw new Error(error.message);
  all.push(...data);
  if (data.length < PAGE) break;
}
console.log(`☁️ 数据库现有 ${all.length} 条`);

// ---------- 4. Excel 行 → DB 行 匹配 (同 key 依序弹出) ----------
const pool = new Map(); // key -> [row, ...]
for (const row of all) {
  const k = `${row.stock_code}|${row.trade_date}|${row.trade_action}|${num(row.price)}|${num(row.quantity)}`;
  if (!pool.has(k)) pool.set(k, []);
  pool.get(k).push(row);
}
let matched = 0, unmatchedExcel = [];
for (const rec of excelRecs) {
  const q = pool.get(rec.key);
  if (q && q.length > 0) {
    const row = q.shift();
    row._newCreated = new Date(BASE_MS + rec.seq * 60000).toISOString();
    matched++;
  } else {
    unmatchedExcel.push(rec.key);
  }
}
const manualRows = all.filter(r => !r._newCreated); // 导入后手动新增的记录
console.log(`🔗 匹配成功 ${matched}/${excelRecs.length}; Excel 未匹配 ${unmatchedExcel.length}; 手动新增保留 ${manualRows.length}`);
if (unmatchedExcel.length) console.log('   未匹配样本:', unmatchedExcel.slice(0, 5));

// ---------- 5. 按 (股票, 日期, created_at) 重算 ----------
const groups = new Map();
for (const row of all) {
  const code = row.stock_code || 'UNKNOWN';
  if (!groups.has(code)) groups.set(code, []);
  groups.get(code).push(row);
}

const updates = [];
let posMismatchBefore = 0;

for (const list of groups.values()) {
  list.sort((a, b) => {
    const da = String(a.trade_date).localeCompare(String(b.trade_date));
    if (da !== 0) return da < 0 ? -1 : 1;
    const ca = Date.parse(a._newCreated || a.created_at || 0) || 0;
    const cb = Date.parse(b._newCreated || b.created_at || 0) || 0;
    return ca - cb;
  });

  let pos = 0, cap = 0, accPnl = 0, prevPrice = 0;
  let cycleBuy = 0, cycleSellNet = 0;

  for (const row of list) {
    const price = num(row.price), qty = num(row.quantity), fee = num(row.fee);
    const amount = price * qty;
    const isBuy = row.trade_action === 'buy';
    const isDiv = row.trade_action === 'dividend';
    const glr = (isDiv || prevPrice <= 0) ? 0 : ((price - prevPrice) / prevPrice) * 100;
    prevPrice = price;
    const prevPos = pos;
    const u = prevPos > 0 ? cap / prevPos : 0;

    let positionCost = 0, posPnl = 0, posPnlPct = 0, finalPnl, finalRate, tBuy, tSell;

    if (isDiv) {
      const netDiv = amount - fee;
      cycleSellNet += netDiv;
      accPnl += netDiv;
      positionCost = pos > 0 ? cap / pos : 0;
    } else if (isBuy) {
      pos += qty;
      cap += amount + fee;
      cycleBuy += amount + fee;
      accPnl -= fee;
      positionCost = pos > 0 ? cap / pos : 0;
      posPnl = (price - positionCost) * pos;
      posPnlPct = positionCost > 0 ? ((price - positionCost) / positionCost) * 100 : 0;
    } else {
      const netSell = amount - fee;
      cycleSellNet += netSell;
      const soldCost = u * qty;
      accPnl += netSell - soldCost;
      pos = Math.max(0, pos - qty);
      cap -= soldCost;
      if (pos <= 0) cap = 0;
      positionCost = pos > 0 ? cap / pos : 0;
      posPnl = pos > 0 ? (price - positionCost) * pos : 0;
      posPnlPct = (pos > 0 && positionCost > 0) ? ((price - positionCost) / positionCost) * 100 : 0;
      if (pos === 0 && prevPos > 0) {
        finalPnl = r2(cycleSellNet - cycleBuy);
        finalRate = cycleBuy > 0 ? r2((finalPnl / cycleBuy) * 100) : 0;
        tBuy = r2(cycleBuy);
        tSell = r2(cycleSellNet);
        cycleBuy = 0; cycleSellNet = 0;
      }
    }

    if (Math.abs(r3(num(row.accumulated_capital)) - r3(cap)) >= 0.01) posMismatchBefore++;
    if (Math.abs(r3(num(row.position_cost)) - r3(positionCost)) >= 0.005) posMismatchBefore++;

    const upd = {
      // 携带完整原始行, 避免 upsert 插入路径触发非空约束
      ...row,
      created_at: row._newCreated || row.created_at,
      amount: r3(amount),
      accumulated_capital: r3(cap),
      accumulated_position: pos,
      position_cost: r3(positionCost),
      gain_loss_ratio: r3(glr),
      position_pnl: r3(posPnl),
      position_pnl_percent: r3(posPnlPct),
      accumulated_pnl: r3(accPnl),
      ...(finalPnl !== undefined ? { final_pnl: finalPnl, final_return_rate: finalRate, total_buy_cost: tBuy, total_sell_net: tSell } : {}),
    };
    delete upd._newCreated;
    updates.push(upd);
  }
}

console.log(`📊 与库里旧值相比需修正的字段差异笔数: ${posMismatchBefore}`);
if (DRY) {
  console.log('🔍 DRY 模式, 未写入。样例修正 (前3条):');
  console.log(updates.slice(0, 3));
  process.exit(0);
}

// ---------- 6. 分批回写 ----------
const BATCH = 200;
for (let i = 0; i < updates.length; i += BATCH) {
  const batch = updates.slice(i, i + BATCH);
  const { error } = await db.from('trades').upsert(batch, { onConflict: 'id' });
  if (error) throw new Error(`写入第 ${i}-${i + batch.length} 条失败: ${error.message}`);
  console.log(`  写入 ${Math.min(i + BATCH, updates.length)}/${updates.length}`);
}
console.log(`\n🎉 完成! 已按 Excel 顺序与正确口径重算并回写 ${updates.length} 条记录`);
