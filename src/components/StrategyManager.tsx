import React, { useState } from 'react';
import { Target, Scale, Zap, Award, Layers, Calculator, Percent, ArrowUpRight, ArrowDownRight, Grid, Plus } from 'lucide-react';
import { TradeRecord, StrategyPerformance, GridStrategyConfig } from '../types';
import { calculateStrategyPerformance } from '../lib/calculator';
import { GridStrategyCard } from './GridStrategyCard';

interface StrategyManagerProps {
  trades: TradeRecord[];
  gridConfigs?: GridStrategyConfig[];
  onSaveGridConfig?: (config: GridStrategyConfig) => void;
  onDeleteGridConfig?: (stockCode: string) => void;
}

export const StrategyManager: React.FC<StrategyManagerProps> = ({ 
  trades,
  gridConfigs = [],
  onSaveGridConfig,
  onDeleteGridConfig,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'eval' | 'gridConfigs' | 'gridCalc'>('eval');
  const [newStockCode, setNewStockCode] = useState('');
  const [newStockName, setNewStockName] = useState('');
  const [isAddingNew, setIsAddingNew] = useState(false);

  const strategyStats = calculateStrategyPerformance(trades);

  // Extract unique grid stocks from trades
  const gridTradeStocks: { stockCode: string; stockName: string; account: string }[] = Array.from(new Set<string>(
    trades.filter(t => (t.orderType === 'grid' || t.strategyName.includes('网格')) && t.stockCode).map(t => t.stockCode)
  )).map(code => {
    const t = trades.find(tr => tr.stockCode === code);
    return { stockCode: code, stockName: t?.stockName || code, account: t?.account || '默认账户' };
  });

  // Combine saved grid configs with grid stocks from trades
  const stockGridMap = new Map<string, { stockCode: string; stockName: string; account: string }>();
  gridConfigs.forEach(c => {
    stockGridMap.set(c.stockCode, { stockCode: c.stockCode, stockName: c.stockName, account: c.account || '默认账户' });
  });
  gridTradeStocks.forEach(s => {
    if (!stockGridMap.has(s.stockCode)) {
      stockGridMap.set(s.stockCode, s);
    }
  });
  const allGridStocks = Array.from(stockGridMap.values());

  // Grid Calculator State
  const [gridBasePrice, setGridBasePrice] = useState<number>(10.00);
  const [gridUpperPrice, setGridUpperPrice] = useState<number>(12.00);
  const [gridLowerPrice, setGridLowerPrice] = useState<number>(8.00);
  const [gridLevels, setGridLevels] = useState<number>(10);
  const [gridCapital, setGridCapital] = useState<number>(50000);

  // Calculate Grid Levels
  const gridStep = (gridUpperPrice - gridLowerPrice) / gridLevels;
  const priceLevels: { level: number; buyPrice: number; sellPrice: number; stepProfitPercent: number }[] = [];

  for (let i = 0; i <= gridLevels; i++) {
    const levelPrice = gridLowerPrice + i * gridStep;
    const sellPrice = levelPrice * (1 + (gridStep / levelPrice));
    const stepProfit = (gridStep / levelPrice) * 100;
    priceLevels.push({
      level: i,
      buyPrice: Math.round(levelPrice * 1000) / 1000,
      sellPrice: Math.round(sellPrice * 1000) / 1000,
      stepProfitPercent: Math.round(stepProfit * 100) / 100,
    });
  }

  return (
    <div className="space-y-4 my-4">
      {/* Sub Tabs */}
      <div className="flex flex-wrap items-center gap-2 bg-slate-900 border border-slate-800 p-1.5 rounded-2xl w-fit">
        <button
          onClick={() => setActiveSubTab('eval')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeSubTab === 'eval'
              ? 'bg-emerald-500 text-slate-950 shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Target className="w-4 h-4" />
          <span>各策略绩效评估 ({strategyStats.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('gridConfigs')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeSubTab === 'gridConfigs'
              ? 'bg-emerald-500 text-slate-950 shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Grid className="w-4 h-4" />
          <span>标的网格策略与规划图 ({allGridStocks.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('gridCalc')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeSubTab === 'gridCalc'
              ? 'bg-emerald-500 text-slate-950 shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Calculator className="w-4 h-4" />
          <span>网格策略挂单计算器</span>
        </button>
      </div>

      {activeSubTab === 'eval' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {strategyStats.length === 0 ? (
            <div className="col-span-full bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-slate-500 text-xs">
              暂无策略历史数据
            </div>
          ) : (
            strategyStats.map(s => {
              const isProfit = s.totalRealizedPnL >= 0;

              return (
                <div 
                  key={s.strategyName}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg hover:border-slate-700 transition-all space-y-3"
                >
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 rounded-xl bg-slate-800 flex items-center justify-center text-emerald-400 font-bold">
                        <Target className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-100 text-sm">{s.strategyName}</h4>
                        <span className={`px-2 py-0.5 text-[10px] rounded-full font-medium ${
                          s.strategyType === 'self'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                        }`}>
                          {s.strategyType === 'self' ? '自己策略' : '别人的策略'}
                        </span>
                      </div>
                    </div>

                    <div className="text-right font-mono">
                      <div className="text-[10px] text-slate-500">累计已实现盈亏</div>
                      <div className={`text-base font-bold ${isProfit ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {isProfit ? '+' : ''}¥{s.totalRealizedPnL.toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {/* Metrics Grid */}
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <div className="bg-slate-950 p-2 rounded-xl border border-slate-800">
                      <div className="text-[10px] text-slate-500 font-sans">策略胜率</div>
                      <div className="font-bold text-amber-400 text-sm">{s.winRate}%</div>
                      <div className="text-[10px] text-slate-500 font-sans">{s.winningTrades}胜 / {s.losingTrades}负</div>
                    </div>

                    <div className="bg-slate-950 p-2 rounded-xl border border-slate-800">
                      <div className="text-[10px] text-slate-500 font-sans">平均盈亏比</div>
                      <div className="font-bold text-cyan-300 text-sm">{s.riskRewardRatio}:1</div>
                      <div className="text-[10px] text-slate-500 font-sans">均盈¥{s.avgWinAmount}</div>
                    </div>

                    <div className="bg-slate-950 p-2 rounded-xl border border-slate-800">
                      <div className="text-[10px] text-slate-500 font-sans">累计手续费</div>
                      <div className="font-semibold text-slate-300">¥{s.totalFees}</div>
                    </div>

                    <div className="bg-slate-950 p-2 rounded-xl border border-slate-800">
                      <div className="text-[10px] text-slate-500 font-sans">平均持仓时间</div>
                      <div className="font-semibold text-slate-300">{s.avgHoldingDays} 天</div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : activeSubTab === 'gridConfigs' ? (
        /* Customized Grid Strategy List & Image Uploader */
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Grid className="w-5 h-5 text-amber-400" />
                <span>定制标的网格策略与规划截图管理</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                记录每只股票/ETF网格策略的步长%、委托股数/金额、运行区间与软件参数图
              </p>
            </div>

            <button
              onClick={() => setIsAddingNew(!isAddingNew)}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-1 shadow transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>新增标的网格策略</span>
            </button>
          </div>

          {/* Add New Stock Grid Config Form */}
          {isAddingNew && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 font-sans">
              <div className="text-xs font-bold text-slate-200">添加新标的的网格策略</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">证券代码 *</label>
                  <input
                    type="text"
                    placeholder="例如 600900"
                    value={newStockCode}
                    onChange={e => setNewStockCode(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2 text-xs text-slate-100 font-mono focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">证券简称 *</label>
                  <input
                    type="text"
                    placeholder="例如 长江电力"
                    value={newStockName}
                    onChange={e => setNewStockName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2 text-xs text-slate-100 focus:border-emerald-500"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  onClick={() => setIsAddingNew(false)}
                  className="px-3 py-1 bg-slate-800 text-slate-300 rounded-lg text-xs"
                >
                  取消
                </button>
                <button
                  onClick={() => {
                    if (!newStockCode || !newStockName) {
                      alert('请填写证券代码和简称');
                      return;
                    }
                    if (onSaveGridConfig) {
                      onSaveGridConfig({
                        id: `grid_${newStockCode}`,
                        stockCode: newStockCode,
                        stockName: newStockName,
                        strategyName: '网格交易策略',
                        stepPercent: 1.0,
                        gridQuantity: 1000,
                        updatedAt: new Date().toISOString(),
                      });
                    }
                    setNewStockCode('');
                    setNewStockName('');
                    setIsAddingNew(false);
                  }}
                  className="px-3 py-1 bg-emerald-500 text-slate-950 font-bold rounded-lg text-xs"
                >
                  确定创建
                </button>
              </div>
            </div>
          )}

          {/* Grid Config Cards Grid */}
          {allGridStocks.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-500 text-xs">
              暂无配置网格策略的标的。点击右上角【新增标的网格策略】开始定制！
            </div>
          ) : (
            <div className="space-y-4">
              {allGridStocks.map(stock => {
                const config = gridConfigs.find(c => c.stockCode === stock.stockCode) || null;
                return (
                  <GridStrategyCard
                    key={stock.stockCode}
                    stockCode={stock.stockCode}
                    stockName={stock.stockName}
                    account={stock.account}
                    config={config}
                    onSaveConfig={onSaveGridConfig || (() => {})}
                    onDeleteConfig={onDeleteGridConfig}
                  />
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* Grid Trading Interactive Calculator */
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div>
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Calculator className="w-5 h-5 text-emerald-400" />
              <span>网格策略挂单计算器 (Grid Strategy Planner)</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">设置网格价格区间与等差/等比档位，自动计算每格买卖挂单与单格收益</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
            <div>
              <label className="block text-slate-400 mb-1">网格上限价格 (元)</label>
              <input
                type="number"
                step="0.01"
                value={gridUpperPrice}
                onChange={e => setGridUpperPrice(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-slate-100 font-mono focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1">网格下限价格 (元)</label>
              <input
                type="number"
                step="0.01"
                value={gridLowerPrice}
                onChange={e => setGridLowerPrice(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-slate-100 font-mono focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1">网格划分格子数</label>
              <input
                type="number"
                value={gridLevels}
                onChange={e => setGridLevels(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-slate-100 font-mono focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1">拟投入本金 (元)</label>
              <input
                type="number"
                step="1000"
                value={gridCapital}
                onChange={e => setGridCapital(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-slate-100 font-mono focus:border-emerald-500"
              />
            </div>

            <div className="col-span-2 sm:col-span-1 flex flex-col justify-end">
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-center font-mono text-emerald-400 font-bold">
                每格步长: ¥{gridStep.toFixed(3)}
              </div>
            </div>
          </div>

          {/* Price Levels Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
            <table className="w-full text-left text-xs font-mono text-slate-300">
              <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 uppercase">
                <tr>
                  <th className="p-3">网格档位</th>
                  <th className="p-3 text-rose-400">买入挂单触及价</th>
                  <th className="p-3 text-emerald-400">对应卖出止盈价</th>
                  <th className="p-3">单格步长涨幅 %</th>
                  <th className="p-3">单格分配资金(预估)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {priceLevels.map((lvl) => (
                  <tr key={lvl.level} className="hover:bg-slate-900/60">
                    <td className="p-3 font-sans font-bold">第 {lvl.level} 档</td>
                    <td className="p-3 text-rose-400 font-bold">¥{lvl.buyPrice.toFixed(2)}</td>
                    <td className="p-3 text-emerald-400 font-bold">¥{lvl.sellPrice.toFixed(2)}</td>
                    <td className="p-3 text-amber-400">+{lvl.stepProfitPercent}%</td>
                    <td className="p-3 text-slate-400">¥{(gridCapital / gridLevels).toFixed(0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
