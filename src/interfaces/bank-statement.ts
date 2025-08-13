export interface BankStatement {
  id: string;
  userId?: string; // Make optional for no-auth mode
  fileName: string;
  fileSize: number;
  fileType: 'pdf' | 'csv' | 'xlsx' | 'xls';
  bankName?: string;
  accountNumber?: string;
  statementPeriod?: {
    startDate: Date;
    endDate: Date;
  };
  status: 'processing' | 'completed' | 'failed';
  filePath: string;
  extractedData?: ExtractedTransaction[];
  analysisResult?: StatementAnalysisResult;
  errorMessage?: string;
  processingTime?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface StatementTransaction {
  id: string;
  statementId: string;
  date: Date;
  description: string;
  amount: number;
  type: 'debit' | 'credit';
  balance?: number;
  reference?: string;
  category?: string;
  merchant?: string;
  confidence?: number;
  rawData?: any;
  isReconciled: boolean;
  reconciledWithId?: string;
  createdAt: Date;
}

export interface ExtractedTransaction {
  date: Date;
  description: string;
  amount: number;
  type: 'debit' | 'credit';
  balance?: number;
  reference?: string;
  rawData?: any;
}

export interface StatementAnalysisResult {
  summary: {
    totalTransactions: number;
    totalIncome: number;
    totalExpenses: number;
    netCashFlow: number;
    averageBalance: number;
    statementPeriod: {
      startDate: Date;
      endDate: Date;
    };
  };
  categories: {
    name: string;
    amount: number;
    percentage: number;
    transactionCount: number;
  }[];
  topMerchants: {
    name: string;
    amount: number;
    transactionCount: number;
  }[];
  monthlyBreakdown: {
    month: string;
    income: number;
    expenses: number;
    netFlow: number;
  }[];
  insights: string[];
  patterns: {
    recurringPayments: {
      merchant: string;
      amount: number;
      frequency: string;
      lastDate: Date;
    }[];
    unusualTransactions: {
      date: Date;
      description: string;
      amount: number;
      reason: string;
    }[];
    spendingTrends: {
      category: string;
      trend: 'increasing' | 'decreasing' | 'stable';
      percentage: number;
    }[];
  };
}

export interface UploadStatementRequest {
  userId?: string; // Make optional for no-auth mode
  file: any; // Multer file object
  bankName?: string;
  accountNumber?: string;
}

export interface StatementAnalysisRequest {
  statementId: string;
  userId?: string; // Make optional for no-auth mode
}

export interface StatementAnalysisResponse {
  statementId: string;
  status: 'processing' | 'completed' | 'failed';
  analysisResult?: StatementAnalysisResult;
  errorMessage?: string;
  processingTime?: number;
}

export interface StatementSummary {
  totalTransactions: number;
  totalIncome: number;
  totalExpenses: number;
  netCashFlow: number;
  averageTransactionAmount: number;
  largestTransaction: number;
  smallestTransaction: number;
  categoryBreakdown: Record<string, number>;
  monthlyTrends?: MonthlyTrend[];
}

export interface MonthlyTrend {
  month: string;
  income: number;
  expenses: number;
  netCashFlow: number;
  transactionCount: number;
}

// Bank-specific formats
export interface BankStatementParser {
  bankName: string;
  supportedFormats: string[];
  parse(fileBuffer: Buffer, fileType: string): Promise<ExtractedTransaction[]>;
  detectBankName?(content: string): boolean;
}

// Common bank statement formats
export interface GenericCSVTransaction {
  date: string;
  description: string;
  amount: string;
  type?: string;
  balance?: string;
  reference?: string;
}

export interface GTBankCSVTransaction {
  'Transaction Date': string;
  'Value Date': string;
  'Narration': string;
  'Debit': string;
  'Credit': string;
  'Balance': string;
  'Reference': string;
}

export interface AccessBankCSVTransaction {
  'Date': string;
  'Description': string;
  'Amount': string;
  'Type': string;
  'Balance': string;
  'Reference': string;
}

export interface FirstBankCSVTransaction {
  'TRANS DATE': string;
  'DESCRIPTION': string;
  'DEBIT': string;
  'CREDIT': string;
  'BALANCE': string;
  'REFERENCE': string;
}
