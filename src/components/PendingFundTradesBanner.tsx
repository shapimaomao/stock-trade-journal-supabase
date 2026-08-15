import React, { useState } from 'react';
import { TradeRecord } from '../types';
import { Bell, CheckCircle, Clock, Edit3, X, AlertTriangle } from 'lucide-react';

interface PendingFundTradesBannerProps {
  trades: TradeRecord[];
  onSaveTrade: (trade: Partial<TradeRecord>) => void;
  onEditTrade: (trade: TradeRecord) => void;
}

export const PendingFundTradesBanner: React.FC<PendingFundTradesBannerProps> = ({
  trades,
  onSaveTrade,
  onEditTrade,
}) => {
  const [isOpenModal, setIsOpenModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmedPrice, setConfirmedPrice] = useState<number | ''>('');
  const [confirmedFee, setConfirmedFee] = useState<number | ''>(0);

  // Filter pending fund trades
  const pendingTrades = trades.filter(t => t.isPendingConfirmation);

  if (pendingTrades.length === 0) return null;

  const handleQuickConfirm = (trade: TradeRecord) => {
    const numPrice = Number(confirmedPrice);
    if (!numPrice || numPrice <= 0) {
      alert('请输入有效的确切成交单位净值/价格！');
      return;
    }

    onSaveTrade({
      ...trade,
      price: numPrice,
      fee: Number(confirmedFee) || 0,
      isPendingConfirmation: false, // Mark as confirmed!
    });

    setEditingId(null);
    setConfirmedPrice('');
  };

  return (
    <>
      {/* Top Banner Alert */}
      <div className="bg-gradient-to-r from-amber-950/80 via-slate-900 to-amber-950/80 border border-amber-500/40 rounded-2xl p-4 shadow-lg mb-6 animate-fade-in relative overflow-hidden">
        <div className="absolute -right-4 -top-4 w-24 h-24 bg-amber-500/10 rounded-full blur-xl pointer-events-none" />
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 relative z-10">
          <div className="flex items-start space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center flex-shrink-0 font-bold border border-amber-500/30">
              <Bell className="w-5 h-5 animate-bounce" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-slate-100 text-sm">
                  🔔 支付宝基金成交净值待确认提醒 ({pendingTrades.length} 笔)
                </span>
                <span className="bg-amber-500/20 text-amber-300 text-[10px] font-mono px-2 py-0.5 rounded-full border border-amber-500/30">
                  T+1 净值同步
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                基金交易当日通常仅知买卖数量/暂估净值。次日9:00前基金公司公布确定净值后，请及时补全价格以计算精确持仓成本与持仓盈亏%。
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 self-end sm:self-center flex-shrink-0">
            <button
              onClick={() => setIsOpenModal(true)}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs shadow-md transition-all flex items-center space-x-1.5 active:scale-95"
            >
              <CheckCircle className="w-4 h-4" />
              <span>立即确认净值 ({pendingTrades.length} 笔)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Quick Confirmation Modal */}
      {isOpenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
              <div className="flex items-center space-x-2">
                <Clock className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="text-base font-bold text-slate-100">待确认净值的基金/股票明细</h3>
                  <p className="text-xs text-slate-400">核对昨晚/今早支付宝最新确切公布的成交单价，点击确认即刻更新成本对账</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpenModal(false)}
                className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-3">
              {pendingTrades.map(trade => (
                <div
                  key={trade.id}
                  className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3 hover:border-slate-700 transition-all"
                >
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div className="flex items-center space-x-2">
                      <span className="bg-sky-500/20 text-sky-300 text-xs px-2 py-0.5 rounded font-mono font-bold">
                        {trade.account || '支付宝基金'}
                      </span>
                      <span className="text-sm font-bold text-slate-100">{trade.stockName}</span>
                      <span className="text-xs text-slate-400 font-mono">({trade.stockCode})</span>
                    </div>
                    <span className="text-xs text-slate-400 font-mono">{trade.tradeDate}</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs font-mono text-slate-300">
                    <div>
                      <span className="text-slate-500 block text-[10px] font-sans">方向/数量</span>
                      <span className={trade.tradeAction === 'dividend' ? 'text-purple-300 font-bold' : trade.tradeAction === 'buy' ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}>
                        {trade.tradeAction === 'dividend' ? '分红' : trade.tradeAction === 'buy' ? '买入' : '卖出'} {trade.quantity} 份
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px] font-sans">暂估单价</span>
                      <span className="text-amber-400 font-bold">¥{trade.price.toFixed(4)}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px] font-sans">对应策略</span>
                      <span className="text-slate-300">{trade.strategyName}</span>
                    </div>
                  </div>

                  {editingId === trade.id ? (
                    <div className="bg-slate-900 border border-amber-500/40 rounded-xl p-3 space-y-2 mt-2">
                      <div className="text-xs font-bold text-amber-300 flex items-center space-x-1">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>输入公布的确切【成交单位净值】与【手续费】</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-slate-400 block mb-0.5 font-sans">公布单价 (元)</label>
                          <input
                            type="number"
                            step="0.0001"
                            value={confirmedPrice}
                            onChange={e => setConfirmedPrice(e.target.value === '' ? '' : Number(e.target.value))}
                            placeholder="如 1.2580"
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-amber-300 font-mono focus:border-emerald-500 focus:outline-none"
                            autoFocus
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400 block mb-0.5 font-sans">确认费用 (元)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={confirmedFee}
                            onChange={e => setConfirmedFee(e.target.value === '' ? '' : Number(e.target.value))}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200 font-mono focus:border-emerald-500 focus:outline-none"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end space-x-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="px-3 py-1 rounded-lg text-xs bg-slate-800 text-slate-300 hover:text-white"
                        >
                          取消
                        </button>
                        <button
                          type="button"
                          onClick={() => handleQuickConfirm(trade)}
                          className="px-3 py-1 rounded-lg text-xs bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400"
                        >
                          确认并更正成本
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-end space-x-2 pt-1 border-t border-slate-800/60">
                      <button
                        type="button"
                        onClick={() => {
                          onEditTrade(trade);
                          setIsOpenModal(false);
                        }}
                        className="px-2.5 py-1 text-xs text-slate-400 hover:text-slate-200 bg-slate-900 border border-slate-800 rounded-lg flex items-center space-x-1"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>完整编辑</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(trade.id);
                          setConfirmedPrice(trade.price);
                          setConfirmedFee(trade.fee);
                        }}
                        className="px-3 py-1 text-xs bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/40 font-bold rounded-lg flex items-center space-x-1"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>快捷填写确认价</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-900/90 text-right">
              <button
                onClick={() => setIsOpenModal(false)}
                className="px-4 py-2 bg-slate-800 text-slate-200 hover:bg-slate-700 rounded-xl text-xs font-bold"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
