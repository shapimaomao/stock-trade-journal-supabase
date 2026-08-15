import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  ArrowUpDown, 
  ArrowDown,
  Edit3, 
  Trash2, 
  Plus, 
  CheckSquare, 
  Square, 
  Download, 
  SlidersHorizontal,
  XCircle,
  Tag,
  Building,
  Save,
  Check,
  Undo2,
  Redo2
} from 'lucide-react';
import { TradeRecord } from '../types';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { formatStrategyOwner, getStrategyOwnerBadgeStyle } from '../lib/strategyOwners';

interface TradeTableProps {
  trades: TradeRecord[];
  selectedStockCode?: string | null;
  onEditTrade: (trade: TradeRecord) => void;
  onDeleteTrades: (ids: string[]) => void;
  onAddNewTrade: () => void;
  onExportExcel: (customTrades?: TradeRecord[]) => void;
  onSaveAndSync?: () => void;
  onToggleNoteCompleted?: (tradeId: string) => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
}

export const TradeTable: React.FC<TradeTableProps> = ({
  trades,
  selectedStockCode,
  onEditTrade,
  onDeleteTrades,
  onAddNewTrade,
  onExportExcel,
  onSaveAndSync,
  onToggleNoteCompleted,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [strategyFilter, setStrategyFilter] = useState('ALL');
  const [ownerFilter, setOwnerFilter] = useState('ALL');
  const [accountFilter, setAccountFilter] = useState('ALL');
  const [actionFilter, setActionFilter] = useState('ALL');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  // Sorting state
  const [sortField, setSortField] = useState<keyof TradeRecord>('tradeDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Auto-scroll refs
  const bottomRef = useRef<HTMLTableRowElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Extract unique strategies, owners and accounts for filter dropdowns
  const uniqueStrategies = useMemo(() => {
    return Array.from(new Set(trades.map(t => t.strategyName || '默认策略'))).filter(Boolean);
  }, [trades]);

  const uniqueOwners = useMemo(() => {
    return Array.from(new Set(trades.map(t => formatStrategyOwner(t.strategyType)).filter(Boolean)));
  }, [trades]);

  const uniqueAccounts = useMemo(() => {
    return Array.from(new Set(trades.map(t => t.account || '默认账户'))).filter(Boolean);
  }, [trades]);

  // Filter & Search Logic
  const filteredTrades = useMemo(() => {
    return trades.filter(t => {
      const matchSearch = 
        t.stockCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.stockName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.notes && t.notes.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchStrategy = strategyFilter === 'ALL' || t.strategyName === strategyFilter;
      const matchOwner = ownerFilter === 'ALL' || formatStrategyOwner(t.strategyType) === ownerFilter;
      const matchAccount = accountFilter === 'ALL' || t.account === accountFilter;
      const matchAction = actionFilter === 'ALL' || t.tradeAction === actionFilter;

      return matchSearch && matchStrategy && matchOwner && matchAccount && matchAction;
    });
  }, [trades, searchTerm, strategyFilter, ownerFilter, accountFilter, actionFilter]);

  // Sorting Logic
  const sortedTrades = useMemo(() => {
    return [...filteredTrades].sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (valA === undefined) valA = '';
      if (valB === undefined) valB = '';

      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      }

      return sortOrder === 'asc'
        ? String(valA).localeCompare(String(valB))
        : String(valB).localeCompare(String(valA));
    });
  }, [filteredTrades, sortField, sortOrder]);

  // Scroll to bottom helper
  const scrollToLastRecord = () => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
    if (tableContainerRef.current) {
      tableContainerRef.current.scrollTop = tableContainerRef.current.scrollHeight;
    }
  };

  // Auto-scroll down to the last record whenever component mounts or filtered data changes
  useEffect(() => {
    if (sortedTrades.length > 0) {
      const timer = setTimeout(() => {
        scrollToLastRecord();
      }, 120);
      return () => clearTimeout(timer);
    }
  }, [sortedTrades.length, searchTerm, strategyFilter, accountFilter, actionFilter, sortField, sortOrder]);

  const handleSort = (field: keyof TradeRecord) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const handleSelectAll = () => {
    if (selectedIds.length === sortedTrades.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(sortedTrades.map(t => t.id));
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  // Delete Confirmation Modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[]>([]);
  const [pendingDeleteDesc, setPendingDeleteDesc] = useState<string | undefined>(undefined);

  const handleOpenDeleteModal = (ids: string[], desc?: string) => {
    setPendingDeleteIds(ids);
    setPendingDeleteDesc(desc);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = () => {
    if (pendingDeleteIds.length > 0) {
      onDeleteTrades(pendingDeleteIds);
      setSelectedIds(prev => prev.filter(id => !pendingDeleteIds.includes(id)));
    }
    setPendingDeleteIds([]);
    setPendingDeleteDesc(undefined);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden my-4">
      {/* Table Header Controls */}
      <div className="p-4 border-b border-slate-800 bg-slate-900/90 flex flex-wrap gap-3 items-center justify-between">
        <div className="flex items-center space-x-2 flex-1 min-w-[240px]">
          <div className="relative w-full max-w-xs">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="搜索股票代码、名称或备注..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-9 pr-3 py-1.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-all"
            />
            {searchTerm && (
              <XCircle 
                className="w-4 h-4 absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-300 cursor-pointer"
                onClick={() => setSearchTerm('')}
              />
            )}
          </div>

          {/* Strategy Filter */}
          <select
            value={strategyFilter}
            onChange={e => setStrategyFilter(e.target.value)}
            className="bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
          >
            <option value="ALL">所有策略 ({uniqueStrategies.length})</option>
            {uniqueStrategies.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          {/* Strategy Owner Filter */}
          <select
            value={ownerFilter}
            onChange={e => setOwnerFilter(e.target.value)}
            className="bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 font-medium"
          >
            <option value="ALL">所有归属 ({uniqueOwners.length})</option>
            {uniqueOwners.map(o => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>

          {/* Account Filter */}
          <select
            value={accountFilter}
            onChange={e => setAccountFilter(e.target.value)}
            className="bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 hidden sm:block"
          >
            <option value="ALL">所有账户 ({uniqueAccounts.length})</option>
            {uniqueAccounts.map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>

          {/* Action Filter */}
          <select
            value={actionFilter}
            onChange={e => setActionFilter(e.target.value)}
            className="bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 hidden md:block"
          >
            <option value="ALL">全部方向 (买/卖/分红)</option>
            <option value="buy">仅买入</option>
            <option value="sell">仅卖出</option>
            <option value="dividend">仅分红 🎁</option>
          </select>
        </div>

        <div className="flex items-center space-x-2">
          {/* Undo / Redo Toolbar Controls */}
          <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={onUndo}
              disabled={!canUndo}
              title="撤销上一步操作 (Ctrl+Z)"
              className={`p-1.5 rounded-lg text-xs font-medium transition-all flex items-center space-x-1 ${
                canUndo
                  ? 'text-slate-200 hover:text-emerald-400 hover:bg-slate-800 cursor-pointer'
                  : 'text-slate-600 cursor-not-allowed opacity-40'
              }`}
            >
              <Undo2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline text-[11px]">撤销</span>
            </button>
            <button
              onClick={onRedo}
              disabled={!canRedo}
              title="重做操作 (Ctrl+Y / Ctrl+Shift+Z)"
              className={`p-1.5 rounded-lg text-xs font-medium transition-all flex items-center space-x-1 ${
                canRedo
                  ? 'text-slate-200 hover:text-emerald-400 hover:bg-slate-800 cursor-pointer'
                  : 'text-slate-600 cursor-not-allowed opacity-40'
              }`}
            >
              <Redo2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline text-[11px]">重做</span>
            </button>
          </div>

          {selectedIds.length > 0 && (
            <button
              onClick={() => handleOpenDeleteModal(selectedIds)}
              className="flex items-center space-x-1 px-3 py-1.5 bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30 rounded-xl text-xs font-medium transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>批量删除 ({selectedIds.length})</span>
            </button>
          )}

          {onSaveAndSync && (
            <button
              onClick={onSaveAndSync}
              className="flex items-center space-x-1 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-bold transition-all"
              title="一键保存全部成交记录并同步到数据库"
            >
              <Save className="w-3.5 h-3.5" />
              <span>保存数据</span>
            </button>
          )}

          <button
            onClick={scrollToLastRecord}
            className="flex items-center space-x-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/80 rounded-xl text-xs font-medium transition-all"
            title="点击平滑滚动至最后一条交易记录"
          >
            <ArrowDown className="w-3.5 h-3.5 text-emerald-400" />
            <span>直达底部</span>
          </button>

          {/* Export Excel Button with dynamic filtered scope label */}
          <button
            onClick={() => onExportExcel(sortedTrades)}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 rounded-xl text-xs font-semibold shadow-sm transition-all"
            title="导出当前查看的对账单 (只导出当前选定或筛选的股票/基金明细)"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>
              {selectedStockCode
                ? `导出当前【${sortedTrades[0]?.stockName || selectedStockCode}】对账单`
                : sortedTrades.length < trades.length
                ? `导出当前筛选对账单 (${sortedTrades.length}笔)`
                : '导出 Excel 对账单'}
            </span>
          </button>

          <button
            onClick={onAddNewTrade}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-500 text-slate-950 hover:bg-emerald-400 rounded-xl text-xs font-bold shadow-md transition-all"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>添加新成交记录</span>
          </button>
        </div>
      </div>

      {/* Main Financial Data Table */}
      <div ref={tableContainerRef} className="overflow-x-auto max-h-[75vh] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700">
        <table className="w-full text-left text-xs text-slate-300 whitespace-nowrap">
          <thead className="bg-slate-950 text-slate-300 uppercase tracking-tight font-semibold border-b border-slate-800 sticky top-0 z-10 shadow-md">
            <tr>
              <th className="px-1.5 py-2.5 w-7 text-center bg-slate-950">
                <input
                  type="checkbox"
                  checked={sortedTrades.length > 0 && selectedIds.length === sortedTrades.length}
                  onChange={handleSelectAll}
                  className="rounded bg-slate-900 border-slate-700 text-emerald-500 focus:ring-emerald-500"
                />
              </th>
              <th className="px-1.5 py-2.5 cursor-pointer hover:text-white bg-slate-950" onClick={() => handleSort('tradeDate')}>
                <div className="flex items-center gap-1">
                  <span>成交日期</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="px-2 py-2.5 cursor-pointer hover:text-white bg-slate-950" onClick={() => handleSort('stockCode')}>
                <div className="flex items-center gap-1">
                  <span>标的代码/名称</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="px-1.5 py-2.5 bg-slate-950">账户</th>
              <th className="px-1.5 py-2.5 bg-slate-950">策略名称</th>
              <th className="px-1.5 py-2.5 bg-slate-950">策略归属</th>
              <th className="px-1.5 py-2.5 bg-slate-950">类别</th>
              <th className="px-1.5 py-2.5 text-center bg-slate-950">买卖</th>
              <th className="px-1.5 py-2.5 text-right cursor-pointer hover:text-white bg-slate-950" onClick={() => handleSort('price')}>
                <div className="flex items-center justify-end gap-1">
                  <span>成交价格</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="px-1.5 py-2.5 text-right bg-slate-950">成交数量</th>
              <th className="px-1.5 py-2.5 text-right bg-slate-950">手续费</th>
              <th className="px-1.5 py-2.5 text-right bg-slate-950">发生金额</th>
              <th className="px-1.5 py-2.5 text-right bg-slate-950">累计投入本金</th>
              <th className="px-1.5 py-2.5 text-right bg-slate-950">累计持仓</th>
              <th className="px-1.5 py-2.5 text-right bg-slate-950">持仓成本</th>
              <th className="px-1.5 py-2.5 text-right bg-slate-950">涨跌比</th>
              <th className="px-1.5 py-2.5 text-right text-emerald-400 bg-slate-950">持仓盈亏%</th>
              <th className="px-1.5 py-2.5 text-right bg-slate-950">持仓盈亏</th>
              <th className="px-2 py-2.5 bg-slate-950">备注说明</th>
              <th className="px-1.5 py-2.5 text-center bg-slate-950">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono text-[11px] sm:text-xs">
            {sortedTrades.length === 0 ? (
              <tr>
                <td colSpan={20} className="px-4 py-12 text-center text-slate-500 font-sans">
                  暂无匹配的交易记录。请尝试调整筛选条件，或点击“添加新成交记录”/“导入Excel”。
                </td>
              </tr>
            ) : (
              sortedTrades.map(trade => {
                const isSelected = selectedIds.includes(trade.id);
                const isBuy = trade.tradeAction === 'buy';

                return (
                  <tr 
                    key={trade.id} 
                    className={`hover:bg-slate-800/40 transition-colors ${
                      isSelected ? 'bg-emerald-500/10' : ''
                    }`}
                  >
                    <td className="px-1.5 py-2 text-center font-sans">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelect(trade.id)}
                        className="rounded bg-slate-900 border-slate-700 text-emerald-500 focus:ring-emerald-500"
                      />
                    </td>
                    <td className="px-1.5 py-2 text-slate-300 font-sans whitespace-nowrap">
                      {trade.tradeDate}
                    </td>
                    <td className="px-2 py-2 font-sans whitespace-nowrap">
                      <div className="flex items-center space-x-1">
                        <span className="font-bold text-slate-100">{trade.stockName}</span>
                        {trade.isPendingConfirmation && (
                          <span className="bg-amber-500/20 text-amber-300 text-[9px] px-1 py-0.2 rounded border border-amber-500/30 font-semibold" title="当日暂存价，待公布结清净值">
                            ⏳ 待确认
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">{trade.stockCode}</div>
                    </td>
                    <td className="px-1.5 py-2 font-sans text-slate-300 whitespace-nowrap">
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]">
                        {trade.account}
                      </span>
                    </td>
                    <td className="px-1.5 py-2 font-sans whitespace-nowrap">
                      <span className="text-slate-200 font-medium text-[11px]">
                        {trade.strategyName}
                      </span>
                    </td>
                    <td className="px-1.5 py-2 font-sans whitespace-nowrap">
                      <span className={`px-2 py-0.5 text-[10px] rounded-full font-semibold ${getStrategyOwnerBadgeStyle(trade.strategyType)}`}>
                        {formatStrategyOwner(trade.strategyType)}
                      </span>
                    </td>
                    <td className="px-1.5 py-2 font-sans text-slate-400 text-[10px] whitespace-nowrap">
                      {trade.orderType === 'grid' ? '网格单' : trade.orderType === 'market' ? '市价' : trade.orderType === 'conditional' ? '条件单' : '限价'}
                    </td>
                    <td className="px-1.5 py-2 text-center font-sans whitespace-nowrap">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        trade.tradeAction === 'dividend'
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                          : isBuy 
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' 
                          : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      }`}>
                        {trade.tradeAction === 'dividend' ? '🎁 分红' : isBuy ? '买入' : '卖出'}
                      </span>
                    </td>
                    <td className="px-1.5 py-2 text-right font-bold text-slate-100 whitespace-nowrap">
                      ¥{trade.price.toFixed(3)}
                    </td>
                    <td className="px-1.5 py-2 text-right text-slate-200 whitespace-nowrap">
                      {trade.quantity.toLocaleString()}
                    </td>
                    <td className="px-1.5 py-2 text-right text-slate-300 whitespace-nowrap">
                      ¥{trade.fee.toFixed(2)}
                    </td>
                    <td className="px-1.5 py-2 text-right text-slate-200 whitespace-nowrap">
                      ¥{trade.amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 3 })}
                    </td>
                    <td className="px-1.5 py-2 text-right text-slate-400 whitespace-nowrap">
                      ¥{trade.accumulatedCapital.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 3 })}
                    </td>
                    <td className="px-1.5 py-2 text-right text-slate-300 whitespace-nowrap">
                      {trade.accumulatedPosition.toLocaleString()}
                    </td>
                    <td className="px-1.5 py-2 text-right text-slate-300 whitespace-nowrap">
                      {trade.accumulatedPosition === 0 ? (
                        <span className="text-emerald-400 font-sans text-[10px] bg-emerald-500/10 border border-emerald-500/20 px-1 py-0.2 rounded font-medium">已清仓</span>
                      ) : (
                        `¥${trade.positionCost.toFixed(3)}`
                      )}
                    </td>
                    <td className={`px-1.5 py-2 text-right font-semibold whitespace-nowrap ${
                      trade.tradeAction === 'dividend'
                        ? 'text-slate-500 font-normal'
                        : trade.gainLossRatio > 0 ? 'text-rose-400' : trade.gainLossRatio < 0 ? 'text-emerald-400' : 'text-slate-400'
                    }`}>
                      {trade.tradeAction === 'dividend' ? '-' : `${trade.gainLossRatio > 0 ? '+' : ''}${trade.gainLossRatio.toFixed(2)}%`}
                    </td>
                    <td className={`px-1.5 py-2 text-right font-semibold whitespace-nowrap ${
                      trade.accumulatedPosition === 0
                        ? ((trade.finalReturnRate ?? 0) > 0 ? 'text-rose-400' : (trade.finalReturnRate ?? 0) < 0 ? 'text-emerald-400' : 'text-slate-400')
                        : ((trade.positionPnLPercent ?? trade.gainLossRatio) > 0 
                            ? 'text-rose-400' 
                            : (trade.positionPnLPercent ?? trade.gainLossRatio) < 0 
                              ? 'text-emerald-400' 
                              : 'text-slate-400')
                    }`}>
                      {trade.accumulatedPosition === 0 ? (
                        trade.finalReturnRate !== undefined ? (
                          <div className="inline-flex flex-col items-end leading-tight" title="本轮清仓最终收益率">
                            <span>{trade.finalReturnRate > 0 ? '+' : ''}{trade.finalReturnRate.toFixed(2)}%</span>
                            <span className="text-[8px] text-amber-400/90 bg-amber-500/10 border border-amber-500/20 px-1 py-0.2 rounded font-sans font-normal">清仓收益率</span>
                          </div>
                        ) : '-'
                      ) : (
                        <>
                          {(trade.positionPnLPercent ?? trade.gainLossRatio) > 0 ? '+' : ''}
                          {(trade.positionPnLPercent ?? trade.gainLossRatio).toFixed(2)}%
                        </>
                      )}
                    </td>
                    <td className={`px-1.5 py-2 text-right font-medium whitespace-nowrap ${
                      trade.accumulatedPosition === 0
                        ? ((trade.finalPnL ?? 0) > 0 ? 'text-rose-400 font-bold' : (trade.finalPnL ?? 0) < 0 ? 'text-emerald-400 font-bold' : 'text-slate-500')
                        : trade.positionPnL > 0 ? 'text-rose-400' : trade.positionPnL < 0 ? 'text-emerald-400' : 'text-slate-400'
                    }`}>
                      {trade.accumulatedPosition === 0 ? (
                        trade.finalPnL !== undefined ? (
                          <div className="inline-flex flex-col items-end leading-tight" title="本轮清仓最终收益额">
                            <span>{trade.finalPnL > 0 ? '+' : ''}¥{trade.finalPnL.toFixed(2)}</span>
                            <span className="text-[8px] text-amber-400/90 bg-amber-500/10 border border-amber-500/20 px-1 py-0.2 rounded font-sans font-normal">清仓收益额</span>
                          </div>
                        ) : '-'
                      ) : `¥${trade.positionPnL.toFixed(2)}`}
                    </td>
                    <td className="px-2 py-2 font-sans min-w-[100px] max-w-[180px]">
                      {trade.notes ? (
                        <div className="flex flex-col items-start gap-0.5">
                          <span
                            className={`text-[11px] break-words line-clamp-2 leading-tight font-medium ${
                              trade.notesCompleted ? 'text-emerald-400' : 'text-orange-400'
                            }`}
                            title={trade.notes}
                          >
                            {trade.notes}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleNoteCompleted?.(trade.id);
                            }}
                            className={`inline-flex items-center gap-0.5 px-1 py-0.2 text-[9px] rounded border font-sans font-medium transition-all ${
                              trade.notesCompleted
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
                                : 'bg-orange-500/20 text-orange-300 border-orange-500/40 hover:bg-emerald-500/20 hover:text-emerald-300 hover:border-emerald-500/40'
                            }`}
                            title={trade.notesCompleted ? '点击重新标记为未完成' : '点击标记备注说明为已完成'}
                          >
                            <Check className="w-2.5 h-2.5" />
                            <span>{trade.notesCompleted ? '已完成' : '完成'}</span>
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </td>
                    <td className="px-1.5 py-2 text-center font-sans whitespace-nowrap">
                      <div className="flex items-center justify-center space-x-1">
                        <button
                          onClick={() => onEditTrade(trade)}
                          className="p-1 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded transition-colors"
                          title="编辑该记录"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleOpenDeleteModal([trade.id], `${trade.stockName} (${trade.stockCode})`)}
                          className="p-1 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors"
                          title="删除记录"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
            {/* Scroll Anchor to ensure jumping straight to bottom */}
            <tr ref={bottomRef} className="h-4 border-0 opacity-0">
              <td colSpan={21}></td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Footer Info */}
      <div className="px-4 py-3 border-t border-slate-800 bg-slate-950/90 flex items-center justify-between text-xs text-slate-400">
        <div>
          共 <span className="text-slate-200 font-semibold">{sortedTrades.length}</span> 笔对账记录（全量单页展示，无需翻页）
          {selectedIds.length > 0 && ` (已选中 ${selectedIds.length} 项)`}
        </div>

        <button
          onClick={scrollToLastRecord}
          className="flex items-center space-x-1 text-slate-400 hover:text-emerald-400 transition-colors"
        >
          <ArrowDown className="w-3.5 h-3.5" />
          <span>已定位至最后一条成交记录</span>
        </button>
      </div>

      <ConfirmDeleteModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        count={pendingDeleteIds.length}
        itemDescription={pendingDeleteDesc}
      />
    </div>
  );
};
