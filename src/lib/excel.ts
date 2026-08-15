import * as XLSX from 'xlsx';
import { TradeRecord, ExcelImportFieldMapping, StrategyType, TradeAction, OrderCategory } from '../types';
import { computeTradeDerivedFields, recalculateTradesChronologically } from './calculator';

// Alias dictionary for intelligent column header matching
const COLUMN_ALIASES: Record<keyof ExcelImportFieldMapping, string[]> = {
  stockCode: ['股票代码', '证券代码', '代码', '标的代码', 'Symbol', 'Stock Code', 'stockCode', '证券标志', '合约代码', '品种代码'],
  stockName: ['股票名称', '证券名称', '标的名称', '名称', 'Stock Name', 'Name', 'stockName', '合约名称', '品种名称'],
  account: ['股票账户行', '账户', '券商', '交易账户', '账户名', 'Account', 'Broker', 'account', '股东代码', '资金账号', '操作渠道'],
  strategyName: ['策略名称', '交易策略', '策略', 'Strategy', 'Strategy Name', 'strategyName'],
  strategyType: ['策略归属', '策略来源', '策略类型', '自己/别人策略', 'Strategy Type', 'strategyType'],
  tradeDate: ['成交日期', '交易日期', '委托时间', '成交时间', '日期', 'Date', 'Trade Date', 'tradeDate', '发生日期', '交割日期', '成交时间/日期', '委托日期', '清算日期'],
  orderType: ['委托类别', '订单类型', '委托类型', 'Order Type', 'Type', 'orderType'],
  tradeAction: ['买入卖出判断', '买卖判断', '方向', '操作', '买卖', 'Action', 'Side', 'tradeAction', '买卖标志', '业务名称', '操作类型', '委托方向', '成交方向', '交易方向', '业务标志', '操作名称', '类别', '业务类型', '买卖方向', '摘要', '备注说明', '交易类别', '委托动作'],
  fee: ['手续费', '佣金', '规费', '印花税', '总费用', 'Fee', 'Commission', 'fee', '交易费', '过户费', '发生费用', '费用'],
  price: ['成交价格', '成交均价', '买卖价格', '成交单价', '单价', '价格', 'Price', 'price', '成交价', '均价', '委托价格'],
  quantity: ['成交数量', '数量', '股数', '成交股数', '发生数量', '变动数量', 'Quantity', 'Qty', 'quantity', '成交量', '委托数量', '平仓数量'],
  amount: ['发生金额', '成交金额', '清算金额', '变动金额', 'Amount', 'amount', '成交总额', '结算金额'],
  accumulatedCapital: ['累计投入金额', '累计投入', '投入本金', 'Capital', 'accumulatedCapital'],
  accumulatedPosition: ['累计持仓', '持仓股数', '当前持仓', 'Position', 'accumulatedPosition'],
  positionCost: ['持仓成本', '成本价', '保本价', 'Cost', 'positionCost'],
  gainLossRatio: ['涨跌比', '涨跌幅', '收益率', 'Gain/Loss Ratio', 'gainLossRatio'],
  positionPnL: ['持仓盈亏', '浮动盈亏', 'Unrealized PnL', 'positionPnL'],
  accumulatedPnL: ['累计盈亏', '总盈亏', 'Total PnL', 'accumulatedPnL'],
  notes: ['备注', '交易笔记', '总结', 'Notes', 'Remark', 'notes'],
};

/**
 * Normalizes various raw Excel date formats into strict YYYY-MM-DD strings.
 */
export function normalizeTradeDate(dateVal: any): string {
  if (!dateVal) return new Date().toISOString().split('T')[0];

  if (dateVal instanceof Date) {
    if (!isNaN(dateVal.getTime())) {
      return dateVal.toISOString().split('T')[0];
    }
  }

  // Handle numbers (Excel serial date offset or YYYYMMDD integers like 20240520)
  if (typeof dateVal === 'number') {
    if (dateVal >= 19000101 && dateVal <= 20991231) {
      const s = String(Math.floor(dateVal));
      return `${s.substring(0, 4)}-${s.substring(4, 6)}-${s.substring(6, 8)}`;
    }
    // Excel serial date offset (number of days since Dec 30, 1899)
    if (dateVal > 20000 && dateVal < 80000) {
      const date = new Date((dateVal - (25567 + 2)) * 86400 * 1000);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    }
  }

  const str = String(dateVal).trim();

  // YYYYMMDD or YYYYMMDDHHMMSS e.g. "20240520"
  if (/^\d{8}/.test(str)) {
    return `${str.substring(0, 4)}-${str.substring(4, 6)}-${str.substring(6, 8)}`;
  }

  // YYYY/MM/DD or YYYY.MM.DD or YYYY-MM-DD
  const cleanStr = str.replace(/[\.\/]/g, '-').split(' ')[0];
  const parts = cleanStr.split('-');
  if (parts.length === 3) {
    const y = parts[0].length === 2 ? '20' + parts[0] : parts[0];
    const m = parts[1].padStart(2, '0');
    const d = parts[2].padStart(2, '0');
    const constructed = `${y}-${m}-${d}`;
    if (!isNaN(new Date(constructed).getTime())) {
      return constructed;
    }
  }

  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }

  return new Date().toISOString().split('T')[0];
}

