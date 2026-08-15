import React, { useState, useEffect, useMemo } from 'react';
import { X, Save, Calculator, AlertCircle, Sparkles, Check, Zap, Layers, HelpCircle, Plus } from 'lucide-react';
import { TradeRecord, StrategyType, TradeAction, OrderCategory } from '../types';
import { computeTradeDerivedFields } from '../lib/calculator';
import { getAllStrategyOwners, saveCustomStrategyOwner, formatStrategyOwner } from '../lib/strategyOwners';

interface QuickStockInfo {
  stockCode: string;
  stockName: string;
  account: string;
  strategyName: string;
  strategyType: StrategyType;
}

export function getRecommendedFee(accountStr: string, stockNameStr: string, stockCodeStr: string): number {
  const nameUpper = (stockNameStr || '').toUpperCase();
  const codeStr = (stockCodeStr || '').trim();
  const accStr = (accountStr || '').trim();

  const isETF = nameUpper.includes('ETF') ||
                codeStr.startsWith('159') ||
                codeStr.startsWith('510') ||
                codeStr.startsWith('588') ||
                codeStr.startsWith('51') ||
                codeStr.startsWith('15');

  if (isETF) {
    if (accStr.includes('华宝')) {
      return 0.2; // 华宝 ETF 0.2元
    }
    return 0.1; // 华泰/默认 ETF 0.1元
  }

  // 股票默认 5.0元
  return 5.0;
}

interface TradeFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (trade: Partial<TradeRecord>) => void;
  initialTrade?: TradeRecord | null;
  existingTrades?: TradeRecord[];
  quickStockInfo?: QuickStockInfo | null;
}

