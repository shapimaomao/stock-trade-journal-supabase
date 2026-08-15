export type StrategyType = 'self' | 'other' | '自己' | 'E大' | 'E大S' | 'E大500' | string;
export type TradeAction = 'buy' | 'sell' | 'dividend';
export type OrderCategory = 'limit' | 'market' | 'grid' | 'conditional';

export interface TradeRecord {
  id: string;
  userId: string;
  stockCode: string;          // 股票代码 (如 600519)
  stockName: string;          // 股票名称 (如 贵州茅台)
  account: string;            // 股票账户行 (如 华泰证券)
  strategyName: string;       // 策略名称 (如 网格1%, 波段突破)
  strategyType: StrategyType; // 自己策略 / 别人的策略
  tradeDate: string;          // 成交日期 (YYYY-MM-DD 或 YYYY-MM-DD HH:mm)
  orderType: OrderCategory;   // 委托类别 (限价, 市价, 网格条件单)
  tradeAction: TradeAction;   // 买入 / 卖出
  fee: number;                // 手续费 (佣金/印花税/过户费)
  price: number;              // 成交价格
  quantity: number;           // 成交数量
  amount: number;             // 发生金额 (成交价格 * 成交数量，不计算手续费)
  accumulatedCapital: number; // 累计投入金额
  accumulatedPosition: number;// 累计持仓数量
  positionCost: number;       // 持仓成本价
  gainLossRatio: number;      // 涨跌比 (%)
  positionPnLPercent?: number;// 持仓盈亏% ((成交价格-持仓成本)/持仓成本*100)
  positionPnL: number;        // 持仓盈亏
  accumulatedPnL: number;     // 累计盈亏 (已实现 + 未实现)
  finalPnL?: number;          // 若清仓，最终收益额
  finalReturnRate?: number;   // 若清仓，最终收益率 %
  totalBuyCost?: number;      // 本周期买入总投入成本
  totalSellNet?: number;      // 本周期卖出总回收净额
  notes?: string;             // 备注
  notesCompleted?: boolean;    // 备注状态三态: undefined=未标记(白) / false=未完成(橙) / true=完成(绿)
  isPendingConfirmation?: boolean; // 支付宝基金等当日未确认价格的标记
  assetType?: 'stock' | 'etf' | 'fund'; // 资产类别
  createdAt: string;
  updatedAt?: string;
}

export interface PositionSummary {
  stockCode: string;
  stockName: string;
  account: string;
  currentQuantity: number;
  avgCostPrice: number;
  totalCostAmount: number;
  currentPrice?: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  realizedPnL: number;
  firstBuyDate: string;
  holdingDays: number;
  totalFees: number;
  tradeCount: number;
}

export interface ClosedPositionSummary {
  stockCode: string;
  stockName: string;
  account: string;
  openDate: string;           // 开仓日期
  closeDate: string;          // 清仓日期
  holdingDays: number;        // 持仓总天数
  maxCapital: number;         // 周期内最大占用投入本金
  totalBuyCost: number;       // 买入总投入成本
  totalSellNet: number;       // 卖出总回收净金额
  finalPnL: number;           // 最终收益额
  finalReturnRate: number;    // 最终收益率 %
  totalFees: number;          // 周期内总手续费
  tradeCount: number;         // 交易总笔数
}

export interface StrategyPerformance {
  strategyName: string;
  strategyType: StrategyType;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;              // 胜率 %
  avgWinAmount: number;
  avgLossAmount: number;
  riskRewardRatio: number;       // 平均盈亏比
  totalRealizedPnL: number;      // 总已实现盈亏
  totalFees: number;             // 总手续费
  maxLossSingle: number;         // 单笔最大亏损
  avgHoldingDays: number;        // 平均持仓天数
}

export interface PerformanceMetrics {
  totalPnL: number;               // 累计总盈亏
  totalReturnRate: number;        // 累计收益率 %
  realizedPnL: number;            // 已实现盈亏
  unrealizedPnL: number;          // 未实现盈亏
  winRate: number;                // 胜率 %
  totalTradesCount: number;       // 总成交笔数
  winningTradesCount: number;     // 盈利笔数
  losingTradesCount: number;      // 亏损笔数
  avgWinAmount: number;           // 平均盈利金额
  avgLossAmount: number;          // 平均亏损金额
  riskRewardRatio: number;        // 平均盈亏比 (盈亏收益风险比)
  winDays: number;                // 盈利天数
  lossDays: number;               // 亏损天数
  winLossDaysRatio: number;       // 胜亏天数比
  maxDrawdownAmount: number;      // 最大回撤金额
  maxDrawdownPercent: number;     // 最大回撤比例 %
  maxSingleLoss: number;          // 单笔最大亏损
  avgHoldingDaysWin: number;      // 盈利单平均持仓天数
  avgHoldingDaysLoss: number;     // 亏损单平均持仓天数
  avgHoldingDaysAll: number;      // 整体平均持仓天数
  totalFeesPaid: number;          // 累计支付手续费
  feeImpactRate: number;          // 手续费占毛收益比例 %
  totalInvestedCapital: number;   // 最高累计投入本金
}

export interface ExcelImportFieldMapping {
  stockCode: string;
  stockName: string;
  account: string;
  strategyName: string;
  strategyType: string;
  tradeDate: string;
  orderType: string;
  tradeAction: string;
  fee: string;
  price: string;
  quantity: string;
  amount: string;
  accumulatedCapital: string;
  accumulatedPosition: string;
  positionCost: string;
  gainLossRatio: string;
  positionPnL: string;
  accumulatedPnL: string;
  notes: string;
}

export interface UserProfile {
  uid: string;
  email?: string | null;
  displayName?: string | null;
  isAnonymous: boolean;
}

export interface GridStrategyConfig {
  id: string;
  stockCode: string;
  stockName: string;
  account?: string;
  strategyName: string;
  stepPercent: number;     // 网格步长涨跌比 % (例如 1.0 表示 1%)
  gridQuantity: number;    // 每次委托股数 (例如 1000 股)
  gridAmount?: number;     // 每次委托金额 (例如 20000 元)
  upperPrice?: number;     // 运行区间上限价格 (例如 32.00)
  lowerPrice?: number;     // 运行区间下限价格 (例如 25.00)
  basePrice?: number;      // 自定义基准建仓价/参考价 (例如 28.50)
  imageUrl?: string;       // 上传的策略规划/参数截图 Base64 数据
  notes?: string;          // 策略补充说明/网格纪律
  updatedAt?: string;
}

export type GridStrategyPreset = GridStrategyConfig;

