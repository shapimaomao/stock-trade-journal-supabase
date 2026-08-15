#!/usr/bin/env node
/**
 * Firestore → Supabase 一次性数据迁移脚本
 *
 * 用法:
 *   SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=service_role_key \
 *   TARGET_USER_EMAIL=your@email.com \
 *   TARGET_USER_PASSWORD=your_strong_password \
 *   node scripts/migrate-firestore-to-supabase.mjs
 *
 * 说明:
 *   - 通过 Firebase Auth REST API (匿名注册获取 idToken) 读取 Firestore 数据
 *   - 通过 Supabase service_role key 创建登录用户并写入数据
 *   - service_role key 仅用于本次迁移, 迁移完成后建议在 Dashboard 中轮换
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// ---------- 读取 Firebase 配置 ----------
const firebaseConfig = JSON.parse(
  readFileSync(join(root, 'firebase-applet-config.json'), 'utf-8')
);
const FIREBASE_API_KEY = firebaseConfig.apiKey;
const FIREBASE_PROJECT_ID = firebaseConfig.projectId;
const FIREBASE_DB_ID = firebaseConfig.firestoreDatabaseId;

// ---------- 读取环境变量 ----------
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TARGET_USER_EMAIL = process.env.TARGET_USER_EMAIL;
const TARGET_USER_PASSWORD = process.env.TARGET_USER_PASSWORD;

for (const [name, val] of Object.entries({
  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TARGET_USER_EMAIL, TARGET_USER_PASSWORD,
})) {
  if (!val) {
    console.error(`❌ 缺少环境变量: ${name}`);
    process.exit(1);
  }
}

const FIREBASE_AUTH_URL = 'https://identitytoolkit.googleapis.com/v1';
const FIRESTORE_URL = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/${encodeURIComponent(FIREBASE_DB_ID)}`;

// ---------- 1. 匿名登录 Firebase Auth 获取 idToken ----------
async function getFirebaseIdToken() {
  console.log('🔐 匿名登录 Firebase Auth ...');
  const res = await fetch(`${FIREBASE_AUTH_URL}/accounts:signUp?key=${FIREBASE_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ returnSecureToken: true }),
  });
  const data = await res.json();
  if (!data.idToken) {
    throw new Error(`Firebase 匿名登录失败: ${JSON.stringify(data)}`);
  }
  console.log('✅ Firebase 登录成功');
  return data.idToken;
}

// ---------- 2. 分页读取 Firestore 集合 ----------
async function fetchFirestoreCollection(token, collectionName) {
  const allDocs = [];
  let pageToken = '';
  do {
    const url = `${FIRESTORE_URL}/documents/${collectionName}?pageSize=300${pageToken ? `&pageToken=${pageToken}` : ''}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const text = await res.text();
      // 集合不存在时返回 404, 视为空
      if (res.status === 404) break;
      throw new Error(`读取 ${collectionName} 失败 (${res.status}): ${text.slice(0, 300)}`);
    }
    const data = await res.json();
    for (const doc of data.documents || []) {
      const fields = doc.fields || {};
      const record = { _firestoreId: doc.name.split('/').pop() };
      for (const [key, val] of Object.entries(fields)) {
        record[key] = decodeFirestoreValue(val);
      }
      allDocs.push(record);
    }
    pageToken = data.nextPageToken || '';
  } while (pageToken);

  console.log(`📄 读取 ${collectionName}: ${allDocs.length} 条记录`);
  return allDocs;
}

// Firestore Value → JS 值
function decodeFirestoreValue(v) {
  if (!v || typeof v !== 'object') return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return parseInt(v.integerValue, 10);
  if ('doubleValue' in v) return parseFloat(v.doubleValue);
  if ('booleanValue' in v) return v.booleanValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('nullValue' in v) return null;
  return null;
}

// ---------- 3. 字段映射: camelCase → snake_case ----------
const TRADE_FIELD_MAP = {
  stockCode: 'stock_code', stockName: 'stock_name', account: 'account',
  strategyName: 'strategy_name', strategyType: 'strategy_type',
  tradeDate: 'trade_date', orderType: 'order_type', tradeAction: 'trade_action',
  fee: 'fee', price: 'price', quantity: 'quantity', amount: 'amount',
  accumulatedCapital: 'accumulated_capital', accumulatedPosition: 'accumulated_position',
  positionCost: 'position_cost', gainLossRatio: 'gain_loss_ratio',
  positionPnLPercent: 'position_pnl_percent', positionPnL: 'position_pnl',
  accumulatedPnL: 'accumulated_pnl', finalPnL: 'final_pnl',
  finalReturnRate: 'final_return_rate', totalBuyCost: 'total_buy_cost',
  totalSellNet: 'total_sell_net', notes: 'notes',
  notesCompleted: 'notes_completed', isPendingConfirmation: 'is_pending_confirmation',
  assetType: 'asset_type', createdAt: 'created_at', updatedAt: 'updated_at',
};

const GRID_FIELD_MAP = {
  stockCode: 'stock_code', stockName: 'stock_name', account: 'account',
  strategyName: 'strategy_name', stepPercent: 'step_percent',
  gridQuantity: 'grid_quantity', gridAmount: 'grid_amount',
  upperPrice: 'upper_price', lowerPrice: 'lower_price', basePrice: 'base_price',
  imageUrl: 'image_url', notes: 'notes', updatedAt: 'updated_at',
};

function mapRecord(record, fieldMap) {
  const out = { id: record._firestoreId };
  for (const [srcKey, destKey] of Object.entries(fieldMap)) {
    if (record[srcKey] !== undefined && record[srcKey] !== null) {
      out[destKey] = record[srcKey];
    }
  }
  return out;
}

// ---------- 4. 主流程 ----------
async function main() {
  const token = await getFirebaseIdToken();

  const rawTrades = await fetchFirestoreCollection(token, 'trades');
  const rawGrids = await fetchFirestoreCollection(token, 'gridConfigs');

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 4.1 创建 / 查找登录用户
  console.log(`👤 确保用户存在: ${TARGET_USER_EMAIL}`);
  let { data: existing, error: listErr } = await supabase.auth.admin.listUsers();
  if (listErr) throw new Error(`列出用户失败: ${listErr.message}`);
  let targetUser = existing.users.find((u) => u.email === TARGET_USER_EMAIL);

  if (!targetUser) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: TARGET_USER_EMAIL,
      password: TARGET_USER_PASSWORD,
      email_confirm: true, // 自动确认邮箱, 无需收验证邮件
    });
    if (error) throw new Error(`创建用户失败: ${error.message}`);
    targetUser = data.user;
    console.log('✅ 已创建新用户');
  } else {
    console.log('ℹ️ 用户已存在, 沿用现有账号');
  }
  const userId = targetUser.id;

  // 4.2 写入 trades
  if (rawTrades.length > 0) {
    const rows = rawTrades.map((r) => ({
      ...mapRecord(r, TRADE_FIELD_MAP),
      user_id: userId,
    }));
    const { error } = await supabase.from('trades').upsert(rows, { onConflict: 'id' });
    if (error) throw new Error(`写入 trades 失败: ${error.message}`);
    console.log(`✅ trades 迁移完成: ${rows.length} 条`);
  } else {
    console.log('ℹ️ trades 无数据, 跳过');
  }

  // 4.3 写入 grid_configs
  if (rawGrids.length > 0) {
    const rows = rawGrids.map((r) => ({
      ...mapRecord(r, GRID_FIELD_MAP),
      user_id: userId,
    }));
    const { error } = await supabase.from('grid_configs').upsert(rows, { onConflict: 'id' });
    if (error) throw new Error(`写入 grid_configs 失败: ${error.message}`);
    console.log(`✅ grid_configs 迁移完成: ${rows.length} 条`);
  } else {
    console.log('ℹ️ grid_configs 无数据, 跳过');
  }

  console.log('\n🎉 迁移完成!');
  console.log(`   - trades:        ${rawTrades.length} 条`);
  console.log(`   - grid_configs:  ${rawGrids.length} 条`);
  console.log(`   - 登录账号:       ${TARGET_USER_EMAIL}`);
  console.log('\n⚠️  重要: 迁移完成后请到 Supabase Dashboard 轮换 service_role key!');
}

main().catch((err) => {
  console.error('\n❌ 迁移失败:', err.message);
  process.exit(1);
});