/**
 * Intelligent trade action determination (buy vs sell) supporting Chinese broker delivery slips.
 */
export function determineTradeAction(
  actionRaw: string,
  rawAmount: number,
  rawQuantity: number
): TradeAction {
  const clean = actionRaw.trim().toLowerCase();

  // Dividend indicators
  const dividendKeywords = [
    '分红', '派息', '红利', '现金分红', '除权息', '分红派息', '送股分红', '息', 'dividend', 'div'
  ];
  if (dividendKeywords.some(kw => clean === kw || clean.includes(kw))) {
    return 'dividend';
  }

  // Sell indicators (Chinese and English)
  const sellKeywords = [
    '卖', '卖出', '证券卖出', '融券卖出', '担保品卖出', '平仓', 
    '赎回', '出', '减仓', '出库', '转出', 'sell', 's', '2', '-1'
  ];
  if (sellKeywords.some(kw => clean === kw || clean.includes(kw))) {
    return 'sell';
  }

  // Buy indicators (Chinese and English)
  const buyKeywords = [
    '买', '买入', '证券买入', '融资买入', '担保品买入', '开仓', 
    '申购', '入', '加仓', '入库', '转入', 'buy', 'b', '1', '红利再投'
  ];
  if (buyKeywords.some(kw => clean === kw || clean.includes(kw))) {
    return 'buy';
  }

  // Fallback 1: Negative raw quantity in broker export indicates a sell
  if (rawQuantity < 0) {
    return 'sell';
  }

  // Fallback 2: Check cash flow direction if action column is blank or ambiguous
  if (rawAmount < 0) {
    return 'buy';
  } else if (rawAmount > 0 && !clean) {
    return 'sell';
  }

  return 'buy';
}

/**
 * Auto-detects column mapping given header row array.
 */
export function autoDetectColumnMapping(headers: string[]): ExcelImportFieldMapping {
  const mapping: ExcelImportFieldMapping = {
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
  };

  const fields = Object.keys(COLUMN_ALIASES) as (keyof ExcelImportFieldMapping)[];

  fields.forEach(field => {
    const aliases = COLUMN_ALIASES[field];
    const match = headers.find(h => {
      const cleanH = String(h).trim().toLowerCase();
      return aliases.some(alias => cleanH === alias.toLowerCase() || cleanH.includes(alias.toLowerCase()));
    });
    if (match) {
      mapping[field] = match;
    }
  });

  return mapping;
}

/**
 * Interface for each parsed sheet in a multi-sheet Excel file.
 */
export interface ExcelSheetData {
  sheetName: string;
  headers: string[];
  rawRows: Record<string, any>[];
  derivedStockCode: string;
  derivedStockName: string;
}

export interface ExcelParseResult {
  sheetCount: number;
  sheets: ExcelSheetData[];
  headers: string[];
  rawRows: Record<string, any>[];
  suggestedMapping: ExcelImportFieldMapping;
}

/**
 * Derives stock code and name from sheet name if not present in column headers.
 * e.g. "600519 贵州茅台" -> { code: "600519", name: "贵州茅台" }
 * e.g. "平安银行" -> { code: "平安银行", name: "平安银行" }
 */
export function parseStockFromSheetName(sheetName: string): { code: string; name: string } {
  const clean = sheetName.trim();
  // Match stock codes (like 600519, 000001, 00700.HK, AAPL, etc)
  const codeMatch = clean.match(/([0-9]{5,6}(\.[A-Za-z]{2})?|[A-Za-z]{1,5})/);
  const code = codeMatch ? codeMatch[0] : '';
  
  // Remove code and separators from name
  let name = clean;
  if (code) {
    name = clean.replace(code, '');
  }
  name = name.replace(/[()（）_\-\s]+/g, ' ').trim();

  if (!name && code) name = code;
  if (!code && name) return { code: name, name };
  if (!code && !name) return { code: 'UNKNOWN', name: clean || '未命名股票' };

  return { code, name };
}

/**
 * Parses binary Excel/CSV file content across ALL sheets into json records with detected headers.
 */
