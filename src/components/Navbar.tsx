import React from 'react';
import { 
  TrendingUp, 
  BarChart3, 
  Table, 
  Briefcase, 
  Target, 
  FileSpreadsheet, 
  Cloud, 
  CloudOff, 
  User as UserIcon, 
  PlusCircle, 
  Download, 
  RefreshCw,
  Save,
  Lock,
  Undo2,
  Redo2,
  ClipboardList
} from 'lucide-react';
import { UserProfile } from '../types';
import { lockPasscodeSystem } from './PasscodeGate';

interface NavbarProps {
  activeTab: 'ledger' | 'tasks' | 'analytics' | 'positions' | 'strategies' | 'import';
  setActiveTab: (tab: 'ledger' | 'tasks' | 'analytics' | 'positions' | 'strategies' | 'import') => void;
  user: UserProfile | null;
  onOpenAuthModal: () => void;
  onOpenTradeForm: () => void;
  onExportExcel: () => void;
  onLoadDemoData: () => void;
  onSaveAndSync: () => void;
  isCloudSynced: boolean;
  tradeCount: number;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  user,
  onOpenAuthModal,
  onOpenTradeForm,
  onExportExcel,
  onLoadDemoData,
  onSaveAndSync,
  isCloudSynced,
  tradeCount,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
}) => {
  return (
    <header className="bg-slate-900 border-b border-slate-800 text-slate-100 sticky top-0 z-30 shadow-md">
      <div className="max-w-[1920px] mx-auto px-2 sm:px-4 lg:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveTab('ledger')}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 font-bold shadow-lg shadow-emerald-500/20">
              <TrendingUp className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg tracking-tight text-white">智股手账</span>
                <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-medium">
                  Cloud Sync
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">股市对账单与多策略收益分析</p>
            </div>
          </div>

          {/* Desktop Nav Tabs */}
          <nav className="hidden md:flex items-center space-x-1 bg-slate-950/60 p-1.5 rounded-xl border border-slate-800/80">
            <button
              onClick={() => setActiveTab('ledger')}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'ledger'
                  ? 'bg-emerald-500 text-slate-950 font-semibold shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Table className="w-4 h-4" />
              <span>交易对账单</span>
              <span className="ml-1 px-1.5 py-0.2 text-[10px] rounded-full bg-slate-800 text-slate-300">
                {tradeCount}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('tasks')}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'tasks'
                  ? 'bg-orange-500 text-slate-950 font-semibold shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <ClipboardList className="w-4 h-4" />
              <span>任务跟进</span>
            </button>

            <button
              onClick={() => setActiveTab('analytics')}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'analytics'
                  ? 'bg-emerald-500 text-slate-950 font-semibold shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>收益图表</span>
            </button>

            <button
              onClick={() => setActiveTab('positions')}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'positions'
                  ? 'bg-emerald-500 text-slate-950 font-semibold shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Briefcase className="w-4 h-4" />
              <span>持仓分析</span>
            </button>

            <button
              onClick={() => setActiveTab('strategies')}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'strategies'
                  ? 'bg-emerald-500 text-slate-950 font-semibold shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Target className="w-4 h-4" />
              <span>策略评估</span>
            </button>

            <button
              onClick={() => setActiveTab('import')}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'import'
                  ? 'bg-emerald-500 text-slate-950 font-semibold shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Excel导入/备份</span>
            </button>
          </nav>

          {/* Action Buttons Right */}
          <div className="flex items-center space-x-2">
            {/* Undo / Redo Buttons */}
            <div className="flex items-center space-x-0.5 bg-slate-950/80 p-1 rounded-xl border border-slate-800">
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
                <span className="hidden xl:inline text-[11px]">撤销</span>
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
                <span className="hidden xl:inline text-[11px]">重做</span>
              </button>
            </div>

            <button
              onClick={onOpenTradeForm}
              className="hidden sm:flex items-center space-x-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 hover:brightness-110 px-3.5 py-2 rounded-xl text-sm font-semibold shadow-md transition-all active:scale-95"
            >
              <PlusCircle className="w-4 h-4 stroke-[2.5]" />
              <span>记一笔</span>
            </button>

            <button
              onClick={onSaveAndSync}
              title="保存全部数据并同步到数据库"
              className="flex items-center space-x-1 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-bold transition-all active:scale-95"
            >
              <Save className="w-3.5 h-3.5" />
              <span>保存数据</span>
            </button>

            <button
              onClick={onExportExcel}
              title="导出当前对账单为Excel"
              className="p-2 text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 rounded-xl transition-all border border-slate-700/50 hidden lg:block"
            >
              <Download className="w-4 h-4" />
            </button>

            {tradeCount === 0 && (
              <button
                onClick={onLoadDemoData}
                className="hidden sm:flex items-center space-x-1.5 bg-slate-800 text-emerald-400 border border-emerald-500/30 hover:bg-slate-700 px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>加载演示示例</span>
              </button>
            )}

            {/* Cloud Status */}
            <div className="flex items-center px-2 py-1 rounded-lg bg-slate-800/50 border border-slate-700/50 text-xs text-slate-300">
              {isCloudSynced ? (
                <span className="flex items-center text-emerald-400 gap-1" title="数据已云端同步">
                  <Cloud className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">云端同步</span>
                </span>
              ) : (
                <span className="flex items-center text-amber-400 gap-1" title="未登录或本地暂存">
                  <CloudOff className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">本地模式</span>
                </span>
              )}
            </div>

            {/* Account / Login Button */}
            <button
              onClick={onOpenAuthModal}
              className="flex items-center space-x-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700/60 px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
            >
              <UserIcon className="w-3.5 h-3.5 text-emerald-400" />
              <span className="max-w-[80px] truncate">
                {user ? (user.displayName || user.email?.split('@')[0] || (user.isAnonymous ? '游客账号' : '已登录')) : '登录/云同步'}
              </span>
            </button>

            {/* Passcode Lock Button */}
            <button
              onClick={lockPasscodeSystem}
              title="锁定网站（输入密码才能解锁）"
              className="flex items-center space-x-1 px-2.5 py-1.5 bg-slate-800/90 hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 border border-slate-700 hover:border-rose-500/40 rounded-xl text-xs font-medium transition-all cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5 text-rose-400" />
              <span className="hidden xl:inline">锁定系统</span>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Bottom/Top Navigation Bar - Guaranteeing 100% full mobile functional parity */}
      <div className="md:hidden border-t border-slate-800 bg-slate-950 px-2 py-1.5 flex justify-around items-center text-xs">
        <button
          onClick={() => setActiveTab('ledger')}
          className={`flex flex-col items-center py-1 px-2 rounded-lg ${
            activeTab === 'ledger' ? 'text-emerald-400 font-bold bg-slate-900' : 'text-slate-400'
          }`}
        >
          <Table className="w-4 h-4" />
          <span className="text-[10px] mt-0.5">对账单</span>
        </button>

        <button
          onClick={() => setActiveTab('analytics')}
          className={`flex flex-col items-center py-1 px-2 rounded-lg ${
            activeTab === 'analytics' ? 'text-emerald-400 font-bold bg-slate-900' : 'text-slate-400'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span className="text-[10px] mt-0.5">统计图表</span>
        </button>

        <button
          onClick={onOpenTradeForm}
          className="flex flex-col items-center justify-center bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 font-bold rounded-full w-9 h-9 shadow-lg -mt-3 border-2 border-slate-900"
        >
          <PlusCircle className="w-5 h-5" />
        </button>

        <button
          onClick={() => setActiveTab('tasks')}
          className={`flex flex-col items-center py-1 px-2 rounded-lg ${
            activeTab === 'tasks' ? 'text-orange-400 font-bold bg-slate-900' : 'text-slate-400'
          }`}
        >
          <ClipboardList className="w-4 h-4" />
          <span className="text-[10px] mt-0.5">任务跟进</span>
        </button>

        <button
          onClick={() => setActiveTab('positions')}
          className={`flex flex-col items-center py-1 px-2 rounded-lg ${
            activeTab === 'positions' ? 'text-emerald-400 font-bold bg-slate-900' : 'text-slate-400'
          }`}
        >
          <Briefcase className="w-4 h-4" />
          <span className="text-[10px] mt-0.5">持仓分析</span>
        </button>

        <button
          onClick={() => setActiveTab('strategies')}
          className={`flex flex-col items-center py-1 px-2 rounded-lg ${
            activeTab === 'strategies' ? 'text-emerald-400 font-bold bg-slate-900' : 'text-slate-400'
          }`}
        >
          <Target className="w-4 h-4" />
          <span className="text-[10px] mt-0.5">策略库</span>
        </button>

        <button
          onClick={() => setActiveTab('import')}
          className={`flex flex-col items-center py-1 px-2 rounded-lg ${
            activeTab === 'import' ? 'text-emerald-400 font-bold bg-slate-900' : 'text-slate-400'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span className="text-[10px] mt-0.5">导入备份</span>
        </button>
      </div>
    </header>
  );
};
