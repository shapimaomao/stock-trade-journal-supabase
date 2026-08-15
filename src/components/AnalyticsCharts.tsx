import React, { useMemo } from 'react';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  Legend 
} from 'recharts';
import { TradeRecord, PerformanceMetrics } from '../types';
import { TrendingUp, BarChart2, PieChart as PieChartIcon, Clock, Receipt } from 'lucide-react';

interface AnalyticsChartsProps {
  trades: TradeRecord[];
  metrics: PerformanceMetrics;
}

export const AnalyticsCharts: React.FC<AnalyticsChartsProps> = ({ trades, metrics }) => {
  // Cumulative PnL over time
  const cumulativeData = useMemo(() => {
    const sorted = [...trades].sort(
      (a, b) => new Date(a.tradeDate).getTime() - new Date(b.tradeDate).getTime()
    );

    let accum = 0;
    return sorted.map(t => {
      accum = t.accumulatedPnL;
      return {
        date: t.tradeDate,
        pnl: Math.round(accum),
        stock: t.stockName,
      };
    });
  }, [trades]);

  // Strategy PnL Breakdown
  const strategyData = useMemo(() => {
    const map: Record<string, number> = {};
    trades.forEach(t => {
      const name = t.strategyName || '默认策略';
      if (!map[name]) map[name] = 0;
      if (t.tradeAction === 'sell') {
        map[name] += Number(t.accumulatedPnL) || 0;
      }
    });

    return Object.entries(map).map(([name, pnl]) => ({
      name,
      pnl: Math.round(pnl),
    }));
  }, [trades]);

  // Account Allocation
  const accountData = useMemo(() => {
    const map: Record<string, number> = {};
    trades.forEach(t => {
      const acc = t.account || '默认账户';
      if (!map[acc]) map[acc] = 0;
      map[acc] += Number(t.amount) || 0;
    });

    const COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899'];
    return Object.entries(map).map(([name, value], idx) => ({
      name,
      value: Math.round(value),
      color: COLORS[idx % COLORS.length],
    }));
  }, [trades]);

  if (trades.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-500 my-4">
        暂无足够的交易数据生成图表。请先录入或导入交易账单。
      </div>
    );
  }

  return (
    <div className="space-y-4 my-4">
      {/* Chart 1: Cumulative PnL Timeline */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">累计资金收益曲线 (Cumulative PnL Trend)</h3>
              <p className="text-[11px] text-slate-400">资金随时间变化的绝对盈亏走势</p>
            </div>
          </div>
          <div className="text-right font-mono">
            <span className="text-xs text-slate-400">目前总收益: </span>
            <span className={`text-sm font-bold ${metrics.totalPnL >= 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
              ¥{metrics.totalPnL.toLocaleString()}
            </span>
          </div>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={cumulativeData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
              <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} tickLine={false} />
              <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} tickFormatter={v => `¥${v}`} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }}
                formatter={(val: any) => [`¥${Number(val).toLocaleString()}`, '累计盈亏']}
              />
              <Line 
                type="monotone" 
                dataKey="pnl" 
                stroke="#10b981" 
                strokeWidth={3} 
                dot={{ r: 3, fill: '#10b981' }} 
                activeDot={{ r: 6 }} 
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Grid Row: Strategy Comparison & Account Allocation */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Strategy PnL Bar */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center space-x-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold">
              <BarChart2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">各类策略盈亏贡献比较</h3>
              <p className="text-[11px] text-slate-400">波段、网格、短线等不同策略的效果对比</p>
            </div>
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={strategyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} tickFormatter={v => `¥${v}`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }}
                  formatter={(val: any) => [`¥${Number(val).toLocaleString()}`, '策略盈亏']}
                />
                <Bar dataKey="pnl" fill="#3b82f6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Account Capital Pie */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center space-x-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold">
              <PieChartIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">券商账户交易分布 (Broker Allocation)</h3>
              <p className="text-[11px] text-slate-400">华泰、招商、富途等券商账户的交易占比</p>
            </div>
          </div>

          <div className="h-56 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={accountData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {accountData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }}
                  formatter={(val: any) => [`¥${Number(val).toLocaleString()}`, '交易额']}
                />
                <Legend formatter={(val) => <span className="text-xs text-slate-300">{val}</span>} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