export function parseExcelFile(file: File): Promise<ExcelParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });

        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
          throw new Error('Excel 文件中未包含任何有效工作表 (Sheet)');
        }

        const sheetsData: ExcelSheetData[] = [];
        const allHeadersSet = new Set<string>();
        const allMergedRows: Record<string, any>[] = [];

        workbook.SheetNames.forEach(sheetName => {
          const worksheet = workbook.Sheets[sheetName];
          if (!worksheet) return;

          const json = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });
          if (!json || json.length === 0) return; // Skip empty sheets

          const sheetHeaders = Object.keys(json[0] || {});
          sheetHeaders.forEach(h => allHeadersSet.add(h));

          const derived = parseStockFromSheetName(sheetName);

          const annotatedRows = json.map(row => ({
            ...row,
            _sheetName: sheetName,
          }));

          sheetsData.push({
            sheetName,
            headers: sheetHeaders,
            rawRows: annotatedRows,
            derivedStockCode: derived.code,
            derivedStockName: derived.name,
          });

          allMergedRows.push(...annotatedRows);
        });

        if (allMergedRows.length === 0) {
          throw new Error('表格为空或所有工作表中没有发现有效数据');
        }

        const headers = Array.from(allHeadersSet);
        const suggestedMapping = autoDetectColumnMapping(headers);

        resolve({
          sheetCount: sheetsData.length,
          sheets: sheetsData,
          headers,
          rawRows: allMergedRows,
          suggestedMapping,
        });
      } catch (err: any) {
        reject(err.message || '解析 Excel 失败');
      }
    };
    reader.onerror = () => reject('文件读取失败');
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Converts raw parsed rows into clean TradeRecord objects.
 */
export function convertRowsToTrades(
  rawRows: Record<string, any>[],
  mapping: ExcelImportFieldMapping,
  userId: string
): Partial<TradeRecord>[] {
  const parsedTrades: TradeRecord[] = rawRows.map((row, idx) => {
    const getValue = (field: keyof ExcelImportFieldMapping) => {
      const colName = mapping[field];
      return colName && row[colName] !== undefined ? row[colName] : '';
    };

    const rawStockCode = String(getValue('stockCode')).trim();
    const rawStockName = String(getValue('stockName')).trim();

    let stockCode = rawStockCode;
    let stockName = rawStockName;

    // Smart fallback: If missing or generic, derive stock code/name from Sheet Name
    if (row._sheetName) {
      const derived = parseStockFromSheetName(row._sheetName);
      if (!stockCode || stockCode === 'UNKNOWN' || stockCode === '') {
        stockCode = derived.code || 'UNKNOWN';
      }
      if (!stockName || stockName === '未命名股票' || stockName === '') {
        stockName = derived.name || '未命名股票';
      }
    }

    if (!stockCode) stockCode = 'UNKNOWN';
    if (!stockName) stockName = '未命名股票';
    const account = String(getValue('account')).trim() || '主账户';
    const strategyName = String(getValue('strategyName')).trim() || '默认策略';
    
    const stratTypeRaw = String(getValue('strategyType')).trim();
    let strategyType: StrategyType = '自己';
    if (stratTypeRaw) {
      if (stratTypeRaw === 'self') strategyType = '自己';
      else if (stratTypeRaw === 'other') strategyType = '别人的策略';
      else strategyType = stratTypeRaw;
    }

    const tradeDate = normalizeTradeDate(getValue('tradeDate'));

    const orderTypeRaw = String(getValue('orderType')).trim();
    let orderType: OrderCategory = 'limit';
    if (orderTypeRaw.includes('网格')) orderType = 'grid';
    else if (orderTypeRaw.includes('市价')) orderType = 'market';
    else if (orderTypeRaw.includes('条件')) orderType = 'conditional';

    const rawQtyStr = String(getValue('quantity')).replace(/,/g, '').trim();
    const rawQuantity = parseFloat(rawQtyStr) || 0;
    const quantity = Math.abs(rawQuantity);

    const rawAmountStr = String(getValue('amount')).replace(/,/g, '').trim();
    const rawAmount = parseFloat(rawAmountStr) || 0;

    const rawPriceStr = String(getValue('price')).replace(/,/g, '').trim();
    let price = parseFloat(rawPriceStr) || 0;

    // Auto calculate price if missing or 0 but amount and quantity exist
    if ((!price || price === 0) && quantity > 0 && rawAmount !== 0) {
      price = Math.round((Math.abs(rawAmount) / quantity) * 10000) / 10000;
    }

    const rawFeeStr = String(getValue('fee')).replace(/,/g, '').trim();
    const fee = Math.abs(parseFloat(rawFeeStr) || 0);

    const actionRaw = String(getValue('tradeAction')).trim();
    const tradeAction = determineTradeAction(actionRaw, rawAmount, rawQuantity);

    const partialTrade: Partial<TradeRecord> = {
      id: `imported_${Date.now()}_${idx}`,
      userId,
      stockCode,
      stockName,
      account,
      strategyName,
      strategyType,
      tradeDate,
      orderType,
      tradeAction,
      fee,
      price,
      quantity,
      notes: String(getValue('notes')).trim(),
      createdAt: new Date().toISOString(),
    };

    return computeTradeDerivedFields(partialTrade) as TradeRecord;
  });

  // Re-run chronological calculation across all parsed records to ensure position cost, accumulated PnL, position PnL %, and amount are 100% computed
  return recalculateTradesChronologically(parsedTrades);
}

