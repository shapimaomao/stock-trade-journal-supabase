import React, { useState } from 'react';
import { 
  FileSpreadsheet, 
  Upload, 
  Download, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  ArrowRight,
  Layers,
  Sparkles,
  CheckSquare,
  Square
} from 'lucide-react';
import { ExcelImportFieldMapping, TradeRecord } from '../types';
import { 
  parseExcelFile, 
  convertRowsToTrades, 
  downloadExcelTemplate,
  ExcelSheetData,
  ExcelParseResult 
} from '../lib/excel';

interface ExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: (importedTrades: Partial<TradeRecord>[]) => void;
  userId: string;
}

export const ExcelImportModal: React.FC<ExcelImportModalProps> = ({
  isOpen,
  onClose,
  onImportSuccess,
  userId,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [sheets, setSheets] = useState<ExcelSheetData[]>([]);
  const [selectedSheetNames, setSelectedSheetNames] = useState<string[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, any>[]>([]);
  const [mapping, setMapping] = useState<ExcelImportFieldMapping>({
    stockCode: '',
    stockName: '',
    account: '',
    strategyName: '',
    strategyType: '',
    tradeDate: '',
    orderType: '',
    tradeAction: '',
    fee: '',
    price: '',
    quantity: '',
    amount: '',
    accumulatedCapital: '',
    accumulatedPosition: '',
    positionCost: '',
    gainLossRatio: '',
    positionPnL: '',
    accumulatedPnL: '',
    notes: '',
  });

  const [step, setStep] = useState<'upload' | 'mapping' | 'preview'>('upload');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleFileSelect = async (selectedFile: File) => {
    try {
      setLoading(true);
      setErrorMsg('');
      setFile(selectedFile);

      const parsed: ExcelParseResult = await parseExcelFile(selectedFile);
      setSheets(parsed.sheets);
      const allSheetNames = parsed.sheets.map(s => s.sheetName);
      setSelectedSheetNames(allSheetNames);
      setHeaders(parsed.headers);
      setRawRows(parsed.rawRows);
      setMapping(parsed.suggestedMapping);
      setStep('mapping');
    } catch (err: any) {
      setErrorMsg(typeof err === 'string' ? err : '文件解析失败，请检查是否为有效的 Excel/CSV 表格');
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const toggleSheetSelection = (sheetName: string) => {
    setSelectedSheetNames(prev => {
      if (prev.includes(sheetName)) {
        if (prev.length === 1) return prev; // Keep at least one
        return prev.filter(s => s !== sheetName);
      } else {
        return [...prev, sheetName];
      }
    });
  };

  const getFilteredRows = () => {
    if (sheets.length === 0) return rawRows;
    return sheets
      .filter(s => selectedSheetNames.includes(s.sheetName))
      .flatMap(s => s.rawRows);
  };

  const activeRows = getFilteredRows();

  const handleMappingChange = (field: keyof ExcelImportFieldMapping, value: string) => {
    setMapping(prev => ({ ...prev, [field]: value }));
  };

  const handleConfirmMapping = () => {
    if (activeRows.length === 0) {
      alert('请至少勾选一个有效的工作表 Sheet 进行导入！');
      return;
    }
    setStep('preview');
  };

  const handleExecuteImport = () => {
    const converted = convertRowsToTrades(activeRows, mapping, userId);
    onImportSuccess(converted);
    onClose();
  };

  // Group active preview trades by stock name for breakdown summary
  const convertedPreviewTrades = convertRowsToTrades(activeRows, mapping, userId);
  const stockSummaryMap: Record<string, { code: string; name: string; count: number }> = {};
  convertedPreviewTrades.forEach(t => {
    const key = `${t.stockCode}_${t.stockName}`;
    if (!stockSummaryMap[key]) {
      stockSummaryMap[key] = { code: t.stockCode || 'UNKNOWN', name: t.stockName || '股票', count: 0 };
    }
    stockSummaryMap[key].count += 1;
  });
  const stockSummaries = Object.values(stockSummaryMap);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in font-sans">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">导入已有 Excel / CSV 交易对账单</h3>
              <p className="text-[11px] text-slate-400">支持多 Sheet 多股票智能自动识别、表头校准与计算</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs text-slate-300 flex-1">
          {errorMsg && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-xl flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* STEP 1: Upload */}
          {step === 'upload' && (
            <div className="space-y-4">
              <div 
                onDragOver={e => e.preventDefault()}
                onDrop={handleDrop}
                className="border-2 border-dashed border-slate-700 hover:border-emerald-500 rounded-2xl p-8 text-center bg-slate-950/60 transition-all cursor-pointer group"
              >
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  className="hidden"
                  id="excel-file-input"
                  onChange={e => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                />
                <label htmlFor="excel-file-input" className="cursor-pointer block space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto group-hover:scale-110 transition-all">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-sm font-bold text-slate-200 block">点击上传或将 Excel/CSV 拖拽至此处</span>
                    <span className="text-slate-500 text-[11px]">支持 .xlsx, .xls, .csv 格式（支持单文件包含多个股票 Sheet 工作表）</span>
                  </div>
                </label>
              </div>

              {/* Download Template helper */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-200">没有标准格式？</div>
                  <div className="text-[11px] text-slate-400">下载智股手账标准 Excel 对账单模板，直接填写导入。</div>
                </div>
                <button
                  onClick={downloadExcelTemplate}
                  className="flex items-center space-x-1 px-3 py-1.5 bg-slate-800 text-emerald-400 border border-emerald-500/30 hover:bg-slate-700 rounded-xl text-xs font-medium transition-all cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>下载Excel模板</span>
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Column Mapping & Sheet Selector */}
          {step === 'mapping' && (
            <div className="space-y-4">
              {/* Multi-sheet detection summary */}
              <div className="bg-emerald-500/10 border border-emerald-500/20 p-3.5 rounded-xl space-y-2">
                <div className="flex items-center justify-between text-emerald-300 font-bold">
                  <div className="flex items-center space-x-2">
                    <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>已检索到 <strong className="font-mono text-white text-sm">{sheets.length}</strong> 个 Sheet 工作表（包含 <strong className="font-mono text-white text-sm">{activeRows.length}</strong> 条成交数据）：</span>
                  </div>
                </div>

                {/* Interactive Sheet badges */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {sheets.map(s => {
                    const isSelected = selectedSheetNames.includes(s.sheetName);
                    return (
                      <button
                        key={s.sheetName}
                        type="button"
                        onClick={() => toggleSheetSelection(s.sheetName)}
                        className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg border text-[11px] transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-semibold'
                            : 'bg-slate-950/80 text-slate-500 border-slate-800 hover:text-slate-300'
                        }`}
                      >
                        {isSelected ? <CheckSquare className="w-3.5 h-3.5 text-emerald-400" /> : <Square className="w-3.5 h-3.5 text-slate-600" />}
                        <span>{s.sheetName}</span>
                        <span className="font-mono text-[10px] opacity-80">({s.rawRows.length}条)</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <div className="font-bold text-slate-200 text-sm flex items-center justify-between">
                  <span>对齐 Excel 列与数据库字段：</span>
                  {(!mapping.stockCode || !mapping.stockName) && (
                    <span className="text-[10px] text-amber-400 font-normal">
                      💡 未选股票列时，将自动按 Sheet 名称划分股票
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[260px] overflow-y-auto pr-2">
                  {[
                    { key: 'stockCode', label: '股票代码' },
                    { key: 'stockName', label: '股票名称' },
                    { key: 'account', label: '股票账户行' },
                    { key: 'strategyName', label: '策略名称' },
                    { key: 'tradeDate', label: '成交日期' },
                    { key: 'tradeAction', label: '买卖判断 (买/卖/分红)' },
                    { key: 'price', label: '成交价格' },
                    { key: 'quantity', label: '成交数量' },
                    { key: 'amount', label: '成交金额/发生金额' },
                    { key: 'fee', label: '手续费/佣金' },
                    { key: 'notes', label: '备注说明' },
                  ].map(item => (
                    <div key={item.key} className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between">
                      <span className="text-slate-300 font-medium">{item.label}:</span>
                      <select
                        value={mapping[item.key as keyof ExcelImportFieldMapping] || ''}
                        onChange={e => handleMappingChange(item.key as keyof ExcelImportFieldMapping, e.target.value)}
                        className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-slate-100 text-xs focus:outline-none focus:border-emerald-500 max-w-[140px]"
                      >
                        <option value="">--未匹配--</option>
                        {headers.map(h => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex justify-between items-center border-t border-slate-800">
                <button
                  onClick={() => setStep('upload')}
                  className="px-3 py-1.5 bg-slate-800 text-slate-300 hover:text-white rounded-xl cursor-pointer"
                >
                  重新选择文件
                </button>

                <button
                  onClick={handleConfirmMapping}
                  className="flex items-center space-x-1 px-4 py-1.5 bg-emerald-500 text-slate-950 font-bold rounded-xl shadow-md hover:bg-emerald-400 cursor-pointer"
                >
                  <span>确认映射关系并预览</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Preview */}
          {step === 'preview' && (
            <div className="space-y-4">
              {/* Stock breakdown preview */}
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
                <div className="font-bold text-slate-200 flex items-center justify-between">
                  <span>即将在云端与本地归类导入以下 <strong className="text-emerald-400">{stockSummaries.length}</strong> 只股票（共 {activeRows.length} 条记录）：</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {stockSummaries.map((st, i) => (
                    <div key={i} className="px-2.5 py-1 bg-slate-900 border border-slate-700/80 rounded-lg text-xs flex items-center space-x-1.5">
                      <span className="font-bold text-emerald-300">{st.name}</span>
                      <span className="text-[10px] text-slate-400 font-mono">({st.code})</span>
                      <span className="bg-emerald-500/20 text-emerald-400 text-[10px] px-1.5 rounded font-bold">{st.count}笔</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-x-auto max-h-[220px]">
                <table className="w-full text-left text-[11px] font-mono text-slate-300">
                  <thead className="bg-slate-900 border-b border-slate-800 text-slate-400">
                    <tr>
                      {sheets.length > 1 && <th className="p-2">Sheet来源</th>}
                      <th className="p-2">代码</th>
                      <th className="p-2">名称</th>
                      <th className="p-2">日期</th>
                      <th className="p-2">方向</th>
                      <th className="p-2">价格</th>
                      <th className="p-2">数量</th>
                      <th className="p-2">手续费</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {convertedPreviewTrades.slice(0, 10).map((t, idx) => (
                      <tr key={idx} className="hover:bg-slate-900/50">
                        {sheets.length > 1 && (
                          <td className="p-2 text-purple-300 font-sans text-[10px]">
                            {activeRows[idx]?._sheetName || '-'}
                          </td>
                        )}
                        <td className="p-2 text-slate-100">{t.stockCode}</td>
                        <td className="p-2 text-slate-100 font-bold">{t.stockName}</td>
                        <td className="p-2">{t.tradeDate}</td>
                        <td className="p-2 font-bold">{t.tradeAction === 'dividend' ? '🎁 分红' : t.tradeAction === 'buy' ? '买入' : '卖出'}</td>
                        <td className="p-2">¥{t.price}</td>
                        <td className="p-2">{t.quantity}</td>
                        <td className="p-2 text-slate-200">¥{t.fee}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {activeRows.length > 10 && (
                <div className="text-center text-[11px] text-slate-500">
                  以及另外 {activeRows.length - 10} 条交易记录...
                </div>
              )}

              <div className="pt-2 flex justify-between items-center border-t border-slate-800">
                <button
                  onClick={() => setStep('mapping')}
                  className="px-3 py-1.5 bg-slate-800 text-slate-300 hover:text-white rounded-xl cursor-pointer"
                >
                  返回上一步
                </button>

                <button
                  onClick={handleExecuteImport}
                  className="flex items-center space-x-1.5 px-5 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold rounded-xl shadow-lg hover:brightness-110 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>分股票全量导入 ({activeRows.length} 条记录)</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
