/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { supabase, mapTradeRow, mapTradeToRow, mapGridRow, mapGridToRow } from './lib/supabase';

import { TradeRecord, UserProfile, PerformanceMetrics, StrategyType, GridStrategyConfig } from './types';
import { INITIAL_DEMO_TRADES } from './data/demoData';
import { calculatePerformanceMetrics, recalculateTradesChronologically } from './lib/calculator';
import { exportTradesToExcel } from './lib/excel';

import { Navbar } from './components/Navbar';
import { DashboardStats } from './components/DashboardStats';
import { TradeTable } from './components/TradeTable';
import { TradeCardList } from './components/TradeCardList';
import { TradeFormModal } from './components/TradeFormModal';
import { ExcelImportModal } from './components/ExcelImportModal';
import { AnalyticsCharts } from './components/AnalyticsCharts';
import { StrategyManager } from './components/StrategyManager';
import { PositionsSummary } from './components/PositionsSummary';
import { AuthModal } from './components/AuthModal';
import { StockQuickSelector } from './components/StockQuickSelector';
import { PendingFundTradesBanner } from './components/PendingFundTradesBanner';
import { NotesTaskBoard } from './components/NotesTaskBoard';
import { PasscodeGate } from './components/PasscodeGate';

import { Cloud, FileSpreadsheet, PlusCircle, RefreshCw, Layers, Download, Bell, X } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);

  // Initialize trades from local storage if available so data is preserved across builds
  const [trades, setTrades] = useState<TradeRecord[]>(() => {
    const hasCleared = localStorage.getItem('user_has_cleared_trades') === 'true';
    const saved = localStorage.getItem('local_stock_trades');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return recalculateTradesChronologically(parsed);
        }
      } catch (e) {}
    }
    return hasCleared ? [] : recalculateTradesChronologically(INITIAL_DEMO_TRADES);
  });

  // History Stack State for Undo (撤销) & Redo (重做)
  const [historyStack, setHistoryStack] = useState<TradeRecord[][]>(() => [trades]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < historyStack.length - 1;

  // Helper to apply trades update with chronological recalculation and history push
  const updateTradesWithHistory = (newTradesRaw: TradeRecord[]) => {
    const recalculated = recalculateTradesChronologically(newTradesRaw);
    setTrades(recalculated);
    setHistoryStack(prev => {
      const activeSlice = historyIndex >= 0 ? prev.slice(0, historyIndex + 1) : [];
      return [...activeSlice, recalculated];
    });
    setHistoryIndex(prev => prev + 1);
    localStorage.setItem('local_stock_trades', JSON.stringify(recalculated));
  };

  // Undo Handler
  const handleUndo = () => {
    if (historyIndex <= 0) return;
    const prevIndex = historyIndex - 1;
    const prevTrades = historyStack[prevIndex];
    const recalculated = recalculateTradesChronologically(prevTrades);
    setTrades(recalculated);
    setHistoryIndex(prevIndex);
    localStorage.setItem('local_stock_trades', JSON.stringify(recalculated));
    showToast('↩️ 已成功撤销上一步操作！');
  };

  // Redo Handler
  const handleRedo = () => {
    if (historyIndex >= historyStack.length - 1) return;
    const nextIndex = historyIndex + 1;
    const nextTrades = historyStack[nextIndex];
    const recalculated = recalculateTradesChronologically(nextTrades);
    setTrades(recalculated);
    setHistoryIndex(nextIndex);
    localStorage.setItem('local_stock_trades', JSON.stringify(recalculated));
    showToast('↪️ 已成功重做操作！');
  };

  // Global Keyboard Shortcuts for Undo (Ctrl+Z) & Redo (Ctrl+Y / Cmd+Shift+Z)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (
        activeEl && 
        (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || (activeEl as HTMLElement).isContentEditable)
      ) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (canUndo) handleUndo();
      } else if (
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z')
      ) {
        e.preventDefault();
        if (canRedo) handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canUndo, canRedo, historyIndex, historyStack]);

  // Grid Strategy Configs State with Persistence
  const [gridConfigs, setGridConfigs] = useState<GridStrategyConfig[]>(() => {
    const saved = localStorage.getItem('local_grid_configs');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return [];
  });

  const [activeTab, setActiveTab] = useState<'ledger' | 'tasks' | 'analytics' | 'positions' | 'strategies' | 'import'>('ledger');
  
  // Stock Quick Filter State
  const [selectedStockCode, setSelectedStockCode] = useState<string | null>(null);
  const [quickStockInfo, setQuickStockInfo] = useState<{
    stockCode: string;
    stockName: string;
    account: string;
    strategyName: string;
    strategyType: StrategyType;
  } | null>(null);

  // Modals state
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isTradeFormOpen, setIsTradeFormOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [editingTrade, setEditingTrade] = useState<TradeRecord | null>(null);

  const [isCloudSynced, setIsCloudSynced] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isCloudReady, setIsCloudReady] = useState(false);

  // 上次点击"保存数据"的北京时间 (localStorage 持久化, 版本更新后依旧保留)
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(() => {
    return localStorage.getItem('last_save_sync_at');
  });

  const formatBeijingTime = (ms: number) => {
    const bj = new Date(ms + 8 * 3600 * 1000);
    return bj.toISOString().replace('T', ' ').slice(0, 19);
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // ------------------------------------------------------------
  // Supabase Auth 状态监听
  // ------------------------------------------------------------
  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getSession().then(({ data }) => {
      const sessionUser = data.session?.user;
      if (sessionUser) {
        setUser({
          uid: sessionUser.id,
          email: sessionUser.email,
          displayName: sessionUser.email?.split('@')[0] || '专属账户',
          isAnonymous: false,
        });
        setIsCloudSynced(true);
      } else {
        setUser(null);
        setIsCloudSynced(false);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const sessionUser = session?.user;
      if (sessionUser) {
        setUser({
          uid: sessionUser.id,
          email: sessionUser.email,
          displayName: sessionUser.email?.split('@')[0] || '专属账户',
          isAnonymous: false,
        });
        setIsCloudSynced(true);
      } else {
        setUser(null);
        setIsCloudSynced(false);
        // 登出时清空内存中的敏感数据
        setTrades([]);
        setGridConfigs([]);
        localStorage.removeItem('local_stock_trades');
        localStorage.removeItem('local_grid_configs');
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  // 是否有可用云会话
  useEffect(() => {
    if (supabase && user) {
      supabase.auth.getUser().then(({ data }) => {
        setIsCloudReady(Boolean(data.user));
      });
    } else {
      setIsCloudReady(false);
    }
  }, [user]);

  // ------------------------------------------------------------
  // 登录后全量拉取云端数据
  // ------------------------------------------------------------
  useEffect(() => {
    if (!supabase || !user) return;
    let active = true;

    const loadCloudData = async () => {
      try {
        const [tradesRes, gridsRes] = await Promise.all([
          supabase.from('trades').select('*').order('trade_date', { ascending: false }),
          supabase.from('grid_configs').select('*'),
        ]);

        if (!active) return;

        if (tradesRes.error) {
          console.warn('拉取交易数据失败:', tradesRes.error.message);
        } else if (tradesRes.data && tradesRes.data.length > 0) {
          const mapped = tradesRes.data.map((r) => mapTradeRow(r, user.uid));
          setTrades(recalculateTradesChronologically(mapped));
          localStorage.setItem('local_stock_trades', JSON.stringify(mapped));
        } else if (localStorage.getItem('user_has_cleared_trades') === 'true') {
          setTrades([]);
        } else {
          // 云端为空: 自动把本地数据上传, 防止丢失
          const saved = localStorage.getItem('local_stock_trades');
          if (saved) {
            try {
              const localTrades: TradeRecord[] = JSON.parse(saved);
              if (localTrades.length > 0) {
                const rows = localTrades.map(mapTradeToRow);
                const { error } = await supabase.from('trades').upsert(rows);
                if (!error && active) {
                  showToast('☁️ 本地数据已自动上传至云端');
                }
              }
            } catch (e) {}
          }
        }

        if (gridsRes.error) {
          console.warn('拉取网格策略失败:', gridsRes.error.message);
        } else if (gridsRes.data && gridsRes.data.length > 0) {
          const mapped = gridsRes.data.map(mapGridRow);
          setGridConfigs(mapped);
          localStorage.setItem('local_grid_configs', JSON.stringify(mapped));
        } else {
          const savedGrids = localStorage.getItem('local_grid_configs');
          if (savedGrids) {
            try {
              const localGrids: GridStrategyConfig[] = JSON.parse(savedGrids);
              if (localGrids.length > 0) {
                const rows = localGrids.map((g) => ({ ...mapGridToRow(g), id: g.id || g.stockCode }));
                const { error } = await supabase.from('grid_configs').upsert(rows);
                if (!error && active) {
                  showToast('☁️ 本地网格策略已自动上传至云端');
                }
              }
            } catch (e) {}
          }
        }
      } catch (e) {
        console.warn('云端数据加载异常:', e);
      }
    };

    loadCloudData();
    return () => { active = false; };
  }, [user]);

  // ------------------------------------------------------------
  // Realtime 订阅: 其他设备(手机/电脑)的变更实时同步
  // ------------------------------------------------------------
  const localMutationRef = useRef<number>(0);

  useEffect(() => {
    if (!supabase || !user) return;

    const channel = supabase
      .channel('realtime-data')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'trades' },
        (payload: any) => {
          if (payload.eventType === 'DELETE') {
            const removedId = payload.old?.id;
            if (removedId) {
              setTrades(prev => prev.filter(t => t.id !== removedId));
            }
          } else {
            const row = payload.new as Record<string, any>;
            if (!row || !row.id) return;
            const incoming = mapTradeRow(row, user.uid);
            const incomingTime = row.updated_at ? new Date(row.updated_at).getTime() : Date.now();
            // 忽略本地自己写入的回声 (updated_at 相同)
            if (Date.now() - localMutationRef.current < 1500 && incomingTime <= localMutationRef.current) {
              return;
            }
            setTrades(prev => {
              const exists = prev.some(t => t.id === incoming.id);
              return exists ? prev.map(t => t.id === incoming.id ? { ...t, ...incoming } : t) : [incoming, ...prev];
            });
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'grid_configs' },
        (payload: any) => {
          if (payload.eventType === 'DELETE') {
            const removedId = payload.old?.id;
            if (removedId) {
              setGridConfigs(prev => prev.filter(c => c.id !== removedId && c.stockCode !== removedId));
            }
          } else {
            const row = payload.new as Record<string, any>;
            if (!row || !row.id) return;
            const incoming = mapGridRow(row);
            setGridConfigs(prev => {
              const exists = prev.some(c => c.id === incoming.id);
              return exists ? prev.map(c => c.id === incoming.id ? { ...c, ...incoming } : c) : [...prev, incoming];
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Persist trades locally as fallback
  useEffect(() => {
    localStorage.setItem('local_stock_trades', JSON.stringify(trades));
  }, [trades]);

  // Persist gridConfigs locally
  useEffect(() => {
    localStorage.setItem('local_grid_configs', JSON.stringify(gridConfigs));
  }, [gridConfigs]);

  // 标记本地修改时间 (用于抑制 realtime 回声)
  const markLocalMutation = () => {
    localMutationRef.current = Date.now();
  };

  // ------------------------------------------------------------
  // 云端写入辅助函数
  // ------------------------------------------------------------
  const pushTradesToCloud = useCallback(async (list: TradeRecord[]) => {
    if (!supabase || !user) return { ok: false };
    markLocalMutation();
    const rows = list.map(mapTradeToRow);
    const { error } = await supabase.from('trades').upsert(rows);
    if (error) {
      console.warn('云端同步交易失败:', error.message);
      return { ok: false, error };
    }
    return { ok: true };
  }, [user]);

  const deleteTradesFromCloud = useCallback(async (ids: string[]) => {
    if (!supabase || !user) return { ok: false };
    markLocalMutation();
    const nonDemo = ids.filter(id => !id.startsWith('demo_'));
    if (nonDemo.length === 0) return { ok: true };
    const { error } = await supabase.from('trades').delete().in('id', nonDemo);
    if (error) {
      console.warn('云端删除交易失败:', error.message);
      return { ok: false, error };
    }
    return { ok: true };
  }, [user]);

  // Save / Delete Grid Config Handlers
  const handleSaveGridConfig = async (config: GridStrategyConfig) => {
    const cloudConfig = { ...config, id: config.id || config.stockCode };
    setGridConfigs(prev => {
      const exists = prev.some(c => (c.id || c.stockCode) === (cloudConfig.id || cloudConfig.stockCode));
      if (exists) {
        return prev.map(c => (c.id || c.stockCode) === (cloudConfig.id || cloudConfig.stockCode) ? cloudConfig : c);
      } else {
        return [...prev, cloudConfig];
      }
    });

    if (supabase && user) {
      markLocalMutation();
      const row = mapGridToRow(cloudConfig);
      const { error } = await supabase.from('grid_configs').upsert(row, { onConflict: 'id' });
      if (error) console.error('保存网格策略到 Supabase 错误:', error.message);
    }
    showToast(`💾 已成功保存 ${config.stockName} 的定制网格策略与规划图！`);
  };

  const handleDeleteGridConfig = async (stockCode: string) => {
    setGridConfigs(prev => prev.filter(c => c.stockCode !== stockCode));
    if (supabase && user) {
      markLocalMutation();
      const target = gridConfigs.find(c => c.stockCode === stockCode);
      const { error } = await supabase.from('grid_configs').delete().eq('id', target?.id || stockCode);
      if (error) console.error('删除网格策略从 Supabase 错误:', error.message);
    }
    showToast('已删除对应网格策略配置');
  };

  // Real-time Overall Performance Metrics
  const metrics: PerformanceMetrics = useMemo(() => {
    return calculatePerformanceMetrics(trades);
  }, [trades]);

  // Filtered trades by selected stock
  const displayTrades = useMemo(() => {
    if (!selectedStockCode) return trades;
    return trades.filter(t => t.stockCode === selectedStockCode || t.stockName === selectedStockCode);
  }, [trades, selectedStockCode]);

  // Explicit Save & Sync All Trades to Database Handler
  const handleSaveAndSyncToDb = async () => {
    localStorage.setItem('local_stock_trades', JSON.stringify(trades));
    const result = await pushTradesToCloud(trades);
    // 记录本次保存的北京时间并持久化
    const nowStr = formatBeijingTime(Date.now());
    localStorage.setItem('last_save_sync_at', nowStr);
    setLastSavedAt(nowStr);
    if (result.ok) {
      showToast('💾 全部交易数据已成功保存，并同步至 Supabase 云端数据库！');
    } else {
      showToast('⚠️ 云端同步失败，数据已保存在本地！');
    }
  };

  // Add / Edit Trade Handler
  const handleSaveTrade = async (partialTrade: Partial<TradeRecord>) => {
    const now = new Date().toISOString();
    const existingId = partialTrade.id;
    const isEdit = Boolean(existingId && trades.some(t => t.id === existingId));

    let updatedList: TradeRecord[] = [];

    if (isEdit && existingId) {
      updatedList = trades.map(t => t.id === existingId ? { ...t, ...partialTrade, updatedAt: now } as TradeRecord : t);
      const target = updatedList.find(t => t.id === existingId);
      if (target && supabase && user) {
        markLocalMutation();
        const row = mapTradeToRow({ ...target, updatedAt: now });
        // 表单保存时备注状态允许显式清空 (null), 避免 undefined 被映射层丢弃导致云端残留旧状态
        if ('notesCompleted' in partialTrade) {
          row.notes_completed = target.notesCompleted ?? null;
        }
        const { error } = await supabase.from('trades').upsert(row, { onConflict: 'id' });
        if (error) console.error('Supabase 更新交易错误:', error.message);
      }
      showToast('💾 交易已更新！全部历史与插入交易已按时间轴重新对算！');
    } else {
      // Create new trade
      const newId = existingId || `trade_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const newTradeRecord: TradeRecord = {
        ...partialTrade,
        id: newId,
        userId: user ? user.uid : 'local_user',
        createdAt: now,
        updatedAt: now,
      } as TradeRecord;

      updatedList = [newTradeRecord, ...trades];

      if (supabase && user) {
        markLocalMutation();
        const row = mapTradeToRow(newTradeRecord);
        const { error } = await supabase.from('trades').upsert(row, { onConflict: 'id' });
        if (error) console.error('Supabase 新增交易错误:', error.message);
      }
      showToast('💾 新增交易已保存！全量持仓与成本已按时间轴倒排重算！');
    }

    updateTradesWithHistory(updatedList);
  };

  // 设置备注状态: true=完成(绿) / false=未完成(橙) / null=取消标记(白)
  const handleSetNoteStatus = async (tradeId: string, status: boolean | null) => {
    const targetTrade = trades.find(t => t.id === tradeId);
    if (!targetTrade) return;

    const now = new Date().toISOString();

    setTrades(prev => prev.map(t => t.id === tradeId ? { ...t, notesCompleted: status ?? undefined, updatedAt: now } : t));

    if (supabase && user) {
      markLocalMutation();
      const { error } = await supabase
        .from('trades')
        .update({ notes_completed: status, updated_at: now })
        .eq('id', tradeId);
      if (error) console.error('更新备注状态错误:', error.message);
    }

    if (status === true) showToast('✅ 备注已标记为"完成"，文字变绿色');
    else if (status === false) showToast('⏳ 备注已标记为"未完成"，文字变橙色，已列入任务跟进');
    else showToast('↩️ 已取消备注状态标记，文字恢复白色');
  };

  // Delete Trades Handler
  const handleDeleteTrades = async (ids: string[]) => {
    if (!ids || ids.length === 0) return;

    await deleteTradesFromCloud(ids);

    const remaining = trades.filter(t => !ids.includes(t.id));
    if (remaining.length === 0) {
      localStorage.setItem('user_has_cleared_trades', 'true');
    }
    updateTradesWithHistory(remaining);
    showToast(`🗑️ 已成功删除 ${ids.length} 笔交易，后续持仓与成本已按时间轴精确重算！`);
  };

  // Import Batch Excel Success
  const handleImportSuccess = async (importedList: Partial<TradeRecord>[]) => {
    // 每条记录的 createdAt 依次递增 1ms, 保证同一天多笔交易严格按 Excel 从上到下的顺序参与计算
    const baseMs = Date.now();
    const newRecords: TradeRecord[] = importedList.map((t, i) => ({
      ...t,
      id: t.id || `imp_${baseMs}_${i}`,
      userId: user ? user.uid : 'local_user',
      createdAt: new Date(baseMs + i).toISOString(),
      updatedAt: new Date(baseMs + i).toISOString(),
    } as TradeRecord));

    if (supabase && user) {
      markLocalMutation();
      const rows = newRecords.map(mapTradeToRow);
      const { error } = await supabase.from('trades').upsert(rows);
      if (error) console.error('Supabase 批量导入错误:', error.message);
    }

    updateTradesWithHistory([...newRecords, ...trades]);
    showToast(`📥 成功导入 ${newRecords.length} 笔记录，已按时间轴重算全套对账数据！`);
    setActiveTab('ledger');
  };

  const handleLoadDemoData = () => {
    localStorage.removeItem('user_has_cleared_trades');
    updateTradesWithHistory(INITIAL_DEMO_TRADES);
    showToast('🔄 已加载示例数据（仅本地预览，点击"保存数据"才会上传云端），并重新倒排对算！');
  };

  // 智能筛选导出 Excel
  const markWeeklyExportDone = () => {
    localStorage.setItem('weekly_excel_export_done', fridayInfo.weekKey);
    setWeeklyDismissed(true);
  };

  // Smart Filtered Export Excel Handler
  const handleExportExcel = (customTrades?: TradeRecord[]) => {
    const listToExport = customTrades || displayTrades;
    if (!listToExport || listToExport.length === 0) {
      showToast('⚠️ 当前视图中暂无对账数据可供导出');
      return;
    }

    let filename = '股市对账单_交易明细.xlsx';

    // Single stock selected or custom trades filtered for a single stock
    if (selectedStockCode) {
      const targetObj = listToExport.find(t => t.stockCode === selectedStockCode || t.stockName === selectedStockCode) || listToExport[0];
      const stockName = targetObj?.stockName || selectedStockCode;
      const stockCode = targetObj?.stockCode || '';
      filename = `股市对账单_${stockName}${stockCode ? `_${stockCode}` : ''}.xlsx`;
    } else if (customTrades && customTrades.length < trades.length) {
      const firstStockName = customTrades[0]?.stockName || customTrades[0]?.stockCode;
      const isSingleStock = customTrades.every(t => t.stockCode === customTrades[0]?.stockCode || t.stockName === customTrades[0]?.stockName);
      if (isSingleStock && firstStockName) {
        filename = `股市对账单_${firstStockName}.xlsx`;
      } else {
        filename = `股市对账单_筛选细分对账.xlsx`;
      }
    }

    exportTradesToExcel(listToExport, filename);
    markWeeklyExportDone();
    showToast(`📊 已导出对账单：${filename} (共 ${listToExport.length} 笔明细)`);
  };

  // ------------------------------------------------------------
  // 每周五 15:00 (北京时间) 收盘后的导出备份提醒
  // ------------------------------------------------------------
  const [nowTick, setNowTick] = useState(Date.now());
  const [weeklyDismissed, setWeeklyDismissed] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  // 计算本周五(北京时间) 15:00 收盘时点与周标识
  const fridayInfo = useMemo(() => {
    const bj = new Date(nowTick + 8 * 3600 * 1000); // 视作 UTC 读取即为北京时间
    const day = bj.getUTCDay(); // 0=周日 ... 5=周五
    const daysSinceFriday = (day + 7 - 5) % 7;
    const fridayBj = new Date(bj);
    fridayBj.setUTCDate(bj.getUTCDate() - daysSinceFriday);
    const weekKey = `${fridayBj.getUTCFullYear()}-${String(fridayBj.getUTCMonth() + 1).padStart(2, '0')}-${String(fridayBj.getUTCDate()).padStart(2, '0')}`;
    const fridayCloseMs = Date.parse(`${weekKey}T15:00:00+08:00`);
    return { weekKey, due: nowTick >= fridayCloseMs };
  }, [nowTick]);

  const weeklyExportReminderVisible =
    fridayInfo.due &&
    !weeklyDismissed &&
    localStorage.getItem('weekly_excel_export_done') !== fridayInfo.weekKey &&
    trades.length > 0;

  // 打开新增成交记录: 若已选中某只股票/基金, 则默认为该标的添加
  const openTradeFormWithSelection = () => {
    if (selectedStockCode) {
      const t = trades.find(x => x.stockCode === selectedStockCode || x.stockName === selectedStockCode);
      if (t) {
        setQuickStockInfo({
          stockCode: t.stockCode,
          stockName: t.stockName,
          account: t.account,
          strategyName: t.strategyName,
          strategyType: t.strategyType,
        });
      }
    } else {
      setQuickStockInfo(null);
    }
    setEditingTrade(null);
    setIsTradeFormOpen(true);
  };

  return (
    <PasscodeGate>
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-slate-950 pb-16 md:pb-0 relative">
        {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed top-20 right-4 z-50 bg-slate-900 text-emerald-300 border border-emerald-500/40 px-4 py-3 rounded-2xl shadow-2xl flex items-center space-x-2 text-xs sm:text-sm font-medium animate-bounce max-w-md">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        user={user}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        onOpenTradeForm={openTradeFormWithSelection}
        onExportExcel={() => handleExportExcel()}
        onLoadDemoData={handleLoadDemoData}
        onSaveAndSync={handleSaveAndSyncToDb}
        isCloudSynced={isCloudSynced}
        tradeCount={trades.length}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={handleUndo}
        onRedo={handleRedo}
        lastSavedAt={lastSavedAt}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-[1920px] w-full mx-auto px-2 sm:px-3 lg:px-4 py-3 space-y-3">
        {/* 每周五 15:00 收盘后: 导出 Excel 备份提醒 */}
        {weeklyExportReminderVisible && (
          <div className="bg-amber-500/10 border border-amber-500/40 rounded-2xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-bold text-amber-300">📌 每周备份提醒：本周五 15:00 已收盘</div>
                <div className="text-[11px] text-amber-400/70 mt-0.5">
                  建议导出本周对账单 Excel 备份一份（{fridayInfo.weekKey} 那周尚未导出）
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleExportExcel()}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-slate-950 hover:bg-amber-400 rounded-xl text-xs font-bold transition-all"
              >
                <Download className="w-3.5 h-3.5" />
                立即导出 Excel
              </button>
              <button
                onClick={markWeeklyExportDone}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-xl text-xs transition-all"
                title="本周不再提醒"
              >
                <X className="w-3.5 h-3.5" />
                本周已处理
              </button>
            </div>
          </div>
        )}
        {/* KPI Performance Dashboard Banner - Available on all tabs */}
        <DashboardStats metrics={metrics} />

        {/* Pending Fund Trade Net Value Reminder Banner */}
        <PendingFundTradesBanner
          trades={trades}
          onSaveTrade={handleSaveTrade}
          onEditTrade={(trade) => { setEditingTrade(trade); setIsTradeFormOpen(true); }}
        />

        {/* Stock Quick Selector & Navigation Bar */}
        <StockQuickSelector
          trades={trades}
          selectedStockCode={selectedStockCode}
          onSelectStock={setSelectedStockCode}
          onQuickAddForStock={(stockInfo) => {
            setQuickStockInfo(stockInfo);
            setEditingTrade(null);
            setIsTradeFormOpen(true);
          }}
          gridConfigs={gridConfigs}
          onSaveGridConfig={handleSaveGridConfig}
          onDeleteGridConfig={handleDeleteGridConfig}
        />

        {/* Tab 1: Ledger Statement (对账单明细) */}
        {activeTab === 'ledger' && (
          <div>
            {/* Desktop View */}
            <div className="hidden md:block">
              <TradeTable
                trades={displayTrades}
                selectedStockCode={selectedStockCode}
                onEditTrade={(trade) => { setEditingTrade(trade); setIsTradeFormOpen(true); }}
                onDeleteTrades={handleDeleteTrades}
                onAddNewTrade={openTradeFormWithSelection}
                onExportExcel={handleExportExcel}
                onSaveAndSync={handleSaveAndSyncToDb}
                onSetNoteStatus={handleSetNoteStatus}
                lastSavedAt={lastSavedAt}
                canUndo={canUndo}
                canRedo={canRedo}
                onUndo={handleUndo}
                onRedo={handleRedo}
              />
            </div>

            {/* Mobile View */}
            <div className="md:hidden">
              <TradeCardList
                trades={displayTrades}
                selectedStockCode={selectedStockCode}
                onEditTrade={(trade) => { setEditingTrade(trade); setIsTradeFormOpen(true); }}
                onDeleteTrades={handleDeleteTrades}
                onAddNewTrade={openTradeFormWithSelection}
                onSetNoteStatus={handleSetNoteStatus}
              />
            </div>
          </div>
        )}

        {/* Tab 1.5: 任务跟进 (未完成备注看板) */}
        {activeTab === 'tasks' && (
          <NotesTaskBoard
            trades={trades}
            onSetNoteStatus={handleSetNoteStatus}
            onEditTrade={(trade) => { setEditingTrade(trade); setIsTradeFormOpen(true); }}
          />
        )}


        {/* Tab 2: Analytics Charts */}
        {activeTab === 'analytics' && (
          <AnalyticsCharts trades={trades} metrics={metrics} />
        )}

        {/* Tab 3: Positions Summary */}
        {activeTab === 'positions' && (
          <PositionsSummary 
            trades={trades} 
            gridConfigs={gridConfigs}
            onSaveGridConfig={handleSaveGridConfig}
            onDeleteGridConfig={handleDeleteGridConfig}
          />
        )}

        {/* Tab 4: Strategy Evaluator */}
        {activeTab === 'strategies' && (
          <StrategyManager 
            trades={trades} 
            gridConfigs={gridConfigs}
            onSaveGridConfig={handleSaveGridConfig}
            onDeleteGridConfig={handleDeleteGridConfig}
          />
        )}

        {/* Tab 5: Excel Import & Backup */}
        {activeTab === 'import' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl my-4 space-y-6">
            <div>
              <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                <span>Excel 交易历史对账单导入与云端备份</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">导入您之前的 Excel 账单继续编辑，或一键导出当前云端对账单为标准 Excel 格式</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div 
                onClick={() => setIsImportModalOpen(true)}
                className="bg-slate-950 hover:bg-slate-900 border-2 border-dashed border-emerald-500/40 hover:border-emerald-400 rounded-2xl p-8 text-center cursor-pointer transition-all space-y-3 group"
              >
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto group-hover:scale-110 transition-all">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
                <div>
                  <div className="font-bold text-slate-100 text-sm">打开 Excel 智能导入向导</div>
                  <div className="text-xs text-slate-500 mt-1">自动识别表头、格式校验、并批量存入云端数据库</div>
                </div>
              </div>

              <div 
                onClick={handleExportExcel}
                className="bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-8 text-center cursor-pointer transition-all space-y-3 group"
              >
                <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center mx-auto group-hover:scale-110 transition-all">
                  <Cloud className="w-6 h-6" />
                </div>
                <div>
                  <div className="font-bold text-slate-100 text-sm">导出当前全量对账单 (.xlsx)</div>
                  <div className="text-xs text-slate-500 mt-1">导出包含19个完整字段的官方 Excel 备份明细</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modals */}
      <TradeFormModal
        isOpen={isTradeFormOpen}
        onClose={() => {
          setIsTradeFormOpen(false);
          setQuickStockInfo(null);
          setEditingTrade(null);
        }}
        onSave={(trade) => {
          handleSaveTrade(trade);
          setEditingTrade(null);
        }}
        initialTrade={editingTrade}
        existingTrades={trades}
        quickStockInfo={quickStockInfo}
      />


      <ExcelImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportSuccess={handleImportSuccess}
        userId={user ? user.uid : 'local_user'}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        user={user}
      />
    </div>
    </PasscodeGate>
  );
}
