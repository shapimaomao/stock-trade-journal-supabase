import React, { useMemo, useState } from 'react';
import { ClipboardList, Check, Edit3, Calendar, Search, X, RefreshCw } from 'lucide-react';
import { TradeRecord } from '../types';

interface NotesTaskBoardProps {
  trades: TradeRecord[];
  onSetNoteStatus: (tradeId: string, status: boolean | null) => void;
  onEditTrade: (trade: TradeRecord) => void;
}

/**
 * 任务跟进板块: 按交易日期列出所有标记为"未完成"的备注任务, 便于后续跟进。
 * 支持筛选股票、一键标记完成、跳转编辑。
 */
export const NotesTaskBoard: React.FC<NotesTaskBoardProps> = ({
  trades,
  onSetNoteStatus,
  onEditTrade,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showRecentlyDone, setShowRecentlyDone] = useState(false);

  // 未完成任务: 有备注且 notesCompleted === false, 按交易日期升序
  const pendingTasks = useMemo(() => {
    return trades
      .filter(t => t.notes && t.notes.trim().length > 0 && t.notesCompleted === false)
      .filter(t =>
        !searchTerm ||
        t.stockName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.stockCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.notes || '').toLowerCase().includes(searchTerm.toLowerCase())
      )
      .sort((a, b) => {
        const d = String(a.tradeDate).localeCompare(String(b.tradeDate));
        if (d !== 0) return d < 0 ? -1 : 1;
        return String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
      });
  }, [trades, searchTerm]);

  // 最近完成的任务 (最多展示 20 条, 按日期倒序)
  const doneTasks = useMemo(() => {
    return trades
      .filter(t => t.notes && t.notes.trim().length > 0 && t.notesCompleted === true)
      .sort((a, b) => String(b.tradeDate).localeCompare(String(a.tradeDate)))
      .slice(0, 20);
  }, [trades]);

  // 按日期分组
  const groupByDate = (list: TradeRecord[]) => {
    const map = new Map<string, TradeRecord[]>();
    list.forEach(t => {
      const d = String(t.tradeDate).split(' ')[0];
      if (!map.has(d)) map.set(d, []);
      map.get(d)!.push(t);
    });
    return Array.from(map.entries());
  };

  const pendingGroups = groupByDate(pendingTasks);
  const totalStocks = new Set(pendingTasks.map(t => t.stockCode)).size;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden my-4">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 bg-slate-900/90 flex flex-wrap gap-3 items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-9 h-9 rounded-xl bg-orange-500/15 text-orange-400 flex items-center justify-center">
            <ClipboardList className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100">任务跟进 · 未完成备注</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              共 <span className="text-orange-300 font-semibold">{pendingTasks.length}</span> 条待跟进任务，涉及 {totalStocks} 只股票/基金（按交易日期排序）
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <div className="relative w-44">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-400" />
            <input
              type="text"
              placeholder="搜股票/备注..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-8 pr-7 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-orange-500 transition-all"
            />
            {searchTerm && (
              <X className="w-3.5 h-3.5 absolute right-2 top-2 text-slate-500 hover:text-slate-300 cursor-pointer" onClick={() => setSearchTerm('')} />
            )}
          </div>
          <button
            onClick={() => setShowRecentlyDone(v => !v)}
            className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-all ${
              showRecentlyDone
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                : 'bg-slate-950 text-slate-400 border-slate-700 hover:text-emerald-300 hover:border-emerald-500/40'
            }`}
            title="展开/收起最近已完成的任务"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>已完成({doneTasks.length})</span>
          </button>
        </div>
      </div>

      {/* Pending task list */}
      <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700">
        {pendingGroups.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-xs">
            {trades.some(t => t.notes && t.notesCompleted !== false)
              ? '🎉 当前没有标记为"未完成"的备注任务'
              : '提示: 在交易记录的备注里点击"未完成"按钮，任务就会出现在这里供你跟进'}
          </div>
        ) : (
          pendingGroups.map(([date, list]) => (
            <div key={date} className="space-y-2">
              <div className="flex items-center gap-2 sticky top-0 bg-slate-900 py-1 z-10">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-xs font-semibold text-slate-400 font-mono">{date}</span>
                <span className="text-[10px] text-slate-600">{list.length} 条</span>
                <div className="flex-1 h-px bg-slate-800" />
              </div>

              {list.map(t => (
                <div
                  key={t.id}
                  className="bg-slate-950/70 border border-slate-800 hover:border-orange-500/30 rounded-xl p-3 flex items-start justify-between gap-3 transition-all"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-slate-100">{t.stockName}</span>
                      <span className="text-[10px] font-mono text-slate-500">{t.stockCode}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                        t.tradeAction === 'dividend'
                          ? 'bg-purple-500/20 text-purple-300'
                          : t.tradeAction === 'buy'
                          ? 'bg-rose-500/20 text-rose-400'
                          : 'bg-emerald-500/20 text-emerald-400'
                      }`}>
                        {t.tradeAction === 'dividend' ? '分红' : t.tradeAction === 'buy' ? '买入' : '卖出'}
                      </span>
                    </div>
                    <p className="text-xs text-orange-300 mt-1.5 leading-snug break-words">{t.notes}</p>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => onSetNoteStatus(t.id, true)}
                      className="flex items-center gap-1 px-2 py-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 rounded-lg text-[11px] font-bold transition-all"
                      title="标记为已完成(备注变绿色)"
                    >
                      <Check className="w-3 h-3" />
                      完成
                    </button>
                    <button
                      onClick={() => onEditTrade(t)}
                      className="p-1.5 text-slate-500 hover:text-emerald-400 hover:bg-slate-800 rounded-lg transition-colors"
                      title="编辑这条交易记录"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ))
        )}

        {/* Recently done */}
        {showRecentlyDone && doneTasks.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-slate-800">
            <div className="text-xs font-semibold text-emerald-400/80">✓ 最近已完成（最多显示20条）</div>
            {doneTasks.map(t => (
              <div key={t.id} className="bg-slate-950/40 border border-slate-800/60 rounded-xl p-2.5 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <span className="text-[11px] font-bold text-slate-300">{t.stockName}</span>
                  <span className="text-[10px] text-slate-600 ml-1.5 font-mono">{String(t.tradeDate).split(' ')[0]}</span>
                  <p className="text-[11px] text-emerald-400/70 mt-1 break-words line-clamp-1">{t.notes}</p>
                </div>
                <button
                  onClick={() => onSetNoteStatus(t.id, false)}
                  className="flex-shrink-0 px-2 py-1 text-[10px] bg-slate-800 hover:bg-orange-500/20 text-slate-400 hover:text-orange-300 border border-slate-700 rounded-lg transition-all"
                  title="误标了？点击恢复为未完成"
                >
                  恢复未完成
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