/**
 * Downloads current trade records as Excel .xlsx
 */
export function exportTradesToExcel(trades: TradeRecord[], filename = '股市对账单_交易明细.xlsx') {
  const exportData = trades.map(t => ({
    '股票代码': t.stockCode,
    '股票名称': t.stockName,
    '股票账户行': t.account,
    '策略名称': t.strategyName,
    '策略归属': t.strategyType === 'self' ? '自己策略' : '别人的策略',
    '成交日期': t.tradeDate,
    '委托类别': t.orderType === 'grid' ? '网格条件单' : t.orderType === 'market' ? '市价单' : t.orderType === 'conditional' ? '条件单' : '限价单',
    '买卖判断': t.tradeAction === 'dividend' ? '分红' : t.tradeAction === 'buy' ? '买入' : '卖出',
    '成交价格': Math.round(t.price * 1000) / 1000,
    '成交数量': t.quantity,
    '手续费(佣金)': Math.round(t.fee * 1000) / 1000,
    '发生金额': Math.round(t.amount * 1000) / 1000,
    '累计投入金额': Math.round(t.accumulatedCapital * 1000) / 1000,
    '累计持仓': t.accumulatedPosition,
    '持仓成本': Math.round(t.positionCost * 1000) / 1000,
    '涨跌比(%)': Math.round(t.gainLossRatio * 1000) / 1000,
    '持仓盈亏%(%)': Math.round((t.positionPnLPercent ?? t.gainLossRatio) * 1000) / 1000,
    '持仓盈亏': Math.round(t.positionPnL * 1000) / 1000,
    '累计盈亏': Math.round(t.accumulatedPnL * 1000) / 1000,
    '备注': t.notes || '',
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, '交易明细对账单');

  // Adjust column widths
  const max_cols = [10, 14, 12, 14, 12, 12, 12, 10, 10, 10, 10, 12, 14, 12, 10, 10, 12, 12, 20];
  worksheet['!cols'] = max_cols.map(w => ({ wch: w }));

  XLSX.writeFile(workbook, filename);
}

/**
 * Downloads standard Excel Import Template file
 */
export function downloadExcelTemplate() {
  const sampleData = [
    {
      '股票代码': '600519',
      '股票名称': '贵州茅台',
      '股票账户行': '华泰证券',
      '策略名称': '价值波段',
      '策略归属': '自己策略',
      '成交日期': '2026-03-15',
      '委托类别': '限价单',
      '买卖判断': '买入',
      '成交价格': 1650.00,
      '成交数量': 100,
      '手续费(佣金)': 15.00,
      '发生金额': 165015.00,
      '累计投入金额': 165015.00,
      '累计持仓': 100,
      '持仓成本': 1650.15,
      '涨跌比(%)': 0,
      '持仓盈亏%(%)': 0,
      '持仓盈亏': 0,
      '累计盈亏': -15.00,
      '备注': '建仓波段首笔',
    },
    {
      '股票代码': '000001',
      '股票名称': '平安银行',
      '股票账户行': '招商证券',
      '策略名称': '网格交易',
      '策略归属': '自己策略',
      '成交日期': '2026-03-18',
      '委托类别': '网格条件单',
      '买卖判断': '买入',
      '成交价格': 11.20,
      '成交数量': 2000,
      '手续费(佣金)': 5.00,
      '发生金额': 22405.00,
      '累计投入金额': 22405.00,
      '累计持仓': 2000,
      '持仓成本': 11.2025,
      '涨跌比(%)': 0,
      '持仓盈亏%(%)': 0,
      '持仓盈亏': 0,
      '累计盈亏': -5.00,
      '备注': '网格触发档位1买入',
    }
  ];

  const worksheet = XLSX.utils.json_to_sheet(sampleData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, '交易对账单模板');

  XLSX.writeFile(workbook, '股市交易对账单导入模板.xlsx');
}
