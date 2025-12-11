export type ReportType = 'balance-sheet' | 'income-statement' | 'cash-flow';

export interface ReportFilter {
  startDate: string;
  endDate: string;
  accountTypes?: string[];
  includeInactive?: boolean;
}

export interface BalanceSheetData {
  assets: {
    currentAssets: ReportLineItem[];
    nonCurrentAssets: ReportLineItem[];
    totalAssets: number;
  };
  liabilities: {
    currentLiabilities: ReportLineItem[];
    nonCurrentLiabilities: ReportLineItem[];
    totalLiabilities: number;
  };
  equity: {
    items: ReportLineItem[];
    totalEquity: number;
  };
  totalLiabilitiesAndEquity: number;
}

export interface IncomeStatementData {
  revenue: {
    items: ReportLineItem[];
    totalRevenue: number;
  };
  expenses: {
    items: ReportLineItem[];
    totalExpenses: number;
  };
  netIncome: number;
}

export interface CashFlowData {
  operatingActivities: {
    items: ReportLineItem[];
    netCashFromOperating: number;
  };
  investingActivities: {
    items: ReportLineItem[];
    netCashFromInvesting: number;
  };
  financingActivities: {
    items: ReportLineItem[];
    netCashFromFinancing: number;
  };
  netCashFlow: number;
  beginningCash: number;
  endingCash: number;
}

export interface ReportLineItem {
  accountCode: string;
  accountName: string;
  amount: number;
  percentage?: number;
  children?: ReportLineItem[];
}

export interface ReportData {
  type: ReportType;
  title: string;
  period: {
    startDate: string;
    endDate: string;
  };
  generatedAt: string;
  data: BalanceSheetData | IncomeStatementData | CashFlowData;
}

export interface ReportExportOptions {
  format: 'pdf' | 'excel' | 'csv';
  includeDetails: boolean;
  includeComparison?: boolean;
  comparisonPeriod?: {
    startDate: string;
    endDate: string;
  };
}