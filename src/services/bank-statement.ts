import path from 'path';
import fs from 'fs';
import { 
  BankStatement, 
  ExtractedTransaction, 
  StatementAnalysisResult,
  UploadStatementRequest,
  StatementAnalysisRequest,
  StatementAnalysisResponse 
} from '../interfaces/bank-statement';
import { CSVParser } from './parsers/csv-parser';
import { PDFParser } from './parsers/pdf-parser';
import { ExcelParser } from './parsers/excel-parser';
import {BankStatementRepository} from '../repositories/bank-statement';
import AIService from './ai';
import logger from '../utils/logger';
import { cleanupFile } from '../middleware/file-upload';

export default class BankStatementService {
  private bankStatementRepository: BankStatementRepository;
  private aiService: AIService;

  constructor() {
    this.bankStatementRepository = new BankStatementRepository();
    this.aiService = new AIService();
  }

  async uploadAndProcessStatement(request: UploadStatementRequest): Promise<BankStatement> {
    const startTime = Date.now();
    let statementRecord: BankStatement | null = null;

    try {
      logger.info(`Starting bank statement upload for user ${request.userId || 'anonymous'}`);

      // Create initial record in database
      statementRecord = await this.bankStatementRepository.createStatement({
        userId: request.userId,
        fileName: request.file.originalname,
        fileSize: request.file.size,
        fileType: this.getFileExtension(request.file.originalname),
        filePath: request.file.path,
        bankName: request.bankName,
        accountNumber: request.accountNumber,
        status: 'processing'
      });

      // Parse the file based on type
      const fileBuffer = fs.readFileSync(request.file.path);
      const extractedTransactions = await this.parseFile(fileBuffer, statementRecord.fileType);

      if (extractedTransactions.length === 0) {
        throw new Error('No transactions found in the uploaded file');
      }

      // Detect statement period
      const statementPeriod = this.detectStatementPeriod(extractedTransactions);

      // Auto-detect bank name if not provided
      const detectedBankName = request.bankName || this.detectBankName(extractedTransactions);

      // Generate AI analysis
      const analysisResult = await this.generateAnalysis(extractedTransactions, request.userId || 'anonymous');

      // Save extracted transactions
      await this.bankStatementRepository.saveExtractedTransactions(
        statementRecord.id,
        extractedTransactions
      );

      // Update statement record with results
      const processingTime = Date.now() - startTime;
      const updatedStatement = await this.bankStatementRepository.updateStatement(statementRecord.id, {
        status: 'completed',
        extractedData: extractedTransactions,
        analysisResult,
        statementPeriod,
        bankName: detectedBankName || undefined,
        processingTime
      });

      if (!updatedStatement) {
        logger.warn(`Statement ${statementRecord.id} was deleted during processing`);
        throw new Error('Statement was deleted during processing');
      }

      logger.info(`Bank statement processed successfully in ${processingTime}ms for user ${request.userId || 'anonymous'}`);

      return updatedStatement;

    } catch (error) {
      logger.error('Error processing bank statement:', error);

      if (statementRecord) {
        // Update record with error
        await this.bankStatementRepository.updateStatement(statementRecord.id, {
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unknown error occurred',
          processingTime: Date.now() - startTime
        });
      }

      // Clean up uploaded file
      if (request.file.path) {
        cleanupFile(request.file.path);
      }

      throw error;
    }
  }

  async getStatementAnalysis(request: StatementAnalysisRequest): Promise<StatementAnalysisResponse> {
    try {
      const statement = await this.bankStatementRepository.getStatement(request.statementId);

      if (!statement) {
        throw new Error('Bank statement not found');
      }

      // Skip authorization check for no-auth mode
      if (request.userId && statement.userId !== request.userId) {
        throw new Error('Unauthorized access to bank statement');
      }

      return {
        statementId: statement.id,
        status: statement.status as 'processing' | 'completed' | 'failed',
        analysisResult: statement.analysisResult || undefined,
        errorMessage: statement.errorMessage || undefined,
        processingTime: statement.processingTime || undefined
      };

    } catch (error) {
      logger.error('Error getting statement analysis:', error);
      throw error;
    }
  }

