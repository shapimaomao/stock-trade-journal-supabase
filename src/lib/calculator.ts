import { TradeRecord, PerformanceMetrics, PositionSummary, StrategyPerformance, ClosedPositionSummary } from '../types';

/**
 * Calculates derived metrics for a single trade record if missing or updating.
 */
export function computeTradeDerivedFields(
  trade: Partial<TradeRecord>,
  previousTradesForStock: TradeRecord[] = []
): Partial<TradeRecord> {
  const price = Number(trade.price) || 0;
  const quantity = Number(trade.quantity) || 0;
  const isBuy = trade.tradeAction === 'buy';
  const isDividend = trade.tradeAction === 'dividend';
  const fee = isDividend ? 0 : (Number(trade.fee) || 0);

  // 1. 发生金额: 买入和卖出的计算都是成交价格 × 成交数量，不计算手续费
  const amount = price * quantity;

  // Previous stock state
  const sortedPrev = [...previousTradesForStock].sort(
    (a, b) => new Date(a.tradeDate).getTime() - new Date(b.tradeDate).getTime()
  );

  let prevPos = 0;
  let prevCap = 0;
  let prevCost = 0;
  let prevAccPnL = 0;
  let prevPrice = 0;

  if (sortedPrev.length > 0) {
    const last = sortedPrev[sortedPrev.length - 1];
    prevPos = last.accumulatedPosition || 0;
    prevCap = last.accumulatedCapital || 0;
    prevCost = last.positionCost || 0;
    prevAccPnL = last.accumulatedPnL || 0;
    prevPrice = last.price || 0;
  }

  // 2. 累计持仓与累计投入本金
  let accumulatedPosition = prevPos;
  let accumulatedCapital = prevCap;

  if (isDividend) {
    // 分红不扣减投入本金，直接归入已实现收益 (保持上一笔累计投入本金不变)
    accumulatedPosition = prevPos;
    accumulatedCapital = prevCap;
  } else if (isBuy) {
    accumulatedPosition = prevPos + quantity;
    // 买入：上一笔累计投入本金 + 当前笔发生金额 + 手续费
    accumulatedCapital = prevCap + amount + fee;
  } else {
    // 卖出：上一笔累计投入本金 - 当前笔发生金额 + 手续费
    accumulatedPosition = Math.max(0, prevPos - quantity);
    accumulatedCapital = prevCap - amount + fee;
  }

  // 4. 持仓成本：累计投入本金 / 累计持仓
  let positionCost = 0;
  if (accumulatedPosition > 0) {
    positionCost = accumulatedCapital / accumulatedPosition;
  } else {
    positionCost = 0;
  }

  // 6. 持仓盈亏：(当前成交价 - 持仓成本价) × 当前持仓股数
  const positionPnL = (price - positionCost) * accumulatedPosition;

  // 5. 持仓盈亏%：(当前成交价 - 持仓成本价) ÷ 持仓成本价 × 100%
  const positionPnLPercent = positionCost > 0 ? ((price - positionCost) / positionCost) * 100 : 0;

  // 3. 涨跌比：（本次成交价格 - 上一笔成交价格）÷ 上一笔成交价格 × 100%；分红：不适用（显示 -）
  const gainLossRatio = (isDividend || prevPrice <= 0) ? 0 : ((price - prevPrice) / prevPrice) * 100;

  // 卖出已实现收益 & 累计盈亏
  let tradeRealizedPnL = 0;
  if (isDividend) {
    tradeRealizedPnL = amount;
  } else if (!isBuy) {
    tradeRealizedPnL = (price - prevCost) * quantity - fee;
  }

  const accumulatedPnL = prevAccPnL + (isBuy ? -fee : (isDividend ? amount : tradeRealizedPnL));

  return {
    ...trade,
    price,
    quantity,
    fee,
    amount: Math.round(amount * 1000) / 1000,
    accumulatedPosition,
    accumulatedCapital: Math.round(accumulatedCapital * 1000) / 1000,
    positionCost: Math.round(positionCost * 1000) / 1000,
    gainLossRatio: Math.round(gainLossRatio * 1000) / 1000,
    positionPnLPercent: Math.round(positionPnLPercent * 1000) / 1000,
    positionPnL: Math.round(positionPnL * 1000) / 1000,
    accumulatedPnL: Math.round(accumulatedPnL * 1000) / 1000
  };
}

