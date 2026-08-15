import React from 'react';
import { Layers, Check, PlusCircle, Building, Search, X, Grid } from 'lucide-react';
import { TradeRecord, StrategyType, GridStrategyConfig } from '../types';
import { GridStrategyCard } from './GridStrategyCard';

interface StockQuickSelectorProps {
  trades: TradeRecord[];
  selectedStockCode: string | null;
  onSelectStock: (code: string | null) => void;
  onQuickAddForStock: (stock: {
    stockCode: string;
    stockName: string;
    account: string;
    strategyName: string;
    strategyType: StrategyType;
  }) => void;
  gridConfigs?: GridStrategyConfig[];
  onSaveGridConfig?: (config: GridStrategyConfig) => void;
  onDeleteGridConfig?: (stockCode: string) => void;
}

export const StockQuickSelector: React.FC<StockQuickSelectorProps> = ({
  trades,
  selectedStockCode,
  onSelectStock,
  onQuickAddForStock,
  gridConfigs = [],
  onSaveGridConfig,
  onDeleteGridConfig,
}) => {
  // Map and smart matching dictionaries
  const stockMap = new Map<string, {
    stockCode: string;
    stockName: string;
    account: string;
    strategyName: string;
    strategyType: StrategyType;
    tradeCount: number;
    currentQuantity: number;
    lastTradeDate: string;
  }>();

  const codeToKey = new Map<string, string>();
  const nameToKey = new Map<string, string>();

  // Sort trades chronologically ascending to compute current position
  const sortedTrades = [...trades].sort((a, b) => {
    const dateA = new Date(a.tradeDate).getTime();
    const dateB = new Date(b.tradeDate).getTime();
    if (dateA !== dateB) return dateA - dateB;
    if (a.tradeAction !== b.tradeAction) {
      if (a.tradeAction === 'buy') return -1;
      if (b.tradeAction === 'buy') return 1;
      if (a.tradeAction === 'dividend') return -1;
      if (b.tradeAction === 'dividend') return 1;
    }
    return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
  });

  sortedTrades.forEach(t => {
    const code = (t.stockCode || '').trim();
    const name = (t.stockName || '').trim();
    if (!code && !name) return;

    let key = '';
    if (code && codeToKey.has(code)) {
      key = codeToKey.get(code)!;
    } else if (name && nameToKey.has(name)) {
      key = nameToKey.get(name)!;
    } else {
      key = code || name;
    }

    if (code) codeToKey.set(code, key);
    if (name) nameToKey.set(name, key);

    const existing = stockMap.get(key);
    // Quantity calculation: BUY adds, SELL subtracts, DIVIDEND does NOT subtract position
    const qtyChange = t.tradeAction === 'buy' 
      ? (Number(t.quantity) || 0) 
      : (t.tradeAction === 'sell' ? -(Number(t.quantity) || 0) : 0);

    if (!existing) {
      stockMap.set(key, {
        stockCode: code || key,
        stockName: name || code || key,
        account: t.account || '默认账户',
        strategyName: t.strategyName || '核心策略',
        strategyType: t.strategyType || '自己',
        tradeCount: 1,
        currentQuantity: Math.max(0, qtyChange),
        lastTradeDate: t.tradeDate,
      });
    } else {
      existing.tradeCount += 1;
      existing.currentQuantity = Math.max(0, existing.currentQuantity + qtyChange);

      if (new Date(t.tradeDate).getTime() >= new Date(existing.lastTradeDate).getTime()) {
        if (code) existing.stockCode = code;
        if (name) existing.stockName = name;
        if (t.account) existing.account = t.account;
        if (t.strategyName) existing.strategyName = t.strategyName;
        if (t.strategyType) existing.strategyType = t.strategyType;
        existing.lastTradeDate = t.tradeDate;
      }
    }
  });

  const uniqueStocks = Array.from(stockMap.values()).sort((a, b) => b.tradeCount - a.tradeCount);

  if (uniqueStocks.length === 0) {
    return null;
  }

  const selectedStockObj = selectedStockCode
    ? stockMap.get(selectedStockCode) || Array.from(stockMap.values()).find(s => s.stockCode === selectedStockCode || s.stockName === selectedStockCode)
    : null;

  const currentGridConfig = selectedStockCode && selectedStockObj
    ? gridConfigs.find(c => c.stockCode === selectedStockObj.stockCode || c.stockName === selectedStockObj.stockName) || null
    : null;

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 shadow-lg space-y-3">
      {/* Header Bar */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center space-x-2">
          <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
            <Layers className="w-3.5 h-3.5" />
          </div>
          <span className="font-bold text-slate-200">标的对账快捷过滤 ({uniqueStocks.length} 只标的)</span>
          {selectedStockCode && (
            <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full text-[10px] font-medium flex items-center gap-1">
              当前看: {selectedStockObj?.stockName || selectedStockCode}
              <button 
                onClick={() => onSelectStock(null)} 
                className="hover:text-white ml-0.5"
                title="清除过滤"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
        </div>

        {selectedStockCode && selectedStockObj && (
          <button
            onClick={() => onQuickAddForStock(selectedStockObj)}
            className="flex items-center space-x-1 px-3 py-1 bg-emerald-500 text-slate-950 hover:bg-emerald-400 font-bold rounded-xl text-[11px] shadow-sm transition-all active:scale-95"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>为 {selectedStockObj.stockName} 新增一笔成交</span>
          </button>
        )}
      </div>

      {/* Stock Cards Grid: Uniform Size, Grid Aligned */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 pt-0.5">
        {/* All Stocks Grid Cell */}
        <button
          onClick={() => onSelectStock(null)}
          className={`h-[68px] flex flex-col justify-between p-2.5 rounded-xl text-xs transition-all border text-left cursor-pointer ${
            selectedStockCode === null
              ? 'bg-emerald-500/15 border-emerald-500/60 text-emerald-300 ring-1 ring-emerald-500/40 shadow-sm'
              : 'bg-slate-950 border-slate-800/80 hover:border-slate-700 text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <span className="font-bold text-slate-100 text-xs">全部标的</span>
            <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold ${
              selectedStockCode === null ? 'bg-emerald-500/30 text-emerald-200' : 'bg-slate-800 text-slate-400'
            }`}>
              {trades.length} 笔
            </span>
          </div>
          <div className="text-[10px] text-slate-500 font-sans truncate">
            显示账户内全部对账数据
          </div>
        </button>

        {/* Stock Item Grid Cells */}
        {uniqueStocks.map(s => {
          const isSelected = selectedStockCode === s.stockCode || selectedStockCode === s.stockName;
          const isHolding = s.currentQuantity > 0;
          const isGrid = s.strategyName.includes('网格') || gridConfigs.some(c => c.stockCode === s.stockCode || c.stockName === s.stockName);

          return (
            <div
              key={s.stockCode || s.stockName}
              className={`h-[68px] flex flex-col justify-between p-2.5 rounded-xl text-xs transition-all border cursor-pointer group relative ${
                isSelected
                  ? 'bg-slate-800/90 border-emerald-500 text-slate-100 shadow-md ring-1 ring-emerald-500/50'
                  : 'bg-slate-950 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/60 text-slate-300'
              }`}
              onClick={() => onSelectStock(isSelected ? null : s.stockCode)}
            >
              {/* Top Row: Name, Code & Position Tag */}
              <div className="flex items-center justify-between w-full space-x-1">
                <div className="flex items-center space-x-1 min-w-0 flex-1">
                  <span className="font-bold text-slate-100 truncate text-xs" title={s.stockName}>
                    {s.stockName}
                  </span>
                  <span className="text-[10px] font-mono text-slate-500 shrink-0">
                    {s.stockCode}
                  </span>
                </div>

                {/* Status Badge */}
                {isHolding ? (
                  <span className="px-1.5 py-0.2 text-[9px] bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded font-mono font-bold shrink-0">
                    持 {s.currentQuantity.toLocaleString()}
                  </span>
                ) : (
                  <span className="px-1.5 py-0.2 text-[9px] bg-slate-800/80 text-slate-400 rounded font-mono shrink-0">
                    已清仓
                  </span>
                )}
              </div>

              {/* Bottom Row: Account, Strategy & Trade Count / Quick Add */}
              <div className="flex items-center justify-between w-full pt-1 text-[10px] text-slate-500 font-mono border-t border-slate-800/40">
                <div className="truncate min-w-0 flex-1 pr-1" title={`${s.account} • ${s.strategyName}`}>
                  <span>{s.account}</span>
                  <span className="mx-1">•</span>
                  <span className="text-slate-400">{s.tradeCount}笔</span>
                </div>

                <div className="flex items-center space-x-1 shrink-0">
                  {isGrid && (
                    <span className="px-1 py-0.2 text-[8px] bg-amber-500/20 text-amber-300 rounded font-sans">
                      网格
                    </span>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onQuickAddForStock(s);
                    }}
                    className="p-0.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded transition-all"
                    title={`为 ${s.stockName} 新增交易`}
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Embedded Customized Grid Strategy Card when a Stock is Selected */}
      {selectedStockCode && selectedStockObj && onSaveGridConfig && (
        <div className="pt-2">
          <GridStrategyCard
            stockCode={selectedStockObj.stockCode}
            stockName={selectedStockObj.stockName}
            account={selectedStockObj.account}
            strategyName={selectedStockObj.strategyName}
            config={currentGridConfig}
            onSaveConfig={onSaveGridConfig}
            onDeleteConfig={onDeleteGridConfig}
          />
        </div>
      )}
    </div>
  );
};