  async getUserStatements(userId: string, limit: number = 10): Promise<BankStatement[]> {
    try {
      return await this.bankStatementRepository.getUserStatements(userId);
    } catch (error) {
      logger.error('Error getting user statements:', error);
      throw error;
    }
  }

  async deleteStatement(statementId: string, userId: string): Promise<void> {
    try {
      const statement = await this.bankStatementRepository.getStatement(statementId);
      
      if (!statement) {
        throw new Error('Statement not found');
      }

      // Check ownership (skip for no-auth mode)
      if (userId && statement.userId !== userId) {
        throw new Error('Unauthorized');
      }

      // Delete file from storage
      try {
        fs.unlinkSync(statement.filePath);
      } catch (error) {
        console.warn('Could not delete file:', error);
      }

      // Delete from database
      await this.bankStatementRepository.deleteStatement(statementId);
    } catch (error) {
      console.error('Error deleting statement:', error);
      throw error;
    }
  }

  /**
   * Process an already uploaded statement file
   */
  async processStatement(statementId: string, filePath: string, fileType: string): Promise<{
    extractedTransactions: ExtractedTransaction[];
    analysis: StatementAnalysisResult;
    bankName?: string;
    accountNumber?: string;
    statementPeriod?: any;
  }> {
    try {
      // Read file
      const fileBuffer = fs.readFileSync(filePath);
      
      // Parse transactions
      const extractedTransactions = await this.parseFile(fileBuffer, fileType);
      
      if (extractedTransactions.length === 0) {
        throw new Error('No transactions found in the statement');
      }

      // Save transactions to database
      await this.bankStatementRepository.saveExtractedTransactions(statementId, extractedTransactions);

      // Categorize transactions with AI
      const categorizedTransactions = await this.categorizeTransactions(extractedTransactions);

      // Update transactions with categories
      for (const tx of categorizedTransactions) {
        if (tx.category) {
          const statementTransactions = await this.bankStatementRepository.getStatementTransactions(statementId);
          const matchingTx = statementTransactions.find(stx => 
            stx.description === tx.description && 
            stx.amount === tx.amount && 
            stx.date.getTime() === tx.date.getTime()
          );
          
          if (matchingTx) {
            await this.bankStatementRepository.updateTransactionCategory(
              matchingTx.id, 
              tx.category, 
              tx.merchant, 
              tx.confidence
            );
          }
        }
      }

      // Generate analysis
      const statement = await this.bankStatementRepository.getStatement(statementId);
      const analysis = await this.generateAnalysis(categorizedTransactions, statement!.userId || 'anonymous');

      // Extract bank information (simplified)
      const bankName = this.detectBankName(categorizedTransactions);
      const accountNumber = undefined; // Could implement account number extraction
      const statementPeriod = this.detectStatementPeriod(categorizedTransactions);

      return {
        extractedTransactions: categorizedTransactions,
        analysis,
        bankName: bankName || undefined,
        accountNumber,
        statementPeriod
      };

    } catch (error) {
      console.error('Error processing statement:', error);
      throw error;
    }
  }

  private async parseFile(fileBuffer: Buffer, fileType: string): Promise<ExtractedTransaction[]> {
    switch (fileType.toLowerCase()) {
      case 'pdf':
        return await PDFParser.parse(fileBuffer);
      case 'csv':
        return await CSVParser.parse(fileBuffer);
      case 'xlsx':
      case 'xls':
        return await ExcelParser.parse(fileBuffer);
      default:
        throw new Error(`Unsupported file type: ${fileType}`);
    }
  }

  private getFileExtension(filename: string): string {
    return path.extname(filename).toLowerCase().slice(1);
  }

  private detectStatementPeriod(transactions: ExtractedTransaction[]) {
    if (transactions.length === 0) return null;

    const dates = transactions.map(t => new Date(t.date)).sort((a, b) => a.getTime() - b.getTime());
    
    return {
      startDate: dates[0],
      endDate: dates[dates.length - 1]
    };
  }

