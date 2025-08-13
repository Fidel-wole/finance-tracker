import { db } from "../utils/db/db";
import {
  BankStatement,
  StatementTransaction,
  StatementSummary,
  ExtractedTransaction,
} from "../interfaces/bank-statement";

export class BankStatementRepository {
  async createStatement(data: {
    userId?: string; // Make optional
    fileName: string;
    fileSize: number;
    fileType: string;
    filePath: string;
    bankName?: string;
    accountNumber?: string;
    status: string;
  }): Promise<BankStatement> {
    const statement = await db.bankStatement.create({
      data: {
        userId: data.userId,
        fileName: data.fileName,
        fileSize: data.fileSize,
        fileType: data.fileType,
        filePath: data.filePath,
        bankName: data.bankName,
        accountNumber: data.accountNumber,
        status: data.status
      }
    });

    return this.mapPrismaToInterface(statement);
  }

  async updateStatement(
    id: string, 
    data: {
      status?: string;
      extractedData?: any;
      analysisResult?: any;
      statementPeriod?: any;
      bankName?: string;
      accountNumber?: string;
      errorMessage?: string;
      processingTime?: number;
    }
  ): Promise<BankStatement | null> {
    try {
      // First check if the record exists
      const existingStatement = await db.bankStatement.findUnique({
        where: { id }
      });

      if (!existingStatement) {
        console.warn(`Statement with id ${id} not found for update`);
        return null;
      }

      const statement = await db.bankStatement.update({
        where: { id },
        data: {
          status: data.status,
          extractedData: data.extractedData,
          analysisResult: data.analysisResult,
          statementPeriod: data.statementPeriod,
          bankName: data.bankName,
          accountNumber: data.accountNumber,
          errorMessage: data.errorMessage,
          processingTime: data.processingTime,
          updatedAt: new Date()
        }
      });

      return this.mapPrismaToInterface(statement);
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'P2025') {
        // Record not found for update
        console.warn(`Statement with id ${id} was deleted during processing`);
        return null;
      }
      throw error;
    }
  }

  async getStatement(id: string): Promise<BankStatement | null> {
    const statement = await db.bankStatement.findUnique({
      where: { id },
      include: {
        transactions: true
      }
    });

    if (!statement) return null;
    return this.mapPrismaToInterface(statement);
  }

  async getUserStatements(userId: string): Promise<BankStatement[]> {
    const statements = await db.bankStatement.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    
    return statements.map((statement: any) => this.mapPrismaToInterface(statement));
  }

  async saveExtractedTransactions(statementId: string, transactions: ExtractedTransaction[]): Promise<void> {
    const transactionData = transactions.map(tx => ({
      statementId,
      date: tx.date,
      description: tx.description,
      amount: tx.amount,
      type: tx.type,
      balance: tx.balance,
      reference: tx.reference,
      rawData: tx.rawData,
      isReconciled: false
    }));

    await db.statementTransaction.createMany({
      data: transactionData
    });
  }

  async getStatementTransactions(statementId: string): Promise<StatementTransaction[]> {
    const transactions = await db.statementTransaction.findMany({
      where: { statementId },
      orderBy: { date: 'desc' }
    });

    return transactions.map((tx: any) => this.mapPrismaTransactionToInterface(tx));
  }

  async deleteStatement(id: string): Promise<void> {
    // Delete associated transactions first
    await db.statementTransaction.deleteMany({
      where: { statementId: id }
    });
    // Delete the statement
    await db.bankStatement.delete({
      where: { id }
    });
  }

  async getStatementsByStatus(status: string): Promise<BankStatement[]> {
    const statements = await db.bankStatement.findMany({
      where: { status },
      orderBy: { createdAt: 'asc' }
    });

    return statements.map((statement: any) => this.mapPrismaToInterface(statement));
  }

  async updateTransactionCategory(
    transactionId: string, 
    category: string, 
    merchant?: string, 
    confidence?: number
  ): Promise<void> {
    await db.statementTransaction.update({
      where: { id: transactionId },
      data: {
        category,
        merchant,
        confidence
      }
    });
  }

  async markTransactionReconciled(transactionId: string, reconciledWithId: string): Promise<void> {
    await db.statementTransaction.update({
      where: { id: transactionId },
      data: {
        isReconciled: true,
        reconciledWithId
      }
    });
  }

  async getStatementSummary(statementId: string): Promise<StatementSummary> {
    const transactions = await db.statementTransaction.findMany({
      where: { statementId }
    });

    const totalTransactions = transactions.length;
    const totalIncome = transactions
      .filter(t => t.type === 'credit')
      .reduce((sum, t) => sum + Number(t.amount), 0);
    
    const totalExpenses = transactions
      .filter(t => t.type === 'debit')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const netCashFlow = totalIncome - totalExpenses;
    const averageTransactionAmount = totalTransactions > 0 ? 
      (totalIncome + totalExpenses) / totalTransactions : 0;

    const amounts = transactions.map(t => Number(t.amount));
    const largestTransaction = amounts.length > 0 ? Math.max(...amounts) : 0;
    const smallestTransaction = amounts.length > 0 ? Math.min(...amounts) : 0;

    // Category breakdown
    const categoryBreakdown: Record<string, number> = {};
    transactions.forEach(t => {
      if (t.category) {
        categoryBreakdown[t.category] = (categoryBreakdown[t.category] || 0) + Number(t.amount);
      }
    });

    return {
      totalTransactions,
      totalIncome,
      totalExpenses,
      netCashFlow,
      averageTransactionAmount,
      largestTransaction,
      smallestTransaction,
      categoryBreakdown
    };
  }

  private mapPrismaToInterface(prismaStatement: any): BankStatement {
    return {
      id: prismaStatement.id,
      userId: prismaStatement.userId,
      fileName: prismaStatement.fileName,
      fileSize: prismaStatement.fileSize,
      fileType: prismaStatement.fileType as 'pdf' | 'csv' | 'xlsx' | 'xls',
      bankName: prismaStatement.bankName,
      accountNumber: prismaStatement.accountNumber,
      statementPeriod: prismaStatement.statementPeriod ? {
        startDate: new Date(prismaStatement.statementPeriod.startDate),
        endDate: new Date(prismaStatement.statementPeriod.endDate)
      } : undefined,
      status: prismaStatement.status as 'processing' | 'completed' | 'failed',
      filePath: prismaStatement.filePath,
      extractedData: prismaStatement.extractedData,
      analysisResult: prismaStatement.analysisResult,
      errorMessage: prismaStatement.errorMessage,
      processingTime: prismaStatement.processingTime,
      createdAt: prismaStatement.createdAt,
      updatedAt: prismaStatement.updatedAt
    };
  }

  private mapPrismaTransactionToInterface(prismaTransaction: any): StatementTransaction {
    return {
      id: prismaTransaction.id,
      statementId: prismaTransaction.statementId,
      date: prismaTransaction.date,
      description: prismaTransaction.description,
      amount: Number(prismaTransaction.amount),
      type: prismaTransaction.type as 'debit' | 'credit',
      balance: prismaTransaction.balance ? Number(prismaTransaction.balance) : undefined,
      reference: prismaTransaction.reference,
      category: prismaTransaction.category,
      merchant: prismaTransaction.merchant,
      confidence: prismaTransaction.confidence,
      rawData: prismaTransaction.rawData,
      isReconciled: prismaTransaction.isReconciled,
      reconciledWithId: prismaTransaction.reconciledWithId,
      createdAt: prismaTransaction.createdAt
    };
  }
}
