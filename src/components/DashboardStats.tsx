import React from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Percent, 
  Scale, 
  CalendarDays, 
  ArrowDownRight, 
  Clock, 
  Receipt,
  AlertTriangle,
  Award,
  Zap
} from 'lucide-react';
import { PerformanceMetrics } from '../types';

interface DashboardStatsProps {
  metrics: PerformanceMetrics;
}

export const DashboardStats: React.FC<DashboardStatsProps> = ({ metrics }) => {
  const isPositive = metrics.totalPnL >= 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 my-4">
      {/* 1. 累计总盈亏 */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 shadow-sm hover:border-slate-700 transition-all">
        <div className="flex items-center justify-between text-slate-400 text-xs mb-1.5">
          <span className="font-medium">累计总盈亏</span>
          {isPositive ? (
            <TrendingUp className="w-4 h-4 text-rose-500" />
          ) : (
            <TrendingDown className="w-4 h-4 text-emerald-500" />
          )}
        </div>
        <div className={`text-lg sm:text-xl font-bold font-mono tracking-tight ${
          metrics.totalPnL > 0 ? 'text-rose-400' : metrics.totalPnL < 0 ? 'text-emerald-400' : 'text-slate-200'
        }`}>
          {metrics.totalPnL > 0 ? '+' : ''}{metrics.totalPnL.toLocaleString('zh-CN', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
        </div>
        <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
          <span>收益率:</span>
          <span className={`font-semibold font-mono ${metrics.totalReturnRate > 0 ? 'text-rose-400' : metrics.totalReturnRate < 0 ? 'text-emerald-400' : 'text-slate-400'}`}>
            {metrics.totalReturnRate > 0 ? '+' : ''}{metrics.totalReturnRate}%
          </span>
        </div>
      </div>

      {/* 2. 胜率统计 */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 shadow-sm hover:border-slate-700 transition-all">
        <div className="flex items-center justify-between text-slate-400 text-xs mb-1.5">
          <span className="font-medium">交易胜率</span>
          <Percent className="w-4 h-4 text-amber-400" />
        </div>
        <div className="text-lg sm:text-xl font-bold font-mono text-slate-100 tracking-tight">
          {metrics.winRate}%
        </div>
        <div className="text-[11px] text-slate-400 mt-1">
          <span className="text-rose-400 font-semibold">{metrics.winningTradesCount}胜</span> / <span className="text-emerald-400 font-semibold">{metrics.losingTradesCount}负</span> (共{metrics.totalTradesCount}平仓)
        </div>
      </div>

      {/* 3. 平均盈亏比 */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 shadow-sm hover:border-slate-700 transition-all">
        <div className="flex items-center justify-between text-slate-400 text-xs mb-1.5">
          <span className="font-medium">平均盈亏比</span>
          <Scale className="w-4 h-4 text-cyan-400" />
        </div>
        <div className="text-lg sm:text-xl font-bold font-mono text-cyan-300 tracking-tight">
          {metrics.riskRewardRatio}:1
        </div>
        <div className="text-[11px] text-slate-400 mt-1 truncate">
          均盈¥{metrics.avgWinAmount.toLocaleString()} / 均亏¥{metrics.avgLossAmount.toLocaleString()}
        </div>
      </div>

      {/* 4. 胜亏天数比 */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 shadow-sm hover:border-slate-700 transition-all">
        <div className="flex items-center justify-between text-slate-400 text-xs mb-1.5">
          <span className="font-medium">胜亏天数比</span>
          <CalendarDays className="w-4 h-4 text-indigo-400" />
        </div>
        <div className="text-lg sm:text-xl font-bold font-mono text-indigo-300 tracking-tight">
          {metrics.winLossDaysRatio}:1
        </div>
        <div className="text-[11px] text-slate-400 mt-1">
          <span className="text-rose-400">{metrics.winDays}涨天</span> vs <span className="text-emerald-400">{metrics.lossDays}跌天</span>
        </div>
      </div>

      {/* 5. 最大回撤 */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 shadow-sm hover:border-slate-700 transition-all">
        <div className="flex items-center justify-between text-slate-400 text-xs mb-1.5">
          <span className="font-medium">最大回撤</span>
          <ArrowDownRight className="w-4 h-4 text-purple-400" />
        </div>
        <div className="text-lg sm:text-xl font-bold font-mono text-purple-300 tracking-tight">
          -{metrics.maxDrawdownPercent}%
        </div>
        <div className="text-[11px] text-slate-400 mt-1 truncate">
          金额: -¥{metrics.maxDrawdownAmount.toLocaleString()}
        </div>
      </div>

      {/* 6. 单笔最大亏损 */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 shadow-sm hover:border-slate-700 transition-all">
        <div className="flex items-center justify-between text-slate-400 text-xs mb-1.5">
          <span className="font-medium">单笔最大亏损</span>
          <AlertTriangle className="w-4 h-4 text-rose-400" />
        </div>
        <div className="text-lg sm:text-xl font-bold font-mono text-rose-400 tracking-tight">
          -¥{metrics.maxSingleLoss.toLocaleString()}
        </div>
        <div className="text-[11px] text-slate-400 mt-1">
          已实现风控极值
        </div>
      </div>

      {/* 7. 持仓天数统计 */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 shadow-sm hover:border-slate-700 transition-all">
        <div className="flex items-center justify-between text-slate-400 text-xs mb-1.5">
          <span className="font-medium">平均持仓天数</span>
          <Clock className="w-4 h-4 text-teal-400" />
        </div>
        <div className="text-lg sm:text-xl font-bold font-mono text-teal-300 tracking-tight">
          {metrics.avgHoldingDaysAll}天
        </div>
        <div className="text-[11px] text-slate-400 mt-1">
          胜单:{metrics.avgHoldingDaysWin}天 / 亏单:{metrics.avgHoldingDaysLoss}天
        </div>
      </div>

      {/* 8. 累计手续费与侵蚀率 */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 shadow-sm hover:border-slate-700 transition-all">
        <div className="flex items-center justify-between text-slate-400 text-xs mb-1.5">
          <span className="font-medium">累计手续费</span>
          <Receipt className="w-4 h-4 text-amber-500" />
        </div>
        <div className="text-lg sm:text-xl font-bold font-mono text-amber-400 tracking-tight">
          ¥{metrics.totalFeesPaid.toLocaleString()}
        </div>
        <div className="text-[11px] text-slate-400 mt-1">
          收益侵蚀率: <span className="text-amber-300 font-medium">{metrics.feeImpactRate}%</span>
        </div>
      </div>
    </div>
  );
};