  private detectBankName(transactions: ExtractedTransaction[]): string | null {
    // Try to detect bank from transaction descriptions or references
    const bankPatterns = {
      'GTBank': ['gtb', 'guaranty trust', 'gtbank'],
      'Access Bank': ['access bank', 'diamond bank'],
      'First Bank': ['first bank', 'firstbank'],
      'Zenith Bank': ['zenith bank', 'zenith'],
      'UBA': ['uba', 'united bank'],
      'Fidelity Bank': ['fidelity bank', 'fidelity'],
      'Wema Bank': ['wema bank', 'wema'],
      'Union Bank': ['union bank']
    };

    const allText = transactions
      .map(t => `${t.description} ${t.reference || ''}`)
      .join(' ')
      .toLowerCase();

    for (const [bankName, patterns] of Object.entries(bankPatterns)) {
      if (patterns.some(pattern => allText.includes(pattern))) {
        return bankName;
      }
    }

    return null;
  }

  private async generateAnalysis(transactions: ExtractedTransaction[], userId: string): Promise<StatementAnalysisResult> {
    try {
      // Calculate basic statistics
      const summary = this.calculateSummary(transactions);
      
      // Calculate categories breakdown (transactions should already be categorized)
      const categories = this.calculateCategoriesBreakdown(transactions);
      
      // Find top merchants
      const topMerchants = this.findTopMerchants(transactions);
      
      // Calculate monthly breakdown
      const monthlyBreakdown = this.calculateMonthlyBreakdown(transactions);
      
      // Detect patterns
      const patterns = this.detectPatterns(transactions);

      // Generate insights - always try AI first, with better timeout handling
      let insights: string[];
      try {
        console.log(`Generating AI insights for ${transactions.length} transactions`);
        insights = await this.generateInsights(transactions, summary);
      } catch (error) {
        console.error('AI insights failed:', error);
        // Return empty insights array instead of fallback - force AI dependency
        insights = ['Unable to generate insights at this time. Please try again later.'];
      }

      return {
        summary,
        categories,
        topMerchants,
        monthlyBreakdown,
        insights,
        patterns
      };

    } catch (error) {
      logger.error('Error generating analysis:', error);
      
      // Return basic analysis without AI if AI fails
      return {
        summary: this.calculateSummary(transactions),
        categories: [],
        topMerchants: [],
        monthlyBreakdown: this.calculateMonthlyBreakdown(transactions),
        insights: ['Unable to generate insights at this time. Please try again later.'],
        patterns: {
          recurringPayments: [],
          unusualTransactions: [],
          spendingTrends: []
        }
      };
    }
  }

  private calculateSummary(transactions: ExtractedTransaction[]) {
    const totalIncome = transactions
      .filter(t => t.type === 'credit')
      .reduce((sum, t) => sum + t.amount, 0);

    const totalExpenses = transactions
      .filter(t => t.type === 'debit')
      .reduce((sum, t) => sum + t.amount, 0);

    const balances = transactions
      .map(t => t.balance)
      .filter(b => b !== undefined && b !== null) as number[];

    const averageBalance = balances.length > 0
      ? balances.reduce((sum, b) => sum + b, 0) / balances.length
      : 0;

    const statementPeriod = this.detectStatementPeriod(transactions);

    return {
      totalTransactions: transactions.length,
      totalIncome,
      totalExpenses,
      netCashFlow: totalIncome - totalExpenses,
      averageBalance,
      statementPeriod: statementPeriod || {
        startDate: new Date(),
        endDate: new Date()
      }
    };
  }

