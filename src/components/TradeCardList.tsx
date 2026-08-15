import React, { useState, useRef, useEffect } from 'react';
import { 
  ChevronDown, 
  ChevronUp, 
  Edit3, 
  Trash2, 
  Tag, 
  Building, 
  Receipt, 
  Calendar, 
  DollarSign, 
  Layers, 
  Plus, 
  Search, 
  X,
  FileText,
  ArrowDown,
  Check
} from 'lucide-react';
import { TradeRecord } from '../types';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { formatStrategyOwner, getStrategyOwnerBadgeStyle } from '../lib/strategyOwners';

interface TradeCardListProps {
  trades: TradeRecord[];
  onEditTrade: (trade: TradeRecord) => void;
  onDeleteTrades: (ids: string[]) => void;
  onAddNewTrade: () => void;
  onToggleNoteCompleted?: (tradeId: string) => void;
}

export const TradeCardList: React.FC<TradeCardListProps> = ({
  trades,
  onEditTrade,
  onDeleteTrades,
  onAddNewTrade,
  onToggleNoteCompleted,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  // Auto scroll ref
  const bottomRef = useRef<HTMLDivElement>(null);

  // Delete modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [pendingDeleteDesc, setPendingDeleteDesc] = useState<string | undefined>(undefined);

  const handleOpenDeleteModal = (id: string, desc?: string) => {
    setPendingDeleteId(id);
    setPendingDeleteDesc(desc);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = () => {
    if (pendingDeleteId) {
      onDeleteTrades([pendingDeleteId]);
    }
    setPendingDeleteId(null);
    setPendingDeleteDesc(undefined);
  };

  const filtered = trades.filter(t => 
    t.stockCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.stockName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.strategyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (t.notes && t.notes.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const scrollToLastRecord = () => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  };

  useEffect(() => {
    if (filtered.length > 0) {
      const timer = setTimeout(() => {
        scrollToLastRecord();
      }, 120);
      return () => clearTimeout(timer);
    }
  }, [filtered.length, searchTerm]);

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-3 my-4">
      {/* Mobile Search & Add Header */}
      <div className="flex items-center space-x-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="搜股票/代码/策略/备注..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-8 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
          {searchTerm && (
            <X 
              className="w-4 h-4 absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-300 cursor-pointer"
              onClick={() => setSearchTerm('')}
            />
          )}
        </div>

        <button
          onClick={onAddNewTrade}
          className="flex items-center space-x-1 px-3 py-2 bg-emerald-500 text-slate-950 rounded-xl text-xs font-bold shadow-md active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>记一笔</span>
        </button>
      </div>

      {/* Cards Stream */}
      {filtered.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-slate-500 text-xs">
          没有查找到符合条件的对账单明细
        </div>
      ) : (
        filtered.map(trade => {
          const isExpanded = !!expandedIds[trade.id];
          const isBuy = trade.tradeAction === 'buy';

          return (
            <div 
              key={trade.id}
              className="bg-slate-900 border border-slate-800/90 rounded-2xl p-4 shadow-sm hover:border-slate-700 transition-all space-y-3"
            >
              {/* Card Title & Buy/Sell Tag */}
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-slate-100 text-sm">{trade.stockName}</span>
                    <span className="text-xs font-mono text-slate-400">({trade.stockCode})</span>
                    {trade.isPendingConfirmation && (
                      <span className="bg-amber-500/20 text-amber-300 text-[10px] px-1.5 py-0.5 rounded border border-amber-500/30 font-semibold">
                        ⏳ 待确认净值
                      </span>
                    )}
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                      trade.tradeAction === 'dividend'
                        ? 'bg-purple-500/20 text-purple-300'
                        : isBuy
                        ? 'bg-rose-500/20 text-rose-400'
                        : 'bg-emerald-500/20 text-emerald-400'
                    }`}>
                      {trade.tradeAction === 'dividend' ? '🎁 分红' : isBuy ? '买入' : '卖出'}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2 text-[11px] text-slate-400 mt-1">
                    <span className="bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded">{trade.account}</span>
                    <span>•</span>
                    <span className="text-slate-300 font-medium">{trade.strategyName}</span>
                    <span className={`px-1.5 py-0.5 text-[10px] rounded font-semibold ${getStrategyOwnerBadgeStyle(trade.strategyType)}`}>
                      {formatStrategyOwner(trade.strategyType)}
                    </span>
                  </div>
                </div>

                <div className="text-right font-mono">
                  <div className="text-xs text-slate-400">{trade.tradeDate}</div>
                  <div className={`text-xs font-bold mt-0.5 ${
                    trade.accumulatedPnL > 0 ? 'text-rose-400' : trade.accumulatedPnL < 0 ? 'text-emerald-400' : 'text-slate-300'
                  }`}>
                    盈亏: ¥{trade.accumulatedPnL.toLocaleString('zh-CN', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                  </div>
                </div>
              </div>

              {/* Quick Metrics Grid */}
              <div className="grid grid-cols-3 gap-2 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/60 text-xs font-mono">
                <div>
                  <div className="text-[10px] text-slate-500">
                    {trade.tradeAction === 'dividend' ? '每股分红' : '成交单价'}
                  </div>
                  <div className="font-semibold text-slate-200">¥{trade.price.toFixed(3)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500">
                    {trade.tradeAction === 'dividend' ? '分红持仓' : '成交数量'}
                  </div>
                  <div className="font-semibold text-slate-200">{trade.quantity.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500">手续费(佣金)</div>
                  <div className={`font-semibold ${trade.tradeAction === 'dividend' ? 'text-slate-500 font-sans' : 'text-slate-200'}`}>
                    {trade.tradeAction === 'dividend' ? '免佣 (0.00)' : `¥${trade.fee.toFixed(2)}`}
                  </div>
                </div>
              </div>

              {/* Note preview if available */}
              {trade.notes && (
                <div className="text-xs bg-slate-800/50 p-2.5 rounded-xl flex items-center justify-between gap-2 border border-slate-800/80">
                  <div className="flex items-start space-x-1.5 min-w-0 flex-1">
                    <FileText className="w-3.5 h-3.5 text-slate-500 flex-shrink-0 mt-0.5" />
                    <span className={`text-xs break-words line-clamp-2 leading-snug font-medium ${
                      trade.notesCompleted ? 'text-emerald-400' : 'text-orange-400'
                    }`}>
                      {trade.notes}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onToggleNoteCompleted?.(trade.id)}
                    className={`flex-shrink-0 inline-flex items-center gap-1 px-2 py-1 text-[10px] rounded-lg border font-medium transition-all ${
                      trade.notesCompleted
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
                        : 'bg-orange-500/20 text-orange-300 border-orange-500/40 hover:bg-emerald-500/20 hover:text-emerald-300 hover:border-emerald-500/40'
                    }`}
                    title={trade.notesCompleted ? '点击重新标记为未完成' : '点击标记备注说明为已完成'}
                  >
                    <Check className="w-3 h-3" />
                    <span>{trade.notesCompleted ? '已完成' : '完成'}</span>
                  </button>
                </div>
              )}

              {/* Expandable Full 19-Field Details Drawer */}
              {isExpanded && (
                <div className="pt-2 border-t border-slate-800 text-xs font-mono space-y-1.5 text-slate-300">
                  <div className="flex justify-between py-0.5 border-b border-slate-800/40">
                    <span className="text-slate-500 font-sans">发生金额:</span>
                    <span className="font-semibold text-slate-100">¥{trade.amount.toLocaleString('zh-CN', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</span>
                  </div>
                  <div className="flex justify-between py-0.5 border-b border-slate-800/40">
                    <span className="text-slate-500 font-sans">累计投入本金:</span>
                    <span>¥{trade.accumulatedCapital.toLocaleString('zh-CN', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</span>
                  </div>
                  <div className="flex justify-between py-0.5 border-b border-slate-800/40">
                    <span className="text-slate-500 font-sans">累计持仓股数:</span>
                    <span>{trade.accumulatedPosition.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between py-0.5 border-b border-slate-800/40">
                    <span className="text-slate-500 font-sans">持仓成本均价:</span>
                    {trade.accumulatedPosition === 0 ? (
                      <span className="text-emerald-400 font-sans text-[11px] bg-emerald-500/10 px-1.5 py-0.5 rounded font-medium">已清仓</span>
                    ) : (
                      <span>¥{trade.positionCost.toFixed(3)}</span>
                    )}
                  </div>
                  <div className="flex justify-between py-0.5 border-b border-slate-800/40">
                    <span className="text-slate-500 font-sans">持仓盈亏:</span>
                    {trade.accumulatedPosition === 0 ? (
                      <span className="text-slate-500">-</span>
                    ) : (
                      <span className={trade.positionPnL > 0 ? 'text-rose-400' : trade.positionPnL < 0 ? 'text-emerald-400' : 'text-slate-300'}>
                        ¥{trade.positionPnL.toFixed(3)}
                      </span>
                    )}
                  </div>
                  <div className="flex justify-between py-0.5 border-b border-slate-800/40">
                    <span className="text-slate-500 font-sans">{trade.accumulatedPosition === 0 ? '清仓最终收益率:' : '持仓盈亏%:'}</span>
                    <span className={
                      trade.accumulatedPosition === 0
                        ? ((trade.finalReturnRate ?? 0) > 0 ? 'text-rose-400' : (trade.finalReturnRate ?? 0) < 0 ? 'text-emerald-400' : 'text-slate-300')
                        : ((trade.positionPnLPercent ?? trade.gainLossRatio) > 0 ? 'text-rose-400' : (trade.positionPnLPercent ?? trade.gainLossRatio) < 0 ? 'text-emerald-400' : 'text-slate-300')
                    }>
                      {trade.accumulatedPosition === 0 ? (
                        trade.finalReturnRate !== undefined ? `${trade.finalReturnRate > 0 ? '+' : ''}${trade.finalReturnRate.toFixed(3)}%` : '-'
                      ) : (
                        `${(trade.positionPnLPercent ?? trade.gainLossRatio) > 0 ? '+' : ''}${(trade.positionPnLPercent ?? trade.gainLossRatio).toFixed(3)}%`
                      )}
                    </span>
                  </div>
                  {trade.accumulatedPosition === 0 && trade.finalPnL !== undefined && (
                    <div className="flex justify-between py-0.5 border-b border-slate-800/40">
                      <span className="text-slate-500 font-sans">清仓最终收益额:</span>
                      <span className={`font-bold ${trade.finalPnL >= 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {trade.finalPnL > 0 ? '+' : ''}¥{trade.finalPnL.toFixed(3)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between py-0.5 border-b border-slate-800/40">
                    <span className="text-slate-500 font-sans">涨跌比:</span>
                    <span className={trade.tradeAction === 'dividend' ? 'text-slate-500 font-sans' : trade.gainLossRatio > 0 ? 'text-rose-400' : trade.gainLossRatio < 0 ? 'text-emerald-400' : 'text-slate-300'}>
                      {trade.tradeAction === 'dividend' ? '免算涨跌比 (-)' : `${trade.gainLossRatio > 0 ? '+' : ''}${trade.gainLossRatio.toFixed(3)}%`}
                    </span>
                  </div>
                  <div className="flex justify-between py-0.5">
                    <span className="text-slate-500 font-sans">委托类型:</span>
                    <span className="text-slate-300">{trade.orderType}</span>
                  </div>
                </div>
              )}

              {/* Card Footer Actions */}
              <div className="flex items-center justify-between pt-1">
                <button
                  onClick={() => toggleExpand(trade.id)}
                  className="flex items-center space-x-1 text-xs text-slate-400 hover:text-slate-200"
                >
                  <span>{isExpanded ? '收起完整明细' : '展开完整19项明细'}</span>
                  {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => onEditTrade(trade)}
                    className="p-1.5 text-slate-300 hover:text-emerald-400 bg-slate-800 rounded-lg text-xs flex items-center space-x-1"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>编辑</span>
                  </button>
                  <button
                    onClick={() => handleOpenDeleteModal(trade.id, `${trade.stockName} (${trade.stockCode})`)}
                    className="p-1.5 text-slate-400 hover:text-rose-400 bg-slate-800 rounded-lg text-xs"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })
      )}

      {/* Scroll Anchor */}
      <div ref={bottomRef} className="h-4" />

      <ConfirmDeleteModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        count={1}
        itemDescription={pendingDeleteDesc}
      />
    </div>
  );
};