/**
 * Recalculates all trades chronologically per stock/account.
 * Fills in missing cost basis, accumulated position, amounts, PnL %, position PnL, and total PnL.
 */
export function recalculateTradesChronologically(trades: TradeRecord[]): TradeRecord[] {
  // Smart Group by stockCode / stockName mapping
  const stockGroups: Record<string, TradeRecord[]> = {};
  const codeToKeyMap: Record<string, string> = {};
  const nameToKeyMap: Record<string, string> = {};

  trades.forEach(t => {
    const code = (t.stockCode || '').trim();
    const name = (t.stockName || '').trim();

    let key = '';
    if (code && codeToKeyMap[code]) {
      key = codeToKeyMap[code];
    } else if (name && nameToKeyMap[name]) {
      key = nameToKeyMap[name];
    } else {
      key = code || name || 'UNKNOWN';
    }

    if (code) codeToKeyMap[code] = key;
    if (name) nameToKeyMap[name] = key;

    if (!stockGroups[key]) stockGroups[key] = [];
    stockGroups[key].push(t);
  });

  const updatedAll: TradeRecord[] = [];

  Object.values(stockGroups).forEach(group => {
    // Sort ascending by date; on same date, BUYs and Dividends come before SELLs
    const sorted = [...group].sort((a, b) => {
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

    let currentPos = 0;
    let currentCostBasis = 0; // Total cost basis for remaining shares
    let prevAccPnL = 0;
    let prevPrice = 0;

    let cycleTotalBuyCost = 0; // Sum of (amount + fee) for all buys in active cycle
    let cycleTotalSellNet = 0; // Sum of (amount - fee) for all sells & (amount - fee) for dividends in active cycle
    let cycleMaxCapital = 0;

    sorted.forEach(t => {
      const price = Number(t.price) || 0;
      const quantity = Number(t.quantity) || 0;
      const fee = Number(t.fee) || 0;
      const amount = price * quantity;
      const isBuy = t.tradeAction === 'buy';
      const isDividend = t.tradeAction === 'dividend';

      // 涨跌比
      const gainLossRatio = (isDividend || prevPrice <= 0) ? 0 : ((price - prevPrice) / prevPrice) * 100;
      prevPrice = price;

      const prevPos = currentPos;

      if (isDividend) {
        // 分红不扣减持仓和成本基数，直接回收资金并计入收益
        const netDiv = amount - fee;
        cycleTotalSellNet += netDiv;
        const tradeRealizedPnL = netDiv;
        const newAccPnL = prevAccPnL + tradeRealizedPnL;
        prevAccPnL = newAccPnL;

        const positionCost = currentPos > 0 ? currentCostBasis / currentPos : 0;
        const accumulatedCapital = currentCostBasis;

        updatedAll.push({
          ...t,
          price,
          quantity,
          fee,
          amount: Math.round(amount * 1000) / 1000,
          accumulatedPosition: currentPos,
          accumulatedCapital: Math.round(accumulatedCapital * 1000) / 1000,
          positionCost: Math.round(positionCost * 1000) / 1000,
          gainLossRatio: Math.round(gainLossRatio * 1000) / 1000,
          positionPnLPercent: 0,
          positionPnL: 0,
          accumulatedPnL: Math.round(newAccPnL * 1000) / 1000,
        });

      } else if (isBuy) {
        const buyCost = amount + fee;
        currentPos += quantity;
        currentCostBasis += buyCost;
        cycleTotalBuyCost += buyCost;

        cycleMaxCapital = Math.max(cycleMaxCapital, currentCostBasis);

        const positionCost = currentPos > 0 ? currentCostBasis / currentPos : 0;
        const accumulatedCapital = currentCostBasis;

        const newAccPnL = prevAccPnL - fee;
        prevAccPnL = newAccPnL;

        const positionPnL = (price - positionCost) * currentPos;
        const positionPnLPercent = positionCost > 0 ? ((price - positionCost) / positionCost) * 100 : 0;

        updatedAll.push({
          ...t,
          price,
          quantity,
          fee,
          amount: Math.round(amount * 1000) / 1000,
          accumulatedPosition: currentPos,
          accumulatedCapital: Math.round(accumulatedCapital * 1000) / 1000,
          positionCost: Math.round(positionCost * 1000) / 1000,
          gainLossRatio: Math.round(gainLossRatio * 1000) / 1000,
          positionPnLPercent: Math.round(positionPnLPercent * 1000) / 1000,
          positionPnL: Math.round(positionPnL * 1000) / 1000,
          accumulatedPnL: Math.round(newAccPnL * 1000) / 1000,
        });

      } else {
        // Sell
        const netSell = amount - fee;
        cycleTotalSellNet += netSell;

        const prevUnitCost = prevPos > 0 ? currentCostBasis / prevPos : 0;
        const costOfSoldShares = prevUnitCost * quantity;
        const tradeRealizedPnL = netSell - costOfSoldShares;

        const newPos = Math.max(0, currentPos - quantity);
        currentPos = newPos;

        if (newPos > 0) {
          currentCostBasis -= costOfSoldShares;
        } else {
          currentCostBasis = 0;
        }

        const newAccPnL = prevAccPnL + tradeRealizedPnL;
        prevAccPnL = newAccPnL;

        const positionCost = newPos > 0 ? currentCostBasis / newPos : 0;
        const accumulatedCapital = currentCostBasis;

        const positionPnL = newPos > 0 ? (price - positionCost) * newPos : 0;
        const positionPnLPercent = (newPos > 0 && positionCost > 0) ? ((price - positionCost) / positionCost) * 100 : 0;

        let finalPnL: number | undefined;
        let finalReturnRate: number | undefined;
        let totalBuyCost: number | undefined;
        let totalSellNet: number | undefined;

        if (newPos === 0 && prevPos > 0) {
          // 清仓发生！
          finalPnL = Math.round((cycleTotalSellNet - cycleTotalBuyCost) * 100) / 100;
          finalReturnRate = cycleTotalBuyCost > 0 
            ? Math.round(((finalPnL / cycleTotalBuyCost) * 100) * 100) / 100 
            : 0;
          totalBuyCost = Math.round(cycleTotalBuyCost * 100) / 100;
          totalSellNet = Math.round(cycleTotalSellNet * 100) / 100;

          // 重置本持仓周期的统计量
          cycleTotalBuyCost = 0;
          cycleTotalSellNet = 0;
          cycleMaxCapital = 0;
        }

        updatedAll.push({
          ...t,
          price,
          quantity,
          fee,
          amount: Math.round(amount * 1000) / 1000,
          accumulatedPosition: newPos,
          accumulatedCapital: Math.round(accumulatedCapital * 1000) / 1000,
          positionCost: Math.round(positionCost * 1000) / 1000,
          gainLossRatio: Math.round(gainLossRatio * 1000) / 1000,
          positionPnLPercent: Math.round(positionPnLPercent * 1000) / 1000,
          positionPnL: Math.round(positionPnL * 1000) / 1000,
          accumulatedPnL: Math.round(newAccPnL * 1000) / 1000,
          finalPnL,
          finalReturnRate,
          totalBuyCost,
          totalSellNet,
        });
      }
    });
  });

  // Preserve ascending order (oldest first)
  return updatedAll.sort((a, b) => {
    const dateA = new Date(a.tradeDate).getTime();
    const dateB = new Date(b.tradeDate).getTime();
    if (dateA !== dateB) return dateA - dateB;
    return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
  });
}

/**
  * Calculates summary for all completed / closed position cycles.
  */
export function calculateClosedPositions(trades: TradeRecord[]): ClosedPositionSummary[] {
  if (trades.length === 0) return [];

  const recalculated = recalculateTradesChronologically(trades);
  const stockGroups: Record<string, TradeRecord[]> = {};

  recalculated.forEach(t => {
    const key = t.stockCode || 'UNKNOWN';
    if (!stockGroups[key]) stockGroups[key] = [];
    stockGroups[key].push(t);
  });

  const closedSummaries: ClosedPositionSummary[] = [];

  Object.values(stockGroups).forEach(group => {
    let currentCycleTrades: TradeRecord[] = [];
    let cycleStartPnL = 0;
    let cycleMaxCapital = 0;

    group.forEach(t => {
      const prevPos = currentCycleTrades.length > 0 
        ? currentCycleTrades[currentCycleTrades.length - 1].accumulatedPosition 
        : 0;

      if (prevPos === 0 && t.accumulatedPosition > 0) {
        // 第一笔建仓，记录开仓起点 PnL
        const prevAccPnL = t.accumulatedPnL - (t.tradeAction === 'buy' ? -t.fee : t.amount);
        cycleStartPnL = prevAccPnL;
        cycleMaxCapital = t.accumulatedCapital;
        currentCycleTrades = [];
      }

      currentCycleTrades.push(t);
      if (t.accumulatedCapital > 0) {
        cycleMaxCapital = Math.max(cycleMaxCapital, t.accumulatedCapital);
      }

      // 发生清仓
      if (t.accumulatedPosition === 0 && prevPos > 0 && currentCycleTrades.length > 0) {
        const openDate = currentCycleTrades[0].tradeDate;
        const closeDate = t.tradeDate;
        const openTime = new Date(openDate).getTime();
        const closeTime = new Date(closeDate).getTime();
        const holdingDays = Math.max(1, Math.round((closeTime - openTime) / (1000 * 3600 * 24)));

        let cycleBuyCost = t.totalBuyCost ?? 0;
        let cycleSellNet = t.totalSellNet ?? 0;

        if (!cycleBuyCost || !cycleSellNet) {
          currentCycleTrades.forEach(ct => {
            if (ct.tradeAction === 'buy') {
              cycleBuyCost += (Number(ct.price) * Number(ct.quantity)) + (Number(ct.fee) || 0);
            } else if (ct.tradeAction === 'sell') {
              cycleSellNet += (Number(ct.price) * Number(ct.quantity)) - (Number(ct.fee) || 0);
            } else if (ct.tradeAction === 'dividend') {
              cycleSellNet += (Number(ct.price) * Number(ct.quantity)) - (Number(ct.fee) || 0);
            }
          });
        }

        const finalPnL = t.finalPnL !== undefined 
          ? t.finalPnL 
          : Math.round((cycleSellNet - cycleBuyCost) * 100) / 100;
        
        const finalReturnRate = t.finalReturnRate !== undefined 
          ? t.finalReturnRate 
          : (cycleBuyCost > 0 ? Math.round(((finalPnL / cycleBuyCost) * 100) * 100) / 100 : 0);

        let totalFees = 0;
        currentCycleTrades.forEach(ct => {
          totalFees += Number(ct.fee) || 0;
        });

        closedSummaries.push({
          stockCode: t.stockCode,
          stockName: t.stockName,
          account: t.account,
          openDate,
          closeDate,
          holdingDays,
          maxCapital: Math.round(cycleMaxCapital * 1000) / 1000,
          totalBuyCost: Math.round(cycleBuyCost * 100) / 100,
          totalSellNet: Math.round(cycleSellNet * 100) / 100,
          finalPnL,
          finalReturnRate,
          totalFees: Math.round(totalFees * 1000) / 1000,
          tradeCount: currentCycleTrades.length
        });

        currentCycleTrades = [];
        cycleMaxCapital = 0;
      }
    });
  });

  return closedSummaries.sort((a, b) => new Date(b.closeDate).getTime() - new Date(a.closeDate).getTime());
}

/**
 * Calculates overall portfolio performance metrics based on all trade history.
 */
export function calculatePerformanceMetrics(trades: TradeRecord[]): PerformanceMetrics {
  if (trades.length === 0) {
    return {
      totalPnL: 0,
      totalReturnRate: 0,
      realizedPnL: 0,
      unrealizedPnL: 0,
      winRate: 0,
      totalTradesCount: 0,
      winningTradesCount: 0,
      losingTradesCount: 0,
      avgWinAmount: 0,
      avgLossAmount: 0,
      riskRewardRatio: 0,
      winDays: 0,
      lossDays: 0,
      winLossDaysRatio: 0,
      maxDrawdownAmount: 0,
      maxDrawdownPercent: 0,
      maxSingleLoss: 0,
      avgHoldingDaysWin: 0,
      avgHoldingDaysLoss: 0,
      avgHoldingDaysAll: 0,
      totalFeesPaid: 0,
      feeImpactRate: 0,
      totalInvestedCapital: 0,
    };
  }

  // Sort trades chronologically
  const sorted = [...trades].sort(
    (a, b) => new Date(a.tradeDate).getTime() - new Date(b.tradeDate).getTime()
  );

  let totalFeesPaid = 0;
  let maxInvestedCapital = 0;
  
  // Track closed sell trades for Win Rate, Profit Factor, Max Single Loss, Holding Days
  const closedSellTradesPnL: {
    pnl: number;
    fee: number;
    holdingDays: number;
    tradeDate: string;
    stockCode: string;
  }[] = [];

  // Group trades by stock to compute cost basis and sell round-trips
  const stockMap: Record<string, { buyQueue: { price: number; qty: number; date: Date }[]; totalFees: number }> = {};

  // Daily PnL tracking for Win/Loss Days and Max Drawdown curve
  const dailyPnLMap: Record<string, number> = {};

  sorted.forEach(t => {
    totalFeesPaid += Number(t.fee) || 0;
    maxInvestedCapital = Math.max(maxInvestedCapital, Number(t.accumulatedCapital) || 0);

    const dateStr = t.tradeDate.split('T')[0].split(' ')[0];
    if (!dailyPnLMap[dateStr]) dailyPnLMap[dateStr] = 0;

    if (!stockMap[t.stockCode]) {
      stockMap[t.stockCode] = { buyQueue: [], totalFees: 0 };
    }
    const stockInfo = stockMap[t.stockCode];
    stockInfo.totalFees += Number(t.fee) || 0;

    const tDate = new Date(t.tradeDate);

    if (t.tradeAction === 'dividend') {
      const dividendCash = Number(t.price) * Number(t.quantity);
      dailyPnLMap[dateStr] += dividendCash;
    } else if (t.tradeAction === 'buy') {
      stockInfo.buyQueue.push({
        price: Number(t.price),
        qty: Number(t.quantity),
        date: tDate,
      });
      // Fee counts as negative daily PnL
      dailyPnLMap[dateStr] -= Number(t.fee) || 0;
    } else {
      // Sell
      let remainingSellQty = Number(t.quantity);
      const sellPrice = Number(t.price);
      const fee = Number(t.fee) || 0;
      let totalCostOfSoldShares = 0;
      let weightedHoldingDays = 0;
      let totalQtySoldThisTrade = 0;

      while (remainingSellQty > 0 && stockInfo.buyQueue.length > 0) {
        const oldestBuy = stockInfo.buyQueue[0];
        const matchQty = Math.min(remainingSellQty, oldestBuy.qty);
        
        totalCostOfSoldShares += oldestBuy.price * matchQty;
        const daysDiff = Math.max(1, Math.round((tDate.getTime() - oldestBuy.date.getTime()) / (1000 * 3600 * 24)));
        weightedHoldingDays += daysDiff * matchQty;
        totalQtySoldThisTrade += matchQty;

        oldestBuy.qty -= matchQty;
        remainingSellQty -= matchQty;

        if (oldestBuy.qty <= 0) {
          stockInfo.buyQueue.shift();
        }
      }

      const sellProceeds = sellPrice * Number(t.quantity);
      const netSellPnL = sellProceeds - totalCostOfSoldShares - fee;
      const avgHoldingDays = totalQtySoldThisTrade > 0 ? weightedHoldingDays / totalQtySoldThisTrade : 1;

      closedSellTradesPnL.push({
        pnl: netSellPnL,
        fee,
        holdingDays: Math.round(avgHoldingDays * 10) / 10,
        tradeDate: t.tradeDate,
        stockCode: t.stockCode,
      });

      dailyPnLMap[dateStr] += netSellPnL;
    }
  });

  // Calculate Win/Loss Trades
  const winningTrades = closedSellTradesPnL.filter(x => x.pnl > 0);
  const losingTrades = closedSellTradesPnL.filter(x => x.pnl < 0);
  
  const totalTradesCount = closedSellTradesPnL.length;
  const winningTradesCount = winningTrades.length;
  const losingTradesCount = losingTrades.length;
  const winRate = totalTradesCount > 0 ? (winningTradesCount / totalTradesCount) * 100 : 0;

  const totalWinAmount = winningTrades.reduce((sum, x) => sum + x.pnl, 0);
  const totalLossAmount = Math.abs(losingTrades.reduce((sum, x) => sum + x.pnl, 0));

  const avgWinAmount = winningTradesCount > 0 ? totalWinAmount / winningTradesCount : 0;
  const avgLossAmount = losingTradesCount > 0 ? totalLossAmount / losingTradesCount : 0;
  const riskRewardRatio = avgLossAmount > 0 ? avgWinAmount / avgLossAmount : avgWinAmount > 0 ? 99 : 0;

  // Single Max Loss
  const maxSingleLoss = losingTrades.length > 0
    ? Math.abs(Math.min(...losingTrades.map(x => x.pnl)))
    : 0;

  // Holding Days
  const totalWinHoldDays = winningTrades.reduce((sum, x) => sum + x.holdingDays, 0);
  const totalLossHoldDays = losingTrades.reduce((sum, x) => sum + x.holdingDays, 0);
  const totalAllHoldDays = closedSellTradesPnL.reduce((sum, x) => sum + x.holdingDays, 0);

  const avgHoldingDaysWin = winningTradesCount > 0 ? totalWinHoldDays / winningTradesCount : 0;
  const avgHoldingDaysLoss = losingTradesCount > 0 ? totalLossHoldDays / losingTradesCount : 0;
  const avgHoldingDaysAll = totalTradesCount > 0 ? totalAllHoldDays / totalTradesCount : 0;

  // Win/Loss Days Ratio
  let winDays = 0;
  let lossDays = 0;
  Object.values(dailyPnLMap).forEach(dayPnL => {
    if (dayPnL > 0.01) winDays++;
    else if (dayPnL < -0.01) lossDays++;
  });
  const winLossDaysRatio = lossDays > 0 ? winDays / lossDays : winDays > 0 ? winDays : 0;

  // Cumulative PnL and Max Drawdown Curve
  let peakPnL = 0;
  let currentAccumulated = 0;
  let maxDrawdownAmount = 0;
  let maxDrawdownPercent = 0;

  const sortedDates = Object.keys(dailyPnLMap).sort();
  sortedDates.forEach(d => {
    currentAccumulated += dailyPnLMap[d];
    if (currentAccumulated > peakPnL) {
      peakPnL = currentAccumulated;
    }
    const drawdown = peakPnL - currentAccumulated;
    if (drawdown > maxDrawdownAmount) {
      maxDrawdownAmount = drawdown;
      if (peakPnL > 0) {
        maxDrawdownPercent = (drawdown / peakPnL) * 100;
      } else if (maxInvestedCapital > 0) {
        maxDrawdownPercent = (drawdown / maxInvestedCapital) * 100;
      }
    }
  });

  const realizedPnL = closedSellTradesPnL.reduce((sum, x) => sum + x.pnl, 0);

  // Compute Unrealized PnL for active remaining positions
  let unrealizedPnL = 0;
  Object.keys(stockMap).forEach(code => {
    const queue = stockMap[code].buyQueue;
    if (queue.length > 0) {
      // Find latest price for this stock in trades
      const stockTrades = sorted.filter(x => x.stockCode === code);
      const latestTrade = stockTrades[stockTrades.length - 1];
      const latestPrice = latestTrade ? Number(latestTrade.price) : 0;

      queue.forEach(item => {
        unrealizedPnL += (latestPrice - item.price) * item.qty;
      });
    }
  });

  const totalPnL = realizedPnL + unrealizedPnL;
  const totalReturnRate = maxInvestedCapital > 0 ? (totalPnL / maxInvestedCapital) * 100 : 0;

  // Fee Impact Rate: Fee / Gross Profit before fee
  const grossProfit = totalWinAmount;
  const feeImpactRate = grossProfit > 0 ? (totalFeesPaid / grossProfit) * 100 : 0;

  return {
    totalPnL: Math.round(totalPnL * 1000) / 1000,
    totalReturnRate: Math.round(totalReturnRate * 1000) / 1000,
    realizedPnL: Math.round(realizedPnL * 1000) / 1000,
    unrealizedPnL: Math.round(unrealizedPnL * 1000) / 1000,
    winRate: Math.round(winRate * 10) / 10,
    totalTradesCount,
    winningTradesCount,
    losingTradesCount,
    avgWinAmount: Math.round(avgWinAmount * 1000) / 1000,
    avgLossAmount: Math.round(avgLossAmount * 1000) / 1000,
    riskRewardRatio: Math.round(riskRewardRatio * 1000) / 1000,
    winDays,
    lossDays,
    winLossDaysRatio: Math.round(winLossDaysRatio * 100) / 100,
    maxDrawdownAmount: Math.round(maxDrawdownAmount * 1000) / 1000,
    maxDrawdownPercent: Math.round(maxDrawdownPercent * 100) / 100,
    maxSingleLoss: Math.round(maxSingleLoss * 1000) / 1000,
    avgHoldingDaysWin: Math.round(avgHoldingDaysWin * 10) / 10,
    avgHoldingDaysLoss: Math.round(avgHoldingDaysLoss * 10) / 10,
    avgHoldingDaysAll: Math.round(avgHoldingDaysAll * 10) / 10,
    totalFeesPaid: Math.round(totalFeesPaid * 1000) / 1000,
    feeImpactRate: Math.round(feeImpactRate * 10) / 10,
    totalInvestedCapital: Math.round(maxInvestedCapital * 1000) / 1000,
  };
}

/**
 * Summarizes current open holdings.
 */
export function calculateCurrentPositions(trades: TradeRecord[]): PositionSummary[] {
  if (trades.length === 0) return [];

  const recalculated = recalculateTradesChronologically(trades);
  const stockGroups: Record<string, TradeRecord[]> = {};

  recalculated.forEach(t => {
    const key = t.stockCode || 'UNKNOWN';
    if (!stockGroups[key]) stockGroups[key] = [];
    stockGroups[key].push(t);
  });

  const now = new Date();
  const result: PositionSummary[] = [];

  Object.values(stockGroups).forEach(group => {
    if (group.length === 0) return;

    // The last trade record gives the current accumulated position and capital
    const last = group[group.length - 1];
    if (last.accumulatedPosition > 0) {
      const currentQuantity = last.accumulatedPosition;
      const totalCostAmount = last.accumulatedCapital;
      const avgCostPrice = last.positionCost;
      const currentPrice = last.price;
      const unrealizedPnL = last.positionPnL;
      const unrealizedPnLPercent = last.positionPnLPercent;

      const firstBuy = group.find(t => t.tradeAction === 'buy');
      const firstBuyDate = firstBuy ? firstBuy.tradeDate : last.tradeDate;
      const holdingDays = Math.max(1, Math.round((now.getTime() - new Date(firstBuyDate).getTime()) / (1000 * 3600 * 24)));

      let realizedPnL = 0;
      let totalFees = 0;

      group.forEach(t => {
        totalFees += Number(t.fee) || 0;
        if (t.tradeAction === 'dividend') {
          realizedPnL += t.amount;
        } else if (t.tradeAction === 'sell') {
          realizedPnL += (t.price - t.positionCost) * t.quantity - t.fee;
        }
      });

      result.push({
        stockCode: last.stockCode,
        stockName: last.stockName,
        account: last.account,
        currentQuantity,
        avgCostPrice: Math.round(avgCostPrice * 1000) / 1000,
        totalCostAmount: Math.round(totalCostAmount * 1000) / 1000,
        currentPrice,
        unrealizedPnL: Math.round(unrealizedPnL * 1000) / 1000,
        unrealizedPnLPercent: Math.round(unrealizedPnLPercent * 1000) / 1000,
        realizedPnL: Math.round(realizedPnL * 1000) / 1000,
        firstBuyDate,
        holdingDays,
        totalFees: Math.round(totalFees * 1000) / 1000,
        tradeCount: group.length,
      });
    }
  });

  return result;
}

/**
 * Calculates strategy performance breakdown.
 */
export function calculateStrategyPerformance(trades: TradeRecord[]): StrategyPerformance[] {
  const map: Record<string, TradeRecord[]> = {};

  trades.forEach(t => {
    const key = t.strategyName || '默认策略';
    if (!map[key]) map[key] = [];
    map[key].push(t);
  });

  return Object.entries(map).map(([strategyName, stratTrades]) => {
    const stratMetrics = calculatePerformanceMetrics(stratTrades);
    const strategyType = stratTrades[0]?.strategyType || 'self';

    return {
      strategyName,
      strategyType,
      totalTrades: stratMetrics.totalTradesCount,
      winningTrades: stratMetrics.winningTradesCount,
      losingTrades: stratMetrics.losingTradesCount,
      winRate: stratMetrics.winRate,
      avgWinAmount: stratMetrics.avgWinAmount,
      avgLossAmount: stratMetrics.avgLossAmount,
      riskRewardRatio: stratMetrics.riskRewardRatio,
      totalRealizedPnL: stratMetrics.realizedPnL,
      totalFees: stratMetrics.totalFeesPaid,
      maxLossSingle: stratMetrics.maxSingleLoss,
      avgHoldingDays: stratMetrics.avgHoldingDaysAll,
    };
  });
}
