/**
 * Supabase 数据层封装
 * - 从环境变量读取 URL / anon key
 * - 提供 snake_case ↔ camelCase 字段转换工具
 * - 未配置时返回 null, 应用走「未配置」提示流程
 */
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import type { TradeRecord, GridStrategyConfig } from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

export const isSupabaseConfigured = Boolean(supabase);
export type { User };

// ------------------------------------------------------------
// trades 字段映射 (snake_case 数据库行 ↔ camelCase 应用对象)
// ------------------------------------------------------------
const TRADE_COLUMN_MAP: Record<string, string> = {
  stock_code: 'stockCode',
  stock_name: 'stockName',
  account: 'account',
  strategy_name: 'strategyName',
  strategy_type: 'strategyType',
  trade_date: 'tradeDate',
  order_type: 'orderType',
  trade_action: 'tradeAction',
  fee: 'fee',
  price: 'price',
  quantity: 'quantity',
  amount: 'amount',
  accumulated_capital: 'accumulatedCapital',
  accumulated_position: 'accumulatedPosition',
  position_cost: 'positionCost',
  gain_loss_ratio: 'gainLossRatio',
  position_pnl_percent: 'positionPnLPercent',
  position_pnl: 'positionPnL',
  accumulated_pnl: 'accumulatedPnL',
  final_pnl: 'finalPnL',
  final_return_rate: 'finalReturnRate',
  total_buy_cost: 'totalBuyCost',
  total_sell_net: 'totalSellNet',
  notes: 'notes',
  notes_completed: 'notesCompleted',
  is_pending_confirmation: 'isPendingConfirmation',
  asset_type: 'assetType',
  created_at: 'createdAt',
  updated_at: 'updatedAt',
};

const GRID_COLUMN_MAP: Record<string, string> = {
  stock_code: 'stockCode',
  stock_name: 'stockName',
  account: 'account',
  strategy_name: 'strategyName',
  step_percent: 'stepPercent',
  grid_quantity: 'gridQuantity',
  grid_amount: 'gridAmount',
  upper_price: 'upperPrice',
  lower_price: 'lowerPrice',
  base_price: 'basePrice',
  image_url: 'imageUrl',
  notes: 'notes',
  updated_at: 'updatedAt',
};

/** 数据库行 (snake_case) → TradeRecord */
export function mapTradeRow(row: Record<string, any>, userId: string): TradeRecord {
  const record: Record<string, any> = {
    id: row.id,
    userId,
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at,
  };
  for (const [col, key] of Object.entries(TRADE_COLUMN_MAP)) {
    if (row[col] !== undefined && row[col] !== null) {
      record[key] = row[col];
    }
  }
  return record as TradeRecord;
}

/** TradeRecord → 数据库行 (snake_case), 不含 user_id (由触发器填充) */
export function mapTradeToRow(trade: TradeRecord): Record<string, any> {
  const row: Record<string, any> = { id: trade.id };
  for (const [col, key] of Object.entries(TRADE_COLUMN_MAP)) {
    if ((trade as any)[key] !== undefined && (trade as any)[key] !== null) {
      row[col] = (trade as any)[key];
    }
  }
  return row;
}

/** 数据库行 (snake_case) → GridStrategyConfig */
export function mapGridRow(row: Record<string, any>): GridStrategyConfig {
  const record: Record<string, any> = { id: row.id };
  for (const [col, key] of Object.entries(GRID_COLUMN_MAP)) {
    if (row[col] !== undefined && row[col] !== null) {
      record[key] = row[col];
    }
  }
  return record as GridStrategyConfig;
}

/** GridStrategyConfig → 数据库行 (snake_case), 不含 user_id (由触发器填充) */
export function mapGridToRow(config: GridStrategyConfig): Record<string, any> {
  const row: Record<string, any> = { id: config.id };
  for (const [col, key] of Object.entries(GRID_COLUMN_MAP)) {
    if ((config as any)[key] !== undefined && (config as any)[key] !== null) {
      row[col] = (config as any)[key];
    }
  }
  return row;
}
