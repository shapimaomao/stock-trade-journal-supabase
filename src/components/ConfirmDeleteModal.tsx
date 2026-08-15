import React from 'react';
import { AlertTriangle, X, Trash2 } from 'lucide-react';

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  count: number;
  itemDescription?: string;
}

export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  count,
  itemDescription,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm shadow-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center font-bold">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div>
          <h3 className="text-base font-bold text-slate-100">确认删除交易对账记录？</h3>
          <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
            {itemDescription 
              ? `您确定要删除 ${itemDescription} 这笔记录吗？`
              : `您确定要彻底删除选中的 ${count} 笔对账明细记录吗？`}
          </p>
          <div className="text-[11px] text-rose-400/90 bg-rose-500/10 p-2.5 rounded-xl border border-rose-500/20 mt-3">
            ⚠️ 提示：删除后相关多空持仓、累计盈亏与持仓成本将实时重新对账计算。
          </div>
        </div>

        <div className="flex items-center space-x-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all"
          >
            取消
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="flex-1 py-2.5 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-xs font-bold shadow-md flex items-center justify-center space-x-1 transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>确认删除</span>
          </button>
        </div>
      </div>
    </div>
  );
};
