import React, { useState } from 'react';
import { Briefcase, Clock, CheckCircle2, TrendingUp, TrendingDown, Calendar, Layers, Sliders, ChevronDown, ChevronUp } from 'lucide-react';
import { TradeRecord, GridStrategyConfig } from '../types';
import { calculateCurrentPositions, calculateClosedPositions } from '../lib/calculator';
import { GridStrategyCard } from './GridStrategyCard';

interface PositionsSummaryProps {
  trades: TradeRecord[];
  gridConfigs?: GridStrategyConfig[];
  onSaveGridConfig?: (config: GridStrategyConfig) => void;
  onDeleteGridConfig?: (stockCode: string) => void;
}

export const PositionsSummary: React.FC<PositionsSummaryProps> = ({ 
  trades,
  gridConfigs = [],
  onSaveGridConfig,
  onDeleteGridConfig,
}) => {
  const [activeTab, setActiveTab] = useState<'open' | 'closed'>('open');
  const [expandedGridStockCode, setExpandedGridStockCode] = useState<string | null>(null);

  const positions = calculateCurrentPositions(trades);
  const closedPositions = calculateClosedPositions(trades);

  const totalUnrealizedPnL = positions.reduce((sum, p) => sum + p.unrealizedPnL, 0);
  const totalCostAmount = positions.reduce((sum, p) => sum + p.totalCostAmount, 0);

  const totalClosedPnL = closedPositions.reduce((sum, c) => sum + c.finalPnL, 0);
  const totalClosedFees = closedPositions.reduce((sum, c) => sum + c.totalFees, 0);

  return (
    <div className="space-y-4 my-4">
      {/* Sub Tabs */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setActiveTab('open')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 ${
              activeTab === 'open'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <Briefcase className="w-4 h-4" />
            <span>当前在持有标的 ({positions.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('closed')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 ${
              activeTab === 'closed'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>历史已清仓战绩 ({closedPositions.length})</span>
          </button>
        </div>
      </div>

      {activeTab === 'open' ? (
        positions.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-500 my-4">
            目前没有在持仓中的股票账户。当您买入并尚未清仓时，持仓明细会显示在此处。
          </div>
        ) : (
          <>
            {/* Top Positions Header Summary */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold">
                  <Briefcase className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-100">当前在持有标的分析 ({positions.length} 只)</h3>
                  <p className="text-xs text-slate-400">实时计算多仓加权成本、持仓天数与未实现浮盈浮亏</p>
                </div>
              </div>

              <div className="flex items-center space-x-6 font-mono text-xs">
                <div>
                  <span className="text-slate-400 block">持仓总成本市值:</span>
                  <span className="text-sm font-bold text-slate-200">
                    ¥{totalCostAmount.toLocaleString('zh-CN', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block">合计持仓浮动盈亏:</span>
                  <span className={`text-sm font-bold ${
                    totalUnrealizedPnL > 0 ? 'text-rose-400' : totalUnrealizedPnL < 0 ? 'text-emerald-400' : 'text-slate-200'
                  }`}>
                    {totalUnrealizedPnL > 0 ? '+' : ''}¥{totalUnrealizedPnL.toLocaleString('zh-CN', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                  </span>
                </div>
              </div>
            </div>

            {/* Grid of Position Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {positions.map(pos => {
                const isProfit = pos.unrealizedPnL >= 0;

                return (
                  <div 
                    key={pos.stockCode}
                    className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg hover:border-slate-700 transition-all space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-slate-100 text-base">{pos.stockName}</span>
                          <span className="text-xs font-mono text-slate-400">({pos.stockCode})</span>
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          <span className="bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded">{pos.account}</span>
                        </div>
                      </div>

                      <div className="text-right font-mono">
                        <div className="text-[10px] text-slate-500">持仓浮动盈亏</div>
                        <div className={`text-base font-bold ${isProfit ? 'text-rose-400' : 'text-emerald-400'}`}>
                          {isProfit ? '+' : ''}¥{pos.unrealizedPnL.toLocaleString('zh-CN', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                        </div>
                        <div className={`text-[11px] font-semibold ${isProfit ? 'text-rose-400' : 'text-emerald-400'}`}>
                          ({isProfit ? '+' : ''}{pos.unrealizedPnLPercent.toFixed(3)}%)
                        </div>
                      </div>
                    </div>

                    {/* Data Table for Position */}
                    <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-slate-950 p-3 rounded-xl border border-slate-800/80">
                      <div>
                        <span className="text-slate-500 block font-sans text-[10px]">当前持仓数量</span>
                        <span className="font-bold text-slate-200">{pos.currentQuantity.toLocaleString()} 股</span>
                      </div>

                      <div>
                        <span className="text-slate-500 block font-sans text-[10px]">持仓成本单价</span>
                        <span className="font-bold text-slate-200">¥{pos.avgCostPrice.toFixed(3)}</span>
                      </div>

                      <div>
                        <span className="text-slate-500 block font-sans text-[10px]">现价 / 最新价</span>
                        <span className="font-bold text-amber-400">¥{pos.currentPrice?.toFixed(3)}</span>
                      </div>

                      <div>
                        <span className="text-slate-500 block font-sans text-[10px]">持仓成本本金</span>
                        <span className="font-bold text-slate-300">¥{pos.totalCostAmount.toLocaleString('zh-CN', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</span>
                      </div>
                    </div>

                    {/* Footer Meta & Grid Strategy Action */}
                    <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800">
                      <div className="flex items-center space-x-1">
                        <Clock className="w-3.5 h-3.5 text-teal-400" />
                        <span>已持仓: <strong className="text-teal-300 font-mono">{pos.holdingDays}</strong> 天</span>
                      </div>

                      <button
                        onClick={() => setExpandedGridStockCode(expandedGridStockCode === pos.stockCode ? null : pos.stockCode)}
                        className="px-2.5 py-1 text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg flex items-center space-x-1 transition-all"
                      >
                        <Sliders className="w-3 h-3 text-amber-400" />
                        <span>{expandedGridStockCode === pos.stockCode ? '收起网格' : '网格策略'}</span>
                        {expandedGridStockCode === pos.stockCode ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                    </div>

                    {/* Expandable Grid Strategy Card */}
                    {expandedGridStockCode === pos.stockCode && onSaveGridConfig && (
                      <div className="pt-2">
                        <GridStrategyCard
                          stockCode={pos.stockCode}
                          stockName={pos.stockName}
                          account={pos.account}
                          config={gridConfigs.find(c => c.stockCode === pos.stockCode) || null}
                          onSaveConfig={onSaveGridConfig}
                          onDeleteConfig={onDeleteGridConfig}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )
      ) : (
        /* Closed Positions Section */
        closedPositions.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-500 my-4">
            暂无已清仓的完整交易记录。当您清仓某只股票后，其最终收益额与最终收益率将总结在此处。
          </div>
        ) : (
          <div className="space-y-4">
            {/* Header summary for closed positions */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-100">已清仓交易战绩汇总 ({closedPositions.length} 轮)</h3>
                  <p className="text-xs text-slate-400">精确计算每轮买入至完全清仓的【最终收益额】与【最终收益率%】</p>
                </div>
              </div>

              <div className="flex items-center space-x-6 font-mono text-xs">
                <div>
                  <span className="text-slate-400 block">已清仓累计最终收益:</span>
                  <span className={`text-sm font-bold ${
                    totalClosedPnL > 0 ? 'text-rose-400' : totalClosedPnL < 0 ? 'text-emerald-400' : 'text-slate-200'
                  }`}>
                    {totalClosedPnL > 0 ? '+' : ''}¥{totalClosedPnL.toLocaleString('zh-CN', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block">清仓累计耗费手续费:</span>
                  <span className="text-sm font-bold text-slate-300">
                    ¥{totalClosedFees.toLocaleString('zh-CN', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                  </span>
                </div>
              </div>
            </div>

            {/* Grid of Closed Position Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {closedPositions.map((c, idx) => {
                const isWin = c.finalPnL >= 0;

                return (
                  <div 
                    key={`${c.stockCode}-${c.closeDate}-${idx}`}
                    className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg hover:border-slate-700 transition-all space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-slate-100 text-base">{c.stockName}</span>
                          <span className="text-xs font-mono text-slate-400">({c.stockCode})</span>
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5 flex items-center space-x-2">
                          <span className="bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded">{c.account}</span>
                          <span className="bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded font-mono">已清仓</span>
                        </div>
                      </div>

                      <div className="text-right font-mono">
                        <div className="text-[10px] text-slate-500">最终收益额 / 最终收益率</div>
                        <div className={`text-base font-bold ${isWin ? 'text-rose-400' : 'text-emerald-400'}`}>
                          {isWin ? '+' : ''}¥{c.finalPnL.toLocaleString('zh-CN', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                        </div>
                        <div className={`text-[11px] font-semibold ${isWin ? 'text-rose-400' : 'text-emerald-400'}`}>
                          ({isWin ? '+' : ''}{c.finalReturnRate.toFixed(3)}%)
                        </div>
                      </div>
                    </div>

                    {/* Data Grid for Closed Position */}
                    <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-slate-950 p-3 rounded-xl border border-slate-800/80">
                      <div>
                        <span className="text-slate-500 block font-sans text-[10px]">买入总投入成本</span>
                        <span className="font-bold text-slate-200">
                          ¥{c.totalBuyCost.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>

                      <div>
                        <span className="text-slate-500 block font-sans text-[10px]">卖出总回收净金额</span>
                        <span className="font-bold text-slate-200">
                          ¥{c.totalSellNet.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>

                      <div>
                        <span className="text-slate-500 block font-sans text-[10px]">建仓 - 清仓日期</span>
                        <span className="font-semibold text-slate-300 text-[11px]">{c.openDate} ~ {c.closeDate}</span>
                      </div>

                      <div>
                        <span className="text-slate-500 block font-sans text-[10px]">持仓天数 / 交易笔数</span>
                        <span className="font-bold text-teal-300">{c.holdingDays} 天 / {c.tradeCount} 笔</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )
      )}
    </div>
  );
};