export const TradeFormModal: React.FC<TradeFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialTrade,
  existingTrades = [],
  quickStockInfo,
}) => {
  const [stockCode, setStockCode] = useState('');
  const [stockName, setStockName] = useState('');
  const [account, setAccount] = useState('华泰证券');
  const [strategyName, setStrategyName] = useState('核心波段');
  const [strategyType, setStrategyType] = useState<StrategyType>('自己');
  const [isAddingCustomOwner, setIsAddingCustomOwner] = useState(false);
  const [newOwnerInput, setNewOwnerInput] = useState('');

  // Dynamically compute all available strategy owners
  const ownerOptions = useMemo(() => {
    return getAllStrategyOwners(existingTrades);
  }, [existingTrades, isAddingCustomOwner]);

  const handleAddNewOwner = () => {
    const clean = newOwnerInput.trim();
    if (clean) {
      saveCustomStrategyOwner(clean);
      setStrategyType(clean);
      setNewOwnerInput('');
      setIsAddingCustomOwner(false);
    }
  };
  const [tradeDate, setTradeDate] = useState(new Date().toISOString().split('T')[0]);
  const [orderType, setOrderType] = useState<OrderCategory>('limit');
  const [tradeAction, setTradeAction] = useState<TradeAction>('buy');
  const [price, setPrice] = useState<number | ''>(10.00);
  const [quantity, setQuantity] = useState<number | ''>(1000);
  const [fee, setFee] = useState<number | ''>(5.00);
  const [notes, setNotes] = useState('');
  // 备注状态三态: '' = 未标记(白色) / 'uncomplete' = 未完成(橙色) / 'complete' = 完成(绿色)
  const [notesStatus, setNotesStatus] = useState<'' | 'uncomplete' | 'complete'>('');
  const [isPendingConfirmation, setIsPendingConfirmation] = useState(false);

  // Grid Strategy Helper States
  const [gridStepPercent, setGridStepPercent] = useState<number>(1.0); // 网格步长比例 (%)
  const [gridStepQuantity, setGridStepQuantity] = useState<number>(1000); // 单格成交股数

  // Extract unique stock/strategy templates from previous trades for quick inheritance
  const presets = useMemo(() => {
    const map = new Map<string, QuickStockInfo>();
    existingTrades.forEach(t => {
      if (!t.stockCode) return;
      if (!map.has(t.stockCode)) {
        map.set(t.stockCode, {
          stockCode: t.stockCode,
          stockName: t.stockName,
          account: t.account,
          strategyName: t.strategyName,
          strategyType: t.strategyType,
        });
      }
    });
    return Array.from(map.values());
  }, [existingTrades]);

  // Fill preset metadata helper
  const applyPreset = (preset: QuickStockInfo) => {
    setStockCode(preset.stockCode);
    setStockName(preset.stockName);
    setAccount(preset.account);
    setStrategyName(preset.strategyName);
    setStrategyType(preset.strategyType);
    setFee(getRecommendedFee(preset.account, preset.stockName, preset.stockCode));

    // If strategy contains "网格" or previous trade used grid order, auto set orderType
    const matchingTrades = existingTrades.filter(t => t.stockCode === preset.stockCode);
    if (matchingTrades.length > 0) {
      const latest = matchingTrades[0];
      if (latest.orderType) setOrderType(latest.orderType);
      if (latest.quantity) {
        setGridStepQuantity(latest.quantity);
        if (latest.orderType === 'grid' || latest.strategyName.includes('网格')) {
          setQuantity(latest.quantity);
        }
      }
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    if (initialTrade) {
      setStockCode(initialTrade.stockCode);
      setStockName(initialTrade.stockName);
      setAccount(initialTrade.account);
      setStrategyName(initialTrade.strategyName);
      setStrategyType(formatStrategyOwner(initialTrade.strategyType));
      setTradeDate(initialTrade.tradeDate);
      setOrderType(initialTrade.orderType);
      setTradeAction(initialTrade.tradeAction);
      setPrice(initialTrade.price);
      setQuantity(initialTrade.quantity);
      setFee(initialTrade.fee);
      setNotes(initialTrade.notes || '');
      setNotesStatus(
        initialTrade.notesCompleted === true ? 'complete'
        : initialTrade.notesCompleted === false ? 'uncomplete'
        : ''
      );
      setIsPendingConfirmation(!!initialTrade.isPendingConfirmation);
    } else if (quickStockInfo) {
      setTradeDate(new Date().toISOString().split('T')[0]);
      setOrderType('limit');
      setTradeAction('buy');
      setPrice(10.00);
      setFee(getRecommendedFee(quickStockInfo.account, quickStockInfo.stockName, quickStockInfo.stockCode));
      setNotes('');
      setNotesStatus('');
      setIsPendingConfirmation(quickStockInfo.account.includes('支付宝'));
      applyPreset(quickStockInfo);
    } else {
      setTradeDate(new Date().toISOString().split('T')[0]);
      setOrderType('limit');
      setTradeAction('buy');
      setPrice(10.00);
      setQuantity(1000);
      setNotes('');
      setNotesStatus('');
      setIsPendingConfirmation(false);
      if (presets.length > 0) {
        applyPreset(presets[0]);
      } else {
        setStockCode('');
        setStockName('');
        setAccount('华泰证券');
        setStrategyName('网格套利');
        setStrategyType('自己');
        setFee(5.00);
      }
    }
  }, [initialTrade, quickStockInfo, isOpen]);

  // Auto-matching when user types a matching stock code
  const handleStockCodeChange = (codeVal: string) => {
    setStockCode(codeVal);
    const matched = existingTrades.find(t => t.stockCode.toLowerCase() === codeVal.trim().toLowerCase());
    if (matched) {
      setStockName(matched.stockName);
      setAccount(matched.account);
      setStrategyName(matched.strategyName);
      setStrategyType(matched.strategyType);
      setFee(getRecommendedFee(matched.account, matched.stockName, codeVal));
      if (matched.orderType === 'grid' || matched.strategyName.includes('网格')) {
        setOrderType('grid');
        setQuantity(matched.quantity);
        setGridStepQuantity(matched.quantity);
      }
    } else {
      setFee(getRecommendedFee(account, stockName, codeVal));
    }
  };

  // When switching order category to grid, automatically pre-fill quantity with grid step quantity
  const handleOrderTypeChange = (newType: OrderCategory) => {
    setOrderType(newType);
    if (newType === 'grid') {
      setQuantity(gridStepQuantity);
    }
  };

  if (!isOpen) return null;

  // Real-time calculated amounts (发生金额 = 成交价格 * 成交数量，不计算手续费)
  const numPrice = Number(price) || 0;
  const numQty = Number(quantity) || 0;
  const numFee = tradeAction === 'dividend' ? 0 : (Number(fee) || 0);
  const calculatedAmount = numPrice * numQty;

  // Grid Strategy Variance Calculation (1.5x Step Warning)
  const isGridMode = orderType === 'grid' || strategyName.includes('网格');
  
  // Find last trade for this stock/strategy to calculate price variance
  const prevTradesForStock = existingTrades.filter(
    t => t.stockCode === stockCode && t.id !== initialTrade?.id
  );
  const lastTradePrice = prevTradesForStock.length > 0 ? prevTradesForStock[0].price : 0;

  let gridVarianceWarning = '';
  let actualPercentChange = 0;
  let varianceRatio = 0;
  let skippedSteps = 0;

  if (isGridMode && lastTradePrice > 0 && numPrice > 0 && gridStepPercent > 0) {
    actualPercentChange = Math.abs((numPrice - lastTradePrice) / lastTradePrice) * 100;
    varianceRatio = actualPercentChange / gridStepPercent;

    if (varianceRatio >= 1.5) {
      skippedSteps = Math.max(1, Math.round(varianceRatio) - 1);
      if (tradeAction === 'buy') {
        gridVarianceWarning = `⚠️ [网格提醒] 实际跌幅 (${actualPercentChange.toFixed(2)}%) 已超过设定网格步长(${gridStepPercent}%)的 ${varianceRatio.toFixed(1)} 倍(超过1.5倍)！可能因跨格/踩空少买了 ${skippedSteps} 份 (缺 ${skippedSteps * (Number(quantity) || gridStepQuantity)} 股)。`;
      } else {
        gridVarianceWarning = `⚠️ [网格提醒] 实际涨幅 (${actualPercentChange.toFixed(2)}%) 已超过设定网格步长(${gridStepPercent}%)的 ${varianceRatio.toFixed(1)} 倍(超过1.5倍)！可能因跨格/踏空少卖了 ${skippedSteps} 份 (缺 ${skippedSteps * (Number(quantity) || gridStepQuantity)} 股)。`;
      }
    }
  }

  const handleAppendNotes = (textToAppend: string) => {
    if (!notes) {
      setNotes(textToAppend);
    } else if (!notes.includes(textToAppend)) {
      setNotes(notes + '\n' + textToAppend);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockCode || !stockName || numPrice <= 0 || numQty <= 0) {
      alert('请填写入场股票代码、名称、有效成交价格与数量！');
      return;
    }

    // Auto append 1.5x warning if applicable and user hasn't opted out
    let finalNotes = notes.trim();

    const partial: Partial<TradeRecord> = {
      id: initialTrade?.id,
      stockCode: stockCode.trim(),
      stockName: stockName.trim(),
      account: account.trim(),
      strategyName: strategyName.trim(),
      strategyType,
      tradeDate,
      orderType,
      tradeAction,
      price: numPrice,
      quantity: numQty,
      fee: numFee,
      isPendingConfirmation,
      notes: finalNotes,
      // 三态: undefined=未标记(白) / false=未完成(橙) / true=完成(绿)
      notesCompleted: finalNotes.length === 0
        ? undefined
        : notesStatus === 'complete' ? true
        : notesStatus === 'uncomplete' ? false
        : undefined,
    };

    const computed = computeTradeDerivedFields(partial, prevTradesForStock);
    onSave(computed);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
              <Calculator className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">
                {initialTrade ? '编辑成交记录明细' : '新增成交对账明细'}
              </h3>
              <p className="text-[11px] text-slate-400">自动智能继承已有标的/策略参数，网格条件单智能步长与少买少卖提醒</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Stock Template Selector Bar */}
        {presets.length > 0 && !initialTrade && (
          <div className="bg-slate-950/80 px-6 py-2.5 border-b border-slate-800/80 text-xs flex items-center space-x-2 overflow-x-auto">
            <span className="text-slate-400 flex items-center space-x-1 flex-shrink-0 font-medium">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>智能匹配套用:</span>
            </span>
            <div className="flex items-center space-x-2 overflow-x-auto">
              {presets.map(p => (
                <button
                  key={p.stockCode}
                  type="button"
                  onClick={() => applyPreset(p)}
                  className={`flex-shrink-0 px-2.5 py-1 rounded-lg border text-[11px] font-mono transition-all ${
                    stockCode === p.stockCode
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold'
                      : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800'
                  }`}
                >
                  {p.stockName} ({p.stockCode}) • {p.strategyName}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 text-xs text-slate-300">
          {/* Auto Calculation & Easy Input Callout */}
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-3 text-xs text-emerald-300 flex items-start space-x-2.5">
            <Sparkles className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <div className="font-bold text-slate-100">✨ 极简记账模式：您只需录入【价格】与【数量】（买/卖）</div>
              <div className="text-slate-300 text-[11px] leading-relaxed">
                系统的专业对账引擎会自动精算：<strong>资金交收额</strong>、<strong>加权持仓成本价</strong>、<strong>持仓盈亏%</strong>、<strong>持仓盈亏(元)</strong>及<strong>累计盈亏</strong>。佣金已根据股票/ETF(华泰0.1元/华宝0.2元/股票5元)自动匹配默认，无需复杂手算。
              </div>
            </div>
          </div>

          {/* Stock Code & Stock Name */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-300 mb-1">股票代码 *</label>
              <input
                type="text"
                placeholder="例如 600519 / 000001"
                required
                value={stockCode}
                onChange={e => handleStockCodeChange(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-300 mb-1">股票名称 *</label>
              <input
                type="text"
                placeholder="例如 贵州茅台"
                required
                value={stockName}
                onChange={e => setStockName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Account & Strategy Name */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block font-medium text-slate-300">股票账户行/渠道</label>
              </div>
              <input
                type="text"
                placeholder="华泰证券 / 支付宝基金 / 招商证券"
                value={account}
                onChange={e => {
                  const val = e.target.value;
                  setAccount(val);
                  if (val.includes('支付宝')) {
                    setFee(0.0);
                    setIsPendingConfirmation(true);
                  }
                }}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
              />
              <div className="flex flex-wrap gap-1 mt-1.5">
                <button
                  type="button"
                  onClick={() => { setAccount('华泰证券'); setFee(0.1); setIsPendingConfirmation(false); }}
                  className={`px-2 py-0.5 text-[10px] rounded-md border transition-all ${
                    account === '华泰证券' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50' : 'bg-slate-950 text-slate-400 border-slate-800'
                  }`}
                >
                  华泰证券
                </button>
                <button
                  type="button"
                  onClick={() => { setAccount('支付宝基金'); setFee(0.0); setIsPendingConfirmation(true); }}
                  className={`px-2 py-0.5 text-[10px] rounded-md border transition-all ${
                    account.includes('支付宝') ? 'bg-sky-500/20 text-sky-300 border-sky-500/50 font-bold' : 'bg-slate-950 text-slate-400 border-slate-800'
                  }`}
                >
                  💙 支付宝基金
                </button>
                <button
                  type="button"
                  onClick={() => { setAccount('招商证券'); setFee(5.0); setIsPendingConfirmation(false); }}
                  className={`px-2 py-0.5 text-[10px] rounded-md border transition-all ${
                    account === '招商证券' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50' : 'bg-slate-950 text-slate-400 border-slate-800'
                  }`}
                >
                  招商证券
                </button>
              </div>
            </div>

            <div>
              <label className="block font-medium text-slate-300 mb-1">策略名称</label>
              <input
                type="text"
                placeholder="网格交易 / 波段突破 / 定投长线"
                value={strategyName}
                onChange={e => setStrategyName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Pending Net Value Confirmation Toggle (Fund specific) */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="pendingConfirmation"
                checked={isPendingConfirmation}
                onChange={e => setIsPendingConfirmation(e.target.checked)}
                className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500 bg-slate-900 border-slate-700"
              />
              <label htmlFor="pendingConfirmation" className="text-xs font-semibold text-amber-300 cursor-pointer">
                ⏳ 成交价格/净值尚待确认 (当日支付宝基金，次日9点后提醒确认)
              </label>
            </div>
            {isPendingConfirmation && (
              <span className="text-[10px] text-amber-400/80 font-mono">当日暂存估计价</span>
            )}
          </div>

          {/* Strategy Type & Trade Direction */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block font-medium text-slate-300">策略归属 *</label>
                <button
                  type="button"
                  onClick={() => setIsAddingCustomOwner(!isAddingCustomOwner)}
                  className="text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold flex items-center space-x-0.5"
                >
                  <Plus className="w-3 h-3" />
                  <span>新增归属</span>
                </button>
              </div>

              {isAddingCustomOwner ? (
                <div className="bg-slate-900 border border-emerald-500/50 p-2 rounded-xl space-y-2">
                  <div className="text-[11px] text-slate-300 font-medium">输入新策略归属名称：</div>
                  <div className="flex space-x-1.5">
                    <input
                      type="text"
                      placeholder="例如: E大、E大S、长川..."
                      value={newOwnerInput}
                      onChange={e => setNewOwnerInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddNewOwner();
                        }
                      }}
                      className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-emerald-500"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={handleAddNewOwner}
                      className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-lg transition-all"
                    >
                      确定
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsAddingCustomOwner(false)}
                      className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-400 text-xs rounded-lg"
                    >
                      取消
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <select
                    value={strategyType}
                    onChange={e => {
                      if (e.target.value === '__ADD_NEW__') {
                        setIsAddingCustomOwner(true);
                      } else {
                        setStrategyType(e.target.value);
                      }
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500 font-medium"
                  >
                    {ownerOptions.map(owner => (
                      <option key={owner} value={owner}>
                        {owner}
                      </option>
                    ))}
                    <option value="__ADD_NEW__">+ 新增策略归属选项...</option>
                  </select>

                  {/* Quick select pill options */}
                  <div className="flex flex-wrap gap-1">
                    {ownerOptions.map(owner => (
                      <button
                        key={owner}
                        type="button"
                        onClick={() => setStrategyType(owner)}
                        className={`px-2 py-0.5 text-[10px] rounded-md border transition-all ${
                          strategyType === owner
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 font-bold'
                            : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                        }`}
                      >
                        {owner}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block font-medium text-slate-300 mb-1 font-sans">交易类型 / 方向 *</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setTradeAction('buy')}
                  className={`py-2 rounded-xl font-bold transition-all text-xs sm:text-sm ${
                    tradeAction === 'buy'
                      ? 'bg-rose-500 text-white shadow-md'
                      : 'bg-slate-950 text-slate-400 border border-slate-700 hover:text-white'
                  }`}
                >
                  买入
                </button>
                <button
                  type="button"
                  onClick={() => setTradeAction('sell')}
                  className={`py-2 rounded-xl font-bold transition-all text-xs sm:text-sm ${
                    tradeAction === 'sell'
                      ? 'bg-emerald-500 text-slate-950 shadow-md'
                      : 'bg-slate-950 text-slate-400 border border-slate-700 hover:text-white'
                  }`}
                >
                  卖出
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTradeAction('dividend');
                    setFee(0);
                    // Pre-fill quantity with current holding shares if available
                    const stockTrades = existingTrades.filter(t => t.stockCode === stockCode);
                    if (stockTrades.length > 0) {
                      const sorted = [...stockTrades].sort((a,b) => new Date(a.tradeDate).getTime() - new Date(b.tradeDate).getTime());
                      const currentPos = sorted[sorted.length - 1].accumulatedPosition;
                      if (currentPos > 0) {
                        setQuantity(currentPos);
                      }
                    }
                  }}
                  className={`py-2 rounded-xl font-bold transition-all text-xs sm:text-sm ${
                    tradeAction === 'dividend'
                      ? 'bg-purple-600 text-white shadow-md'
                      : 'bg-slate-950 text-slate-400 border border-slate-700 hover:text-white'
                  }`}
                >
                  🎁 分红
                </button>
              </div>
            </div>
          </div>

          {/* Trade Date & Order Category */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-300 mb-1">成交日期</label>
              <input
                type="date"
                value={tradeDate}
                onChange={e => setTradeDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-300 mb-1">委托类别</label>
              <select
                value={orderType}
                onChange={e => handleOrderTypeChange(e.target.value as OrderCategory)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500 font-medium"
              >
                <option value="limit">限价单</option>
                <option value="grid">网格条件单 (自动匹配单格股数)</option>
                <option value="market">市价单</option>
                <option value="conditional">条件单</option>
              </select>
            </div>
          </div>

          {/* Grid Strategy Smart Config Panel */}
          {isGridMode && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between text-emerald-400">
                <div className="flex items-center space-x-1.5 font-bold">
                  <Sparkles className="w-4 h-4" />
                  <span>网格策略自动数控与异常步长提醒引擎</span>
                </div>
                <span className="text-[10px] text-emerald-300 font-mono">
                  上次参考成交价: {lastTradePrice > 0 ? `¥${lastTradePrice.toFixed(2)}` : '无历史记录'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 font-mono">
                <div>
                  <label className="block text-[11px] text-slate-300 mb-1 font-sans">
                    单格成交数量 (股/每份)
                  </label>
                  <input
                    type="number"
                    step="100"
                    value={gridStepQuantity}
                    onChange={e => {
                      const v = Number(e.target.value) || 0;
                      setGridStepQuantity(v);
                      setQuantity(v);
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2 text-slate-100 focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-slate-300 mb-1 font-sans">
                    策略网格步长比 (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={gridStepPercent}
                    onChange={e => setGridStepPercent(Number(e.target.value) || 1.0)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2 text-slate-100 focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* 1.5x Step Variance Alert Box */}
              {gridVarianceWarning ? (
                <div className="bg-amber-500/15 border border-amber-500/30 rounded-xl p-3 text-amber-300 space-y-2">
                  <div className="flex items-start space-x-2 text-xs">
                    <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                    <span>{gridVarianceWarning}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAppendNotes(gridVarianceWarning)}
                    className="px-3 py-1 bg-amber-500 text-slate-950 hover:bg-amber-400 rounded-lg text-[11px] font-bold shadow transition-all"
                  >
                    一键将此少买/少卖提醒写入备注
                  </button>
                </div>
              ) : (
                lastTradePrice > 0 && numPrice > 0 && (
                  <div className="text-[11px] text-slate-400 font-mono">
                    较上次成交价变动: <strong className="text-slate-200">{actualPercentChange.toFixed(2)}%</strong> 
                    （网格步长倍数: {varianceRatio.toFixed(2)}x，未超出1.5倍阈值，交易符合单格走势）
                  </div>
                )
              )}
            </div>
          )}

          {/* Price, Quantity, Fee */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-medium text-slate-300 mb-1">
                {tradeAction === 'dividend' ? '每股分红价格 (元) *' : '成交价格 (元) *'}
              </label>
              <input
                type="number"
                step="0.0001"
                required
                placeholder={tradeAction === 'dividend' ? '例如 0.50' : '10.00'}
                value={price}
                onChange={e => setPrice(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-purple-500 font-mono"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block font-medium text-slate-300">
                  {tradeAction === 'dividend' ? '分红数量 (持仓股数) *' : '成交数量 (股) *'}
                </label>
                {tradeAction === 'dividend' && (
                  <span className="text-[10px] text-purple-300 font-mono">(根据现有持仓)</span>
                )}
                {tradeAction !== 'dividend' && isGridMode && (
                  <span className="text-[10px] text-emerald-400 font-mono">(自动单格数)</span>
                )}
              </div>
              <input
                type="number"
                step="1"
                required
                value={quantity}
                onChange={e => setQuantity(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-purple-500 font-mono"
              />
              {tradeAction !== 'dividend' && isGridMode && (
                <p className="text-[10px] text-emerald-400 font-sans mt-1">
                  ⚡ 网格策略: 默认自动填入上次成交股数 ({quantity}股)，如有不同可自由修改
                </p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block font-medium text-slate-300">
                  {tradeAction === 'dividend' ? '分红总金额 (元到账)' : '手续费/佣金 (元)'}
                </label>
                {tradeAction !== 'dividend' && (
                  <span className="text-[10px] text-slate-400 font-mono">
                    (推荐: ¥{getRecommendedFee(account, stockName, stockCode)})
                  </span>
                )}
              </div>

              {tradeAction === 'dividend' ? (
                <input
                  type="number"
                  step="0.01"
                  placeholder="分红到账总额"
                  value={calculatedAmount > 0 ? Number(calculatedAmount.toFixed(2)) : ''}
                  onChange={e => {
                    const totalAmt = Number(e.target.value) || 0;
                    if (numQty > 0) {
                      setPrice(Number((totalAmt / numQty).toFixed(4)));
                    }
                  }}
                  className="w-full bg-slate-950 border border-purple-500/50 rounded-xl px-3 py-2 text-purple-300 focus:outline-none focus:border-purple-400 font-mono font-bold"
                />
              ) : (
                <input
                  type="number"
                  step="0.01"
                  value={fee}
                  onChange={e => setFee(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500 font-mono"
                />
              )}

              {tradeAction === 'dividend' ? (
                <div className="text-[10px] text-purple-300/80 mt-1 font-mono">
                  🎁 分红免手续费。修改分红总额会自动换算每股价格
                </div>
              ) : (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  <button
                    type="button"
                    onClick={() => setFee(5.0)}
                    className={`px-2 py-0.5 text-[10px] rounded-md border font-mono transition-all ${
                      Number(fee) === 5.0
                        ? 'bg-slate-800 text-slate-100 border-slate-600 font-bold'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    ¥5.0 股票
                  </button>
                  <button
                    type="button"
                    onClick={() => setFee(0.1)}
                    className={`px-2 py-0.5 text-[10px] rounded-md border font-mono transition-all ${
                      Number(fee) === 0.1
                        ? 'bg-slate-800 text-slate-100 border-slate-600 font-bold'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    ¥0.1 华泰ETF
                  </button>
                  <button
                    type="button"
                    onClick={() => setFee(0.2)}
                    className={`px-2 py-0.5 text-[10px] rounded-md border font-mono transition-all ${
                      Number(fee) === 0.2
                        ? 'bg-slate-800 text-slate-100 border-slate-600 font-bold'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    ¥0.2 华宝ETF
                  </button>
                  <button
                    type="button"
                    onClick={() => setFee(0.0)}
                    className={`px-2 py-0.5 text-[10px] rounded-md border font-mono transition-all ${
                      Number(fee) === 0.0
                        ? 'bg-slate-800 text-slate-100 border-slate-600 font-bold'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    ¥0.0 免佣
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Live Amount Box */}
          {tradeAction === 'dividend' ? (
            <div className="bg-purple-950/40 border border-purple-500/30 p-3.5 rounded-xl flex items-center justify-between text-xs font-mono">
              <div>
                <span className="text-purple-300 font-bold block">🎁 分红现金到账总额 (发生金额):</span>
                <span className="text-slate-400 text-[11px] font-sans">
                  每股分红 ¥{numPrice.toFixed(4)} × {numQty.toLocaleString()} 股 (自动扣减持仓成本价，无需计算涨跌比)
                </span>
              </div>
              <span className="text-base font-bold text-purple-300">
                +¥{calculatedAmount.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
              </span>
            </div>
          ) : (
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400">实时对账发生金额:</span>
              <span className="text-base font-bold text-emerald-400">
                ¥{calculatedAmount.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
              </span>
            </div>
          )}

          {/* Notes & Memo Helpers */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block font-medium text-slate-300">交易备注 / 下笔买卖挂单准备计划</label>
              {notes.trim().length > 0 && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setNotesStatus(notesStatus === 'uncomplete' ? '' : 'uncomplete')}
                    className={`px-2 py-0.5 text-[11px] rounded-lg border font-medium transition-all ${
                      notesStatus === 'uncomplete'
                        ? 'bg-orange-500/25 text-orange-300 border-orange-500/50'
                        : 'bg-slate-950 text-slate-400 border-slate-700 hover:text-orange-300 hover:border-orange-500/40'
                    }`}
                    title="标记为未完成，备注显示橙色"
                  >
                    ⏳ 未完成
                  </button>
                  <button
                    type="button"
                    onClick={() => setNotesStatus(notesStatus === 'complete' ? '' : 'complete')}
                    className={`px-2 py-0.5 text-[11px] rounded-lg border font-medium transition-all ${
                      notesStatus === 'complete'
                        ? 'bg-emerald-500/25 text-emerald-300 border-emerald-500/50'
                        : 'bg-slate-950 text-slate-400 border-slate-700 hover:text-emerald-300 hover:border-emerald-500/40'
                    }`}
                    title="标记为完成，备注显示绿色"
                  >
                    ✓ 完成
                  </button>
                  {notesStatus === '' && (
                    <span className="text-[10px] text-slate-500">默认白色</span>
                  )}
                </div>
              )}
            </div>
            <textarea
              rows={3}
              placeholder="记录入场逻辑、复盘体会或下一笔准备用什么价格买卖多少股..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-slate-100 focus:outline-none focus:border-emerald-500"
            />

            {/* Quick Notes Memo Injection Buttons */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-[11px] text-slate-500">快捷预填计划:</span>
              <button
                type="button"
                onClick={() => {
                  const targetPrice = (numPrice * 0.99).toFixed(2);
                  handleAppendNotes(`【后续买入计划】拟在价格 ¥${targetPrice} 买入 ${numQty || 1000} 股`);
                }}
                className="px-2 py-0.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-lg text-[10px] font-mono transition-all"
              >
                + 准备下一笔买入计划
              </button>
              <button
                type="button"
                onClick={() => {
                  const targetPrice = (numPrice * 1.01).toFixed(2);
                  handleAppendNotes(`【后续卖出计划】拟在价格 ¥${targetPrice} 卖出 ${numQty || 1000} 股`);
                }}
                className="px-2 py-0.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-lg text-[10px] font-mono transition-all"
              >
                + 准备下一笔卖出计划
              </button>
            </div>
          </div>

          {/* Form Actions */}
          <div className="pt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-t border-slate-800">
            <span className="text-[11px] text-emerald-400 font-mono flex items-center gap-1">
              <Save className="w-3.5 h-3.5" />
              <span>提交后自动计算收益对账并同步写库</span>
            </span>
            <div className="flex items-center space-x-3 self-end sm:self-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 text-slate-300 hover:text-white rounded-xl font-medium text-xs sm:text-sm"
              >
                取消
              </button>
              <button
                type="submit"
                className="flex items-center space-x-1.5 px-5 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold rounded-xl shadow-lg hover:brightness-110 text-xs sm:text-sm transition-all active:scale-95"
              >
                <Save className="w-4 h-4 stroke-[2.5]" />
                <span>保存并同步至数据库</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
