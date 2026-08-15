import React from 'react';
import { 
  X, 
  Cloud, 
  ShieldCheck, 
  KeyRound,
  Lock,
  CheckCircle2,
  LogOut,
  Mail
} from 'lucide-react';
import { UserProfile } from '../types';
import { lockPasscodeSystem } from './PasscodeGate';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile | null;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, user }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in font-sans">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden my-auto flex flex-col">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <h3 className="text-base font-bold text-slate-100">专属个人账户与系统状态</h3>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 text-xs text-slate-300">
          <div className="text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto text-xl font-bold shadow-lg shadow-emerald-500/10">
              <KeyRound className="w-7 h-7" />
            </div>

            <div>
              <div className="font-bold text-lg text-slate-100 flex items-center justify-center space-x-1.5">
                <span>专属独立交易账户</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <p className="text-slate-400 text-xs mt-1">
                已通过邮箱密码验证，数据受行级安全 (RLS) 保护
              </p>
            </div>
          </div>

          <div className="space-y-2 bg-slate-950/80 p-4 rounded-xl border border-slate-800 text-slate-300">
            <div className="flex items-center space-x-2 text-emerald-400 font-bold text-xs pb-1 border-b border-slate-800/80">
              <Cloud className="w-4 h-4 shrink-0" />
              <span>Supabase 云端实时同步中</span>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-400 pt-1">
              本系统设为单人专属模式。所有股票对账单、策略、持仓明细均保存在 Supabase 云端数据库，电脑与手机登录同一账号即可互通，无需额外操作。
            </p>
            {user?.email && (
              <div className="flex items-center space-x-1.5 text-[11px] text-emerald-300 pt-1">
                <Mail className="w-3.5 h-3.5" />
                <span className="font-mono">{user.email}</span>
              </div>
            )}
          </div>

          <div className="pt-2 space-y-2">
            <button
              onClick={() => {
                onClose();
                lockPasscodeSystem();
              }}
              className="w-full flex items-center justify-center space-x-2 py-3 bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30 rounded-xl font-bold transition-all cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>退出登录 (锁定系统)</span>
            </button>

            <button
              onClick={onClose}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium transition-all cursor-pointer text-center"
            >
              返回对账系统
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
