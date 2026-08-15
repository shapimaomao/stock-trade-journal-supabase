import React, { useState } from 'react';
import { 
  Sliders, 
  Upload, 
  Trash2, 
  Image as ImageIcon, 
  Maximize2, 
  X, 
  Edit3, 
  Check, 
  AlertCircle,
  TrendingUp,
  Grid
} from 'lucide-react';
import { GridStrategyConfig } from '../types';

interface GridStrategyCardProps {
  stockCode: string;
  stockName: string;
  account?: string;
  strategyName?: string;
  config?: GridStrategyConfig | null;
  onSaveConfig: (config: GridStrategyConfig) => void;
  onDeleteConfig?: (stockCode: string) => void;
}

export const GridStrategyCard: React.FC<GridStrategyCardProps> = ({
  stockCode,
  stockName,
  account = '默认账户',
  strategyName = '网格交易策略',
  config,
  onSaveConfig,
  onDeleteConfig,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isImageLightboxOpen, setIsImageLightboxOpen] = useState(false);

  // Form states initialized with existing config or smart defaults
  const [stepPercent, setStepPercent] = useState<number>(config?.stepPercent ?? 1.0);
  const [gridQuantity, setGridQuantity] = useState<number>(config?.gridQuantity ?? 1000);
  const [gridAmount, setGridAmount] = useState<number | ''>(config?.gridAmount ?? '');
  const [lowerPrice, setLowerPrice] = useState<number | ''>(config?.lowerPrice ?? '');
  const [upperPrice, setUpperPrice] = useState<number | ''>(config?.upperPrice ?? '');
  const [basePrice, setBasePrice] = useState<number | ''>(config?.basePrice ?? '');
  const [imageUrl, setImageUrl] = useState<string>(config?.imageUrl ?? '');
  const [notes, setNotes] = useState<string>(config?.notes ?? '');

  // Handle Image Upload (Converts file to Base64)
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('图片文件过大，请上传小于 5MB 的图片');
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      const result = evt.target?.result as string;
      setImageUrl(result);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    const updated: GridStrategyConfig = {
      id: config?.id || `grid_${stockCode}`,
      stockCode,
      stockName,
      account,
      strategyName: strategyName || '网格交易策略',
      stepPercent: Number(stepPercent) || 1.0,
      gridQuantity: Number(gridQuantity) || 1000,
      gridAmount: gridAmount !== '' ? Number(gridAmount) : undefined,
      lowerPrice: lowerPrice !== '' ? Number(lowerPrice) : undefined,
      upperPrice: upperPrice !== '' ? Number(upperPrice) : undefined,
      basePrice: basePrice !== '' ? Number(basePrice) : undefined,
      imageUrl: imageUrl || undefined,
      notes: notes || undefined,
      updatedAt: new Date().toISOString(),
    };

    onSaveConfig(updated);
    setIsEditing(false);
  };

  return (
    <div id={`grid-card-${stockCode}`} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3 relative overflow-hidden transition-all hover:border-slate-700">
      {/* Accent Background Gradient Glow */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-xl bg-slate-800 text-slate-200 border border-slate-700 flex items-center justify-center font-bold shadow-inner">
            <Grid className="w-4 h-4 text-slate-300" />
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="font-bold text-slate-100 text-sm">{stockName}</span>
              <span className="text-xs font-mono text-slate-400">({stockCode})</span>
              <span className="bg-slate-800/80 text-slate-300 border border-slate-700 text-[10px] px-2 py-0.5 rounded-full font-sans">
                网格策略
              </span>
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              定制策略: <span className="text-slate-200 font-medium">{strategyName}</span>
            </div>
          </div>
        </div>

        <button
          onClick={() => setIsEditing(!isEditing)}
          className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition-all flex items-center space-x-1 active:scale-95"
          title="定制网格参数与规划图"
        >
          {isEditing ? (
            <>
              <X className="w-3.5 h-3.5" />
              <span>取消修改</span>
            </>
          ) : (
            <>
              <Edit3 className="w-3.5 h-3.5" />
              <span>{config ? '设置/上传图' : '配置策略'}</span>
            </>
          )}
        </button>
      </div>

      {/* Display View or Edit Form */}
      {!isEditing ? (
        <div className="space-y-3">
          {/* Core Grid Parameter Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono bg-slate-950/80 p-3 rounded-xl border border-slate-800/80">
            <div>
              <span className="text-slate-500 block font-sans text-[10px]">网格步长 (%)</span>
              <span className="font-bold text-slate-100 text-sm">
                {config?.stepPercent ? `${config.stepPercent}%` : '未设置'}
              </span>
            </div>

            <div>
              <span className="text-slate-500 block font-sans text-[10px]">每次委托股数 / 金额</span>
              <span className="font-bold text-teal-300 text-sm">
                {config?.gridQuantity ? `${config.gridQuantity.toLocaleString()} 股` : '-'}
                {config?.gridAmount ? ` (¥${config.gridAmount})` : ''}
              </span>
            </div>

            <div>
              <span className="text-slate-500 block font-sans text-[10px]">运行区间 (下限 - 上限)</span>
              <span className="font-bold text-slate-200 text-sm">
                {config?.lowerPrice || config?.upperPrice ? (
                  `¥${config?.lowerPrice ?? '?'} ~ ¥${config?.upperPrice ?? '?'}`
                ) : (
                  <span className="text-slate-500 font-sans text-xs">未设定区间</span>
                )}
              </span>
            </div>

            <div>
              <span className="text-slate-500 block font-sans text-[10px]">基准建仓/参考价</span>
              <span className="font-bold text-slate-300 text-sm">
                {config?.basePrice ? `¥${config.basePrice.toFixed(3)}` : '-'}
              </span>
            </div>
          </div>

          {/* Notes summary if any */}
          {config?.notes && (
            <div className="text-xs text-slate-300 bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/60 font-sans">
              <span className="text-slate-500 font-semibold mr-1">策略规则:</span>
              {config.notes}
            </div>
          )}

          {/* Uploaded Strategy Image Display Box */}
          {config?.imageUrl ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-slate-400 font-sans">
                <span className="flex items-center gap-1 text-[11px]">
                  <ImageIcon className="w-3.5 h-3.5 text-slate-400" />
                  策略截图/网格表规划图:
                </span>
                <button
                  onClick={() => setIsImageLightboxOpen(true)}
                  className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-colors"
                >
                  <Maximize2 className="w-3 h-3" /> 点击放大查看
                </button>
              </div>

              <div 
                onClick={() => setIsImageLightboxOpen(true)}
                className="relative group rounded-xl overflow-hidden border border-slate-800 bg-slate-950 cursor-pointer max-h-48 flex items-center justify-center"
              >
                <img 
                  src={config.imageUrl} 
                  alt={`${stockName} 网格策略图`}
                  className="w-full object-cover max-h-48 group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-xs font-semibold text-white space-x-1">
                  <Maximize2 className="w-4 h-4" />
                  <span>全屏查看大图</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-950/40 border border-dashed border-slate-800 rounded-xl p-3 text-center">
              <p className="text-xs text-slate-500">暂未添加网格策略规划图/软件参数截图</p>
              <button
                onClick={() => setIsEditing(true)}
                className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-slate-300 hover:text-white bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700 transition-colors"
              >
                <Upload className="w-3 h-3" /> 点击上传策略截图
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Edit Mode Form */
        <div className="space-y-3 bg-slate-950/90 p-3.5 rounded-xl border border-slate-800 font-sans text-xs">
          <div className="text-xs font-bold text-slate-200 flex items-center space-x-1 mb-1">
            <Sliders className="w-3.5 h-3.5 text-slate-300" />
            <span>修改定制网格策略参数</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">网格步长 (%)</label>
              <input
                type="number"
                step="0.1"
                placeholder="例如 1.0 (表示1%)"
                value={stepPercent}
                onChange={e => setStepPercent(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 font-mono focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[11px] text-slate-400 block mb-1">每次委托股数 (股)</label>
              <input
                type="number"
                step="100"
                placeholder="例如 1000"
                value={gridQuantity}
                onChange={e => setGridQuantity(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 font-mono focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[11px] text-slate-400 block mb-1">运行区间 - 最低价 (元)</label>
              <input
                type="number"
                step="0.01"
                placeholder="网格下限价格"
                value={lowerPrice}
                onChange={e => setLowerPrice(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 font-mono focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[11px] text-slate-400 block mb-1">运行区间 - 最高价 (元)</label>
              <input
                type="number"
                step="0.01"
                placeholder="网格上限价格"
                value={upperPrice}
                onChange={e => setUpperPrice(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 font-mono focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[11px] text-slate-400 block mb-1">单次委托参考金额 (元/可选)</label>
              <input
                type="number"
                step="100"
                placeholder="例如 20000"
                value={gridAmount}
                onChange={e => setGridAmount(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 font-mono focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[11px] text-slate-400 block mb-1">参考基准价 (元/可选)</label>
              <input
                type="number"
                step="0.001"
                placeholder="建仓基准价格"
                value={basePrice}
                onChange={e => setBasePrice(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 font-mono focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] text-slate-400 block mb-1">策略补充规则与纪律</label>
            <input
              type="text"
              placeholder="例如: 跌穿25元暂停买入，突破32元全仓卖出"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          {/* Image Upload Area */}
          <div className="space-y-1.5">
            <label className="text-[11px] text-slate-400 block">策略截图 / 网格计划图片</label>
            <div className="flex items-center space-x-3">
              <label className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 rounded-lg cursor-pointer transition-colors flex items-center space-x-1.5 text-xs">
                <Upload className="w-3.5 h-3.5" />
                <span>{imageUrl ? '更换图片' : '上传策略图片/表格截图'}</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageUpload}
                />
              </label>
              {imageUrl && (
                <button
                  type="button"
                  onClick={() => setImageUrl('')}
                  className="px-2.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-lg transition-colors flex items-center space-x-1 text-xs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>清除图片</span>
                </button>
              )}
            </div>

            {imageUrl && (
              <div className="mt-2 rounded-lg overflow-hidden border border-slate-800 max-h-36">
                <img src={imageUrl} alt="策略截图预览" className="w-full object-cover max-h-36" />
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-800">
            {onDeleteConfig && config && (
              <button
                type="button"
                onClick={() => {
                  if (confirm(`确认删除 ${stockName} 的网格策略配置？`)) {
                    onDeleteConfig(stockCode);
                  }
                }}
                className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-lg text-xs transition-all mr-auto"
              >
                删除策略
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs shadow transition-all flex items-center space-x-1"
            >
              <Check className="w-3.5 h-3.5" />
              <span>保存策略</span>
            </button>
          </div>
        </div>
      )}

      {/* Lightbox Modal for Full-Size Image Preview */}
      {isImageLightboxOpen && imageUrl && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="relative max-w-4xl max-h-[90vh] overflow-auto bg-slate-900 border border-slate-800 rounded-2xl p-2 shadow-2xl">
            <button
              onClick={() => setIsImageLightboxOpen(false)}
              className="absolute top-4 right-4 z-10 p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-full border border-slate-700 shadow transition-all"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="p-2">
              <div className="text-xs text-slate-400 mb-2 font-mono flex items-center space-x-2 px-2">
                <span className="font-bold text-slate-200 text-sm">{stockName} ({stockCode})</span>
                <span>- 网格策略规划表</span>
              </div>
              <img 
                src={imageUrl} 
                alt={`${stockName} 网格策略图大图`}
                className="w-full h-auto max-h-[80vh] object-contain rounded-xl"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
