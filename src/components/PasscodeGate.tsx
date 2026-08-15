import React, { useState, useEffect } from 'react';
import { Lock, KeyRound, ShieldCheck, Eye, EyeOff, ArrowRight, AlertCircle, Mail, Loader2, Database, AlertTriangle } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const STORAGE_KEY = 'app_passcode_authenticated';

interface PasscodeGateProps {
  children: React.ReactNode;
}

export const PasscodeGate: React.FC<PasscodeGateProps> = ({ children }) => {
  const [session, setSession] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 订阅 Supabase Auth 状态
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }

    let mounted = true;
    supabase!.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setIsLoading(false);
    });

    const { data: sub } = supabase!.auth.onAuthStateChange((_event, newSession) => {
      if (!mounted) return;
      setSession(newSession);
      if (newSession) {
        localStorage.setItem(STORAGE_KEY, 'true');
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 font-sans">
        <Loader2 className="w-10 h-10 text-emerald-400 animate-spin" />
        <p className="mt-4 text-sm text-slate-400">正在验证安全连接...</p>
      </div>
    );
  }

  // 未配置 Supabase 时提示
  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 font-sans">
        <div className="w-full max-w-md bg-slate-900 border border-amber-500/30 rounded-2xl shadow-2xl p-6 sm:p-8">
          <div className="flex items-center space-x-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            <h1 className="text-lg font-bold text-white">数据库尚未配置</h1>
          </div>
          <p className="text-sm text-slate-400 leading-relaxed">
            请先在项目根目录创建 <code className="text-emerald-300 bg-slate-950 px-1.5 py-0.5 rounded font-mono text-xs">.env.local</code> 文件，填入：
          </p>
          <pre className="mt-3 bg-slate-950 border border-slate-800 rounded-xl p-4 text-[11px] text-emerald-300 font-mono overflow-x-auto leading-relaxed">
{`VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...`}
          </pre>
          <p className="mt-3 text-xs text-slate-500">配置后重启开发服务器即可。</p>
        </div>
      </div>
    );
  }

  if (session) {
    return (
      <div className="relative min-h-screen">
        {children}
      </div>
    );
  }

  return <LoginForm />;
};

// ------------------------------------------------------------
// 邮箱 + 密码登录表单
// ------------------------------------------------------------
const LoginForm: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isShaking, setIsShaking] = useState(false);

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!email.trim() || !password) {
      setErrorMsg('请输入邮箱和密码');
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    const { error } = await supabase!.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    setIsSubmitting(false);

    if (error) {
      setErrorMsg(
        error.message === 'Invalid login credentials'
          ? '邮箱或密码错误，请重试'
          : `登录失败: ${error.message}`
      );
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
    }
    // 成功后 session 由 onAuthStateChange 自动更新
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans">
      {/* Subtle Background Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 translate-y-1/2 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className={`w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8 relative z-10 transition-transform ${isShaking ? 'animate-bounce' : ''}`}>
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 shadow-lg shadow-emerald-500/20 mb-4">
            <Lock className="w-8 h-8 stroke-[2.5]" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white mb-2">
            智股手账 · 个人系统锁
          </h1>
          <p className="text-sm text-slate-400">
            请输入您的专属账号密码登录，数据受数据库行级安全保护
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              登录邮箱
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <Mail className="w-5 h-5" />
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errorMsg) setErrorMsg(null);
                }}
                placeholder="your@email.com"
                autoComplete="username"
                autoFocus
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-11 pr-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              密码
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <KeyRound className="w-5 h-5" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errorMsg) setErrorMsg(null);
                }}
                placeholder="请输入密码..."
                autoComplete="current-password"
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-11 pr-11 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-mono tracking-wider transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
                title={showPassword ? "隐藏密码" : "显示密码"}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {errorMsg && (
            <div className="flex items-center space-x-2 text-rose-400 text-xs mt-2.5 font-medium bg-rose-500/10 border border-rose-500/20 px-3 py-2 rounded-lg">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-emerald-500/20 flex items-center justify-center space-x-2 transition-all cursor-pointer disabled:opacity-60"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>验证中...</span>
              </>
            ) : (
              <>
                <span>安全登录</span>
                <ArrowRight className="w-5 h-5 stroke-[2.5]" />
              </>
            )}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-800 text-center flex items-center justify-center space-x-2 text-xs text-slate-500">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Supabase 行级安全 (RLS) · 仅本人可访问</span>
        </div>
        <div className="mt-2 text-center flex items-center justify-center space-x-2 text-[10px] text-slate-600">
          <Database className="w-3.5 h-3.5" />
          <span>数据加密存储于云端数据库</span>
        </div>
      </div>
    </div>
  );
};

// ------------------------------------------------------------
// 登出: 清空会话并返回登录页
// ------------------------------------------------------------
export const lockPasscodeSystem = async () => {
  if (supabase) {
    await supabase.auth.signOut();
  }
  localStorage.removeItem(STORAGE_KEY);
  window.location.reload();
};