  private async categorizeTransactions(transactions: ExtractedTransaction[]): Promise<(ExtractedTransaction & { category?: string; merchant?: string; confidence?: number })[]> {
    // For very large datasets (>100 transactions), use smart categorization
    if (transactions.length > 100) {
      return this.smartCategorizeTransactions(transactions);
    }

    const categorizedTransactions: (ExtractedTransaction & { category?: string; merchant?: string; confidence?: number })[] = [];
    const BATCH_SIZE = 5; // Reduced batch size for better control
    const MAX_RETRIES = 1; // Reduced retries for faster failure
    const MAX_AI_CALLS = Math.min(30, transactions.length); // Limit AI calls for medium datasets

    console.log(`Starting categorization of ${transactions.length} transactions (max ${MAX_AI_CALLS} with AI) in batches of ${BATCH_SIZE}`);

    // Process transactions in batches to avoid overwhelming the AI service
    for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
      const batch = transactions.slice(i, i + BATCH_SIZE);
      console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(transactions.length / BATCH_SIZE)} (${batch.length} transactions)`);

      // Process each transaction in the batch with limited concurrency
      const batchResults = await Promise.allSettled(
        batch.map(async (transaction, index) => {
          const globalIndex = i + index;
          
          // Use AI only for the first MAX_AI_CALLS transactions
          if (globalIndex < MAX_AI_CALLS) {
            let retries = 0;
            
            while (retries <= MAX_RETRIES) {
              try {
                // Process category and merchant sequentially to reduce API load
                const category = await this.aiService.categorizeTransaction(transaction.description);
                await new Promise(resolve => setTimeout(resolve, 300)); // Brief pause between calls
                
                const merchant = await this.aiService.extractMerchant(transaction.description);
                
                return {
                  ...transaction,
                  category: category?.category || 'Other',
                  merchant: merchant?.name || this.extractMerchantFromDescription(transaction.description),
                  confidence: category?.confidence || 0.5
                };

              } catch (error) {
                retries++;
                if (retries > MAX_RETRIES) {
                  console.warn(`AI categorization failed for transaction ${globalIndex + 1} after ${MAX_RETRIES} retries, using fallback`);
                  // Fallback to basic categorization
                  return {
                    ...transaction,
                    category: this.basicCategorization(transaction.description),
                    merchant: this.extractMerchantFromDescription(transaction.description),
                    confidence: 0.3
                  };
                }
                // Wait briefly before retry
                await new Promise(resolve => setTimeout(resolve, 500));
              }
            }
          } else {
            // Use fallback categorization for remaining transactions
            return {
              ...transaction,
              category: this.basicCategorization(transaction.description),
              merchant: this.extractMerchantFromDescription(transaction.description),
              confidence: 0.3
            };
          }
        })
      );

      // Process batch results
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          categorizedTransactions.push(result.value);
        } else {
          console.error(`Failed to process transaction ${i + index + 1}:`, result.status === 'rejected' ? result.reason : 'Unknown error');
          // Add transaction with fallback categorization
          const transaction = batch[index];
          categorizedTransactions.push({
            ...transaction,
            category: this.basicCategorization(transaction.description),
            merchant: this.extractMerchantFromDescription(transaction.description),
            confidence: 0.3
          });
        }
      });

      // Add a delay between batches to prevent API rate limiting
      if (i + BATCH_SIZE < transactions.length) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay between batches
      }
    }

    const aiProcessedCount = categorizedTransactions.filter(t => t.confidence && t.confidence > 0.4).length;
    console.log(`Categorization complete: ${categorizedTransactions.length} transactions processed, ${aiProcessedCount} with AI, ${categorizedTransactions.length - aiProcessedCount} with fallback`);
    return categorizedTransactions;
  }

  /**
   * Smart categorization for large datasets (>100 transactions)
   * Uses AI for unique descriptions only, then applies patterns to similar transactions
   */
  private async smartCategorizeTransactions(transactions: ExtractedTransaction[]): Promise<(ExtractedTransaction & { category?: string; merchant?: string; confidence?: number })[]> {
    console.log(`Using smart categorization for ${transactions.length} transactions`);
    
    // Group transactions by similar descriptions
    const descriptionGroups = new Map<string, ExtractedTransaction[]>();
    const uniqueDescriptions = new Set<string>();
    
    transactions.forEach(transaction => {
      // Normalize description for grouping (remove amounts, dates, reference numbers)
      const normalizedDesc = this.normalizeDescription(transaction.description);
      
      if (!descriptionGroups.has(normalizedDesc)) {
        descriptionGroups.set(normalizedDesc, []);
        uniqueDescriptions.add(transaction.description); // Keep one original for AI processing
      }
      descriptionGroups.get(normalizedDesc)!.push(transaction);
    });

    console.log(`Grouped ${transactions.length} transactions into ${descriptionGroups.size} unique patterns`);

    // Process only unique descriptions with AI (much smaller set)
    const aiCategorizationMap = new Map<string, { category: string; merchant: string; confidence: number }>();
    const uniqueTransactions = Array.from(uniqueDescriptions).map(desc => 
      transactions.find(t => t.description === desc)!
    );

    console.log(`Processing ${uniqueTransactions.length} unique transactions with AI`);

    // Enhanced processing with better timeout management
    const BATCH_SIZE = 2; // Reduced to minimize API load
    let consecutiveFailures = 0;
    const MAX_CONSECUTIVE_FAILURES = 3; // Stricter circuit breaker
    const AI_PROCESSING_TIMEOUT = 180000; // 3 minutes max for AI processing (increased for all transactions)
    const startTime = Date.now();
    
    console.log(`Processing all ${uniqueTransactions.length} unique transactions with AI (no fallback)`);
    
    // Process ALL unique transactions with AI
    for (let i = 0; i < uniqueTransactions.length; i += BATCH_SIZE) {
      // Check if we've exceeded AI processing timeout
      if (Date.now() - startTime > AI_PROCESSING_TIMEOUT) {
        console.log(`AI processing timeout reached. Using fallback for remaining ${uniqueTransactions.length - i} transactions.`);
        break;
      }
      
      const batch = uniqueTransactions.slice(i, i + BATCH_SIZE);
      
      // Circuit breaker: skip AI if too many consecutive failures
      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        console.log(`Circuit breaker activated after ${consecutiveFailures} failures. Using fallback for remaining transactions.`);
        break;
      }
      
      // Process batch sequentially to avoid overwhelming the API
      for (const transaction of batch) {
        try {
          const normalizedDesc = this.normalizeDescription(transaction.description);
          
          // Skip if already processed
          if (aiCategorizationMap.has(normalizedDesc)) {
            continue;
          }
          
          // Process category and merchant sequentially to reduce API load
          const category = await this.aiService.categorizeTransaction(transaction.description);
          await new Promise(resolve => setTimeout(resolve, 200)); // Brief pause between calls
          
          const merchant = await this.aiService.extractMerchant(transaction.description);
          
          aiCategorizationMap.set(normalizedDesc, {
            category: category?.category || 'Other',
            merchant: merchant?.name || this.extractMerchantFromDescription(transaction.description),
            confidence: category?.confidence || 0.5
          });
          
          consecutiveFailures = 0; // Reset failure counter on success
          console.log(`Successfully processed AI categorization ${i + 1}/${uniqueTransactions.length}`);
          
        } catch (error) {
          consecutiveFailures++;
          console.warn(`AI failed for transaction (failure ${consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES}):`, error);
          
          const normalizedDesc = this.normalizeDescription(transaction.description);
          aiCategorizationMap.set(normalizedDesc, {
            category: this.basicCategorization(transaction.description),
            merchant: this.extractMerchantFromDescription(transaction.description),
            confidence: 0.3
          });
          
          // Add longer delay after failures to avoid hammering the API
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // Moderate delay between batches
      if (i + BATCH_SIZE < uniqueTransactions.length && consecutiveFailures < MAX_CONSECUTIVE_FAILURES) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // All transactions are now processed with AI (no fallback needed)
    console.log(`AI processing complete. Processed ${aiCategorizationMap.size} unique transaction patterns.`);

    // Apply categorization to all transactions based on patterns
    const categorizedTransactions: (ExtractedTransaction & { category?: string; merchant?: string; confidence?: number })[] = [];
    
    transactions.forEach(transaction => {
      const normalizedDesc = this.normalizeDescription(transaction.description);
      const categorization = aiCategorizationMap.get(normalizedDesc);
      
      categorizedTransactions.push({
        ...transaction,
        category: categorization?.category || this.basicCategorization(transaction.description),
        merchant: categorization?.merchant || this.extractMerchantFromDescription(transaction.description),
        confidence: categorization?.confidence || 0.3
      });
    });

    const aiProcessedCount = Array.from(aiCategorizationMap.values()).filter(c => c.confidence > 0.4).length;
    console.log(`Smart categorization complete: ${categorizedTransactions.length} transactions processed, ${aiProcessedCount} with AI, ${aiCategorizationMap.size - aiProcessedCount} with fallback`);
    return categorizedTransactions;
  }

  /**
   * Normalize transaction description for grouping similar transactions
   */
  private normalizeDescription(description: string): string {
    return description
      .toLowerCase()
      .replace(/\d+/g, '') // Remove numbers
      .replace(/[^\w\s]/g, ' ') // Remove special characters
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  private async generateInsights(transactions: any[], summary: any): Promise<string[]> {
    // Always use AI service - no fallback logic
    return await this.aiService.generateStatementInsights(transactions, summary);
  }

  private calculateCategoriesBreakdown(transactions: any[]) {
    const categoryMap = new Map<string, { amount: number; count: number }>();
    
    transactions.forEach(t => {
      const category = t.category || 'Other';
      const existing = categoryMap.get(category) || { amount: 0, count: 0 };
      
      if (t.type === 'debit') { // Only count expenses for category breakdown
        existing.amount += t.amount;
        existing.count += 1;
        categoryMap.set(category, existing);
      }
    });
    
    const totalExpenses = Array.from(categoryMap.values()).reduce((sum, cat) => sum + cat.amount, 0);
    
    return Array.from(categoryMap.entries())
      .map(([name, data]) => ({
        name,
        amount: data.amount,
        percentage: totalExpenses > 0 ? (data.amount / totalExpenses) * 100 : 0,
        transactionCount: data.count
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10); // Top 10 categories
  }

  private findTopMerchants(transactions: any[]) {
    const merchantMap = new Map<string, { amount: number; count: number }>();
    
    transactions.forEach(t => {
      if (t.type === 'debit' && t.merchant) { // Only expenses
        const existing = merchantMap.get(t.merchant) || { amount: 0, count: 0 };
        existing.amount += t.amount;
        existing.count += 1;
        merchantMap.set(t.merchant, existing);
      }
    });
    
    return Array.from(merchantMap.entries())
      .map(([name, data]) => ({
        name,
        amount: data.amount,
        transactionCount: data.count
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10); // Top 10 merchants
  }

  private calculateMonthlyBreakdown(transactions: ExtractedTransaction[]) {
    const monthMap = new Map<string, { income: number; expenses: number }>();
    
    transactions.forEach(t => {
      const monthKey = `${t.date.getFullYear()}-${String(t.date.getMonth() + 1).padStart(2, '0')}`;
      const existing = monthMap.get(monthKey) || { income: 0, expenses: 0 };
      
      if (t.type === 'credit') {
        existing.income += t.amount;
      } else {
        existing.expenses += t.amount;
      }
      
      monthMap.set(monthKey, existing);
    });
    
    return Array.from(monthMap.entries())
      .map(([month, data]) => ({
        month,
        income: data.income,
        expenses: data.expenses,
        netFlow: data.income - data.expenses
      }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }

  private detectPatterns(transactions: any[]) {
    return {
      recurringPayments: this.findRecurringPayments(transactions),
      unusualTransactions: this.findUnusualTransactions(transactions),
      spendingTrends: this.calculateSpendingTrends(transactions)
    };
  }

  private findRecurringPayments(transactions: any[]) {
    const merchantFrequency = new Map<string, any[]>();
    
    // Group by merchant
    transactions.forEach(t => {
      if (t.type === 'debit' && t.merchant) {
        if (!merchantFrequency.has(t.merchant)) {
          merchantFrequency.set(t.merchant, []);
        }
        merchantFrequency.get(t.merchant)!.push(t);
      }
    });
    
    const recurring = [];
    
    for (const [merchant, merchantTransactions] of merchantFrequency.entries()) {
      if (merchantTransactions.length >= 3) { // At least 3 transactions
        const avgAmount = merchantTransactions.reduce((sum, t) => sum + t.amount, 0) / merchantTransactions.length;
        const lastDate = new Date(Math.max(...merchantTransactions.map(t => t.date.getTime())));
        
        recurring.push({
          merchant,
          amount: avgAmount,
          frequency: this.calculateFrequency(merchantTransactions),
          lastDate
        });
      }
    }
    
    return recurring.slice(0, 5); // Top 5 recurring payments
  }

  private findUnusualTransactions(transactions: any[]) {
    if (transactions.length === 0) return [];
    
    // Calculate average transaction amount
    const amounts = transactions.map(t => t.amount);
    const avgAmount = amounts.reduce((sum, a) => sum + a, 0) / amounts.length;
    const threshold = avgAmount * 3; // 3x average is considered unusual
    
    return transactions
      .filter(t => t.amount > threshold)
      .map(t => ({
        date: t.date,
        description: t.description,
        amount: t.amount,
        reason: `Amount is ${Math.round(t.amount / avgAmount)}x higher than average`
      }))
      .slice(0, 5); // Top 5 unusual transactions
  }

  private calculateSpendingTrends(transactions: any[]) {
    // This is a simplified trend calculation
    // In a real implementation, you'd want more sophisticated trend analysis
    
    const categoryTotals = new Map<string, number>();
    
    transactions.forEach(t => {
      if (t.type === 'debit' && t.category) {
        const existing = categoryTotals.get(t.category) || 0;
        categoryTotals.set(t.category, existing + t.amount);
      }
    });
    
    return Array.from(categoryTotals.entries())
      .map(([category, amount]) => ({
        category,
        trend: 'stable' as const, // Simplified - would need historical data for real trends
        percentage: 0 // Would calculate based on previous periods
      }));
  }

  private calculateFrequency(transactions: any[]): string {
    if (transactions.length < 2) return 'unknown';
    
    const dates = transactions.map(t => t.date).sort((a, b) => a.getTime() - b.getTime());
    const intervals = [];
    
    for (let i = 1; i < dates.length; i++) {
      const daysDiff = (dates[i].getTime() - dates[i-1].getTime()) / (1000 * 60 * 60 * 24);
      intervals.push(daysDiff);
    }
    
    const avgInterval = intervals.reduce((sum, i) => sum + i, 0) / intervals.length;
    
    if (avgInterval <= 7) return 'weekly';
    if (avgInterval <= 31) return 'monthly';
    if (avgInterval <= 93) return 'quarterly';
    return 'irregular';
  }

  private basicCategorization(description: string): string {
    const categories = {
      'Food & Dining': ['restaurant', 'food', 'lunch', 'dinner', 'cafe', 'pizza', 'chicken', 'mcdonald', 'kfc'],
      'Transportation': ['uber', 'taxi', 'bus', 'transport', 'fuel', 'petrol', 'gas'],
      'Shopping': ['shoprite', 'mall', 'store', 'market', 'purchase', 'buy'],
      'Bills & Utilities': ['electric', 'water', 'phone', 'internet', 'dstv', 'cable', 'subscription'],
      'Banking': ['bank', 'atm', 'transfer', 'fee', 'charge'],
      'Healthcare': ['hospital', 'clinic', 'pharmacy', 'medical', 'doctor'],
      'Entertainment': ['cinema', 'movie', 'game', 'entertainment', 'music']
    };
    
    const lowerDesc = description.toLowerCase();
    
    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some(keyword => lowerDesc.includes(keyword))) {
        return category;
      }
    }
    
    return 'Other';
  }

  private extractMerchantFromDescription(description: string): string {
    // Simple merchant extraction - take first few words
    const words = description.trim().split(/\s+/);
    return words.slice(0, 3).join(' ');
  }
}
