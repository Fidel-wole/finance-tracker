import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs/promises';
import BankStatementService from '../services/bank-statement';
import { BankStatementRepository } from '../repositories/bank-statement';
import pdf from 'pdf-parse';

export class BankStatementController {
  private bankStatementService: BankStatementService;
  private bankStatementRepository: BankStatementRepository;

  constructor() {
    this.bankStatementService = new BankStatementService();
    this.bankStatementRepository = new BankStatementRepository();
  }

    /**
   * Test endpoint to extract and return raw PDF text for debugging
   */
  public static async debugPdfText(req: Request, res: Response): Promise<void> {
    try {
      if (!req.file) {
        res.status(400).json({
          success: false,
          message: 'No PDF file uploaded'
        });
        return;
      }

      // Only allow PDF files
      if (req.file.mimetype !== 'application/pdf') {
        res.status(400).json({
          success: false,
          message: 'Only PDF files are supported for this debug endpoint'
        });
        return;
      }

      // Extract text from PDF
      const pdfBuffer = req.file.buffer;
      const pdfData = await pdf(pdfBuffer);
      const text = pdfData.text;

      res.json({
        success: true,
        data: {
          filename: req.file.originalname,
          textLength: text.length,
          firstChars: text.substring(0, 1000),
          fullText: text
        }
      });

    } catch (error) {
      console.error('Error in debugPdfText:', error);
      res.status(500).json({
        success: false,
        message: 'Error extracting PDF text',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
  async uploadStatement(req: Request, res: Response): Promise<void> {
    try {
      if (!req.file) {
        res.status(400).json({
          success: false,
          message: 'No file uploaded'
        });
        return;
      }

      const { userId } = req.body;
      
      // For no-auth mode, userId is optional
      // We'll store statements without user association for now

      // Validate file type
      const allowedTypes = ['.pdf', '.csv', '.xlsx', '.xls'];
      const fileExtension = path.extname(req.file.originalname).toLowerCase();
      
      if (!allowedTypes.includes(fileExtension)) {
        res.status(400).json({
          success: false,
          message: 'Unsupported file type. Please upload PDF, CSV, or Excel files.'
        });
        return;
      }

      // Create statement record
      const statement = await this.bankStatementRepository.createStatement({
        userId: userId || undefined, // Optional userId
        fileName: req.file.originalname,
        fileSize: req.file.size,
        fileType: fileExtension.substring(1), // Remove the dot
        filePath: req.file.path,
        status: 'processing'
      });

      // Process statement asynchronously (with small delay to ensure DB commit)
      const filePath = req.file.path;
      setTimeout(() => {
        this.processStatementAsync(statement.id, filePath, fileExtension.substring(1));
      }, 100);

      res.status(200).json({
        success: true,
        message: 'File uploaded successfully. Processing started.',
        data: {
          statementId: statement.id,
          fileName: statement.fileName,
          status: statement.status
        }
      });

    } catch (error) {
      console.error('Error uploading statement:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to upload statement',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get statement processing status
   */
  async getStatementStatus(req: Request, res: Response): Promise<void> {
    try {
      const { statementId } = req.params;
      
      const statement = await this.bankStatementRepository.getStatement(statementId);
      
      if (!statement) {
        res.status(404).json({
          success: false,
          message: 'Statement not found'
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          id: statement.id,
          fileName: statement.fileName,
          status: statement.status,
          processingTime: statement.processingTime,
          errorMessage: statement.errorMessage,
          createdAt: statement.createdAt,
          updatedAt: statement.updatedAt
        }
      });

    } catch (error) {
      console.error('Error getting statement status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get statement status',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get statement analysis results
   */
  async getStatementAnalysis(req: Request, res: Response): Promise<void> {
    try {
      const { statementId } = req.params;
      
      const statement = await this.bankStatementRepository.getStatement(statementId);
      
      if (!statement) {
        res.status(404).json({
          success: false,
          message: 'Statement not found'
        });
        return;
      }

      if (statement.status !== 'completed') {
        res.status(400).json({
          success: false,
          message: `Statement is not ready. Current status: ${statement.status}`
        });
        return;
      }

      const transactions = await this.bankStatementRepository.getStatementTransactions(statementId);
      const summary = await this.bankStatementRepository.getStatementSummary(statementId);

      res.status(200).json({
        success: true,
        data: {
          statement: {
            id: statement.id,
            fileName: statement.fileName,
            bankName: statement.bankName,
            accountNumber: statement.accountNumber,
            statementPeriod: statement.statementPeriod,
            processingTime: statement.processingTime
          },
          transactions,
          summary,
          analysis: statement.analysisResult
        }
      });

    } catch (error) {
      console.error('Error getting statement analysis:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get statement analysis',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get user's bank statements
   */
  async getUserStatements(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      
      const statements = await this.bankStatementRepository.getUserStatements(userId);

      res.status(200).json({
        success: true,
        data: statements.map(statement => ({
          id: statement.id,
          fileName: statement.fileName,
          fileSize: statement.fileSize,
          fileType: statement.fileType,
          bankName: statement.bankName,
          status: statement.status,
          createdAt: statement.createdAt,
          updatedAt: statement.updatedAt
        }))
      });

    } catch (error) {
      console.error('Error getting user statements:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get user statements',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Delete a bank statement
   */
  async deleteStatement(req: Request, res: Response): Promise<void> {
    try {
      const { statementId } = req.params;
      
      const statement = await this.bankStatementRepository.getStatement(statementId);
      
      if (!statement) {
        res.status(404).json({
          success: false,
          message: 'Statement not found'
        });
        return;
      }

      // Delete the file from filesystem
      try {
        await fs.unlink(statement.filePath);
      } catch (fileError) {
        console.warn('Could not delete file:', fileError);
        // Continue with database deletion even if file deletion fails
      }

      // Delete from database
      await this.bankStatementRepository.deleteStatement(statementId);

      res.status(200).json({
        success: true,
        message: 'Statement deleted successfully'
      });

    } catch (error) {
      console.error('Error deleting statement:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete statement',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Process statement asynchronously
   */
  private async processStatementAsync(statementId: string, filePath: string, fileType: string): Promise<void> {
    const startTime = Date.now();
    const TIMEOUT_MS = 120000; // 2 minutes timeout
    
    try {
      console.log(`Starting processing for statement ${statementId}`);
      
      // Verify the statement exists before processing
      const existingStatement = await this.bankStatementRepository.getStatement(statementId);
      if (!existingStatement) {
        console.error(`Statement ${statementId} not found for processing`);
        return;
      }
      
      // Create a timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Processing timeout after 2 minutes')), TIMEOUT_MS);
      });
      
      // Race between processing and timeout
      const result = await Promise.race([
        this.bankStatementService.processStatement(statementId, filePath, fileType),
        timeoutPromise
      ]) as any;
      
      const processingTime = Date.now() - startTime;
      
      // Update statement with results
      const updatedStatement = await this.bankStatementRepository.updateStatement(statementId, {
        status: 'completed',
        extractedData: result.extractedTransactions,
        analysisResult: result.analysis,
        bankName: result.bankName,
        accountNumber: result.accountNumber,
        statementPeriod: result.statementPeriod,
        processingTime
      });

      if (updatedStatement) {
        console.log(`Statement ${statementId} processed successfully in ${processingTime}ms`);
      } else {
        console.log(`Statement ${statementId} was deleted during processing`);
      }

    } catch (error) {
      console.error(`Error processing statement ${statementId}:`, error);
      
      const processingTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Check if statement still exists before updating with error
      try {
        const statement = await this.bankStatementRepository.getStatement(statementId);
        if (statement) {
          const updatedStatement = await this.bankStatementRepository.updateStatement(statementId, {
            status: 'failed',
            errorMessage: errorMessage,
            processingTime
          });
          
          if (!updatedStatement) {
            console.log(`Statement ${statementId} was deleted during error handling`);
          }
        } else {
          console.log(`Statement ${statementId} was already deleted, skipping error update`);
        }
      } catch (updateError) {
        console.error(`Failed to update statement ${statementId} with error status:`, updateError);
      }
    }
  }

  /**
   * Re-categorize a transaction
   */
  async recategorizeTransaction(req: Request, res: Response): Promise<void> {
    try {
      const { transactionId } = req.params;
      const { category, merchant } = req.body;

      if (!category) {
        res.status(400).json({
          success: false,
          message: 'Category is required'
        });
        return;
      }

      await this.bankStatementRepository.updateTransactionCategory(
        transactionId,
        category,
        merchant,
        1.0 // Manual categorization has 100% confidence
      );

      res.status(200).json({
        success: true,
        message: 'Transaction categorized successfully'
      });

    } catch (error) {
      console.error('Error recategorizing transaction:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to recategorize transaction',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}
