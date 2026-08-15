#!/usr/bin/env node
/**
 * 细化验证: 在 H1(成本法) 基础上测试变体
 *   V1: 卖出时 capital -= unitCost*qty (fee 不计)             [当前代码]
 *   V2: 卖出时 capital = capital - unitCost*qty + fee (fee 计入本金)
 *   两变体均在 pos 归零时 capital=0
 * 累计盈亏变体:
 *   P1: realized = (amount - fee) - unitCost*qty
 *   P2: realized = amount - unitCost*qty
 *   P3: realized = (price - prevCost)*qty - fee   (同 P1)
 * 分红: realized = amount (fee=0)
 */
import xlsxPkg from 'xlsx';
const XLSX = xlsxPkg.default ?? xlsxPkg;

const EXCEL_PATH = process.argv[2] || process.env.HOME + '/Downloads/股市对账单_交易明细.xlsx';
const wb = XLSX.readFile(EXCEL_PATH, { cellDates: true });
const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
const num = (v) => { const n = Number(v); return isNaN(n) ? 0 : n; };
const str = (v) => (v === null || v === undefined ? '' : String(v).trim());

const groups = new Map();
rows.forEach((r, idx) => {
  const code = str(r['股票代码']);
  const date = str(r['成交日期']).split(' ')[0].replace(/[\/.]/g, '-');
  if (!code || !date) return;
  if (!groups.has(code)) groups.set(code, []);
  groups.get(code).push({ r, idx, date });
});

const r3 = (x) => Math.round(x * 1000) / 1000;
const stats = { capV1: 0, capV2: 0, total: 0, costV1: 0, costV2: 0, pnl1: 0, pnl2: 0 };
const capMismatch = [], pnlMismatch = [];

for (const [code, list] of groups) {
  let cap1 = 0, cap2 = 0, pos = 0, pnl1 = 0, pnl2 = 0;
  for (const { r, idx, date } of list) {
    const action = str(r['买卖判断']);
    const price = num(r['成交价格']);
    const qty = num(r['成交数量']);
    const fee = action === '分红' ? 0 : num(r['手续费(佣金)']);
    const amount = price * qty;
    const excelCap = num(r['累计投入金额']);
    const excelCost = num(r['持仓成本']);
    const excelPnl = num(r['累计盈亏']);
    const u1 = pos > 0 ? cap1 / pos : 0;
    const u2 = pos > 0 ? cap2 / pos : 0;

    let p1 = 0, p2 = 0;
    if (action === '买入') {
      pos += qty; cap1 += amount + fee; cap2 += amount + fee;
      p1 = -fee; p2 = -fee;
    } else if (action === '卖出') {
      const newPos = Math.max(0, pos - qty);
      cap1 -= u1 * qty; if (newPos === 0) cap1 = 0;
      cap2 = cap2 - u2 * qty + fee; if (newPos === 0) cap2 = 0;
      p1 = (amount - fee) - u1 * qty;
      p2 = amount - u2 * qty;
      pos = newPos;
    } else {
      p1 = amount; p2 = amount;
    }
    pnl1 += p1; pnl2 += p2;

    const c1 = pos > 0 ? cap1 / pos : 0;
    const c2 = pos > 0 ? cap2 / pos : 0;
    stats.total++;
    if (Math.abs(r3(cap1) - r3(excelCap)) < 0.01) stats.capV1++; else if (capMismatch.length < 8) capMismatch.push({ code, date, idx, action, excel: r3(excelCap), v1: r3(cap1), v2: r3(cap2) });
    if (Math.abs(r3(cap2) - r3(excelCap)) < 0.01) stats.capV2++;
    if (Math.abs(r3(c1) - r3(excelCost)) < 0.005) stats.costV1++;
    if (Math.abs(r3(c2) - r3(excelCost)) < 0.005) stats.costV2++;
    if (Math.abs(r3(pnl1) - r3(excelPnl)) < 0.01) stats.pnl1++; else if (pnlMismatch.length < 8) pnlMismatch.push({ code, date, idx, action, excel: r3(excelPnl), p1: r3(pnl1), p2: r3(pnl2), u1: r3(u1) });
    if (Math.abs(r3(pnl2) - r3(excelPnl)) < 0.01) stats.pnl2++;
  }
}

console.log(`共 ${stats.total} 笔`);
console.log(`累计投入本金: V1(费不计本金,清仓归零)=${stats.capV1}  V2(费计本金,清仓归零)=${stats.capV2}`);
console.log(`持仓成本:     V1=${stats.costV1}  V2=${stats.costV2}`);
console.log(`累计盈亏:     P1(净卖-成本-费)=${stats.pnl1}  P2(卖金额-成本)=${stats.pnl2}`);
console.log('\nV1 本金不匹配样本:'); capMismatch.forEach(m => console.log(m));
console.log('\nP1 盈亏不匹配样本:'); pnlMismatch.forEach(m => console.log(m));
