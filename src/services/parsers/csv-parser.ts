import csv from 'csv-parser';
import fs from 'fs';
import { Readable } from 'stream';
import { ExtractedTransaction } from '../../interfaces/bank-statement';
import { parseISO, parse, isValid } from 'date-fns';

export class CSVParser {
  static async parse(fileBuffer: Buffer): Promise<ExtractedTransaction[]> {
    const csvContent = fileBuffer.toString('utf-8');
    const transactions: ExtractedTransaction[] = [];
    
    return new Promise((resolve, reject) => {
      const stream = Readable.from(csvContent);
      
      stream
        .pipe(csv())
        .on('data', (data) => {
          try {
            const transaction = this.parseCSVRow(data);
            if (transaction) {
              transactions.push(transaction);
            }
          } catch (error) {
            console.error('Error parsing CSV row:', error);
          }
        })
        .on('end', () => {
          resolve(transactions);
        })
        .on('error', (error) => {
          reject(error);
        });
    });
  }

  private static parseCSVRow(row: any): ExtractedTransaction | null {
    try {
      // Try different column name variations
      const date = this.extractDate(row);
      const description = this.extractDescription(row);
      const { amount, type } = this.extractAmount(row);
      const balance = this.extractBalance(row);
      const reference = this.extractReference(row);

      if (!date || !description || amount === 0) {
        return null;
      }

      return {
        date,
        description: description.trim(),
        amount: Math.abs(amount),
        type,
        balance: balance || undefined,
        reference: reference || undefined,
        rawData: row
      };
    } catch (error) {
      console.error('Error parsing CSV row:', error);
      return null;
    }
  }

  private static extractDate(row: any): Date | null {
    const dateFields = [
      'Transaction Date', 'Date', 'TRANS DATE', 'Transaction_Date', 
      'date', 'transaction_date', 'Value Date', 'VALUE_DATE'
    ];
    
    for (const field of dateFields) {
      const dateValue = row[field];
      if (dateValue) {
        const date = this.parseDate(dateValue);
        if (date && isValid(date)) {
          return date;
        }
      }
    }
    return null;
  }

  private static extractDescription(row: any): string {
    const descFields = [
      'Narration', 'Description', 'DESCRIPTION', 'Memo', 
      'narration', 'description', 'memo', 'Details', 'details'
    ];
    
    for (const field of descFields) {
      if (row[field]) {
        return String(row[field]).trim();
      }
    }
    return 'Unknown Transaction';
  }

  private static extractAmount(row: any): { amount: number; type: 'debit' | 'credit' } {
    // Check for separate debit/credit columns
    const debitFields = ['Debit', 'DEBIT', 'debit', 'DR', 'Withdrawal'];
    const creditFields = ['Credit', 'CREDIT', 'credit', 'CR', 'Deposit'];
    
    let debitAmount = 0;
    let creditAmount = 0;
    
    // Extract debit amount
    for (const field of debitFields) {
      if (row[field]) {
        const amount = this.parseAmount(row[field]);
        if (amount > 0) {
          debitAmount = amount;
          break;
        }
      }
    }
    
    // Extract credit amount
    for (const field of creditFields) {
      if (row[field]) {
        const amount = this.parseAmount(row[field]);
        if (amount > 0) {
          creditAmount = amount;
          break;
        }
      }
    }
    
    // Determine type and amount
    if (debitAmount > 0 && creditAmount === 0) {
      return { amount: debitAmount, type: 'debit' };
    } else if (creditAmount > 0 && debitAmount === 0) {
      return { amount: creditAmount, type: 'credit' };
    }
    
    // Check for single amount column with type indicator
    const amountFields = ['Amount', 'AMOUNT', 'amount', 'Value'];
    const typeFields = ['Type', 'TYPE', 'type', 'Transaction Type'];
    
    for (const amountField of amountFields) {
      if (row[amountField]) {
        const amount = Math.abs(this.parseAmount(row[amountField]));
        
        // Try to determine type from a separate type field
        for (const typeField of typeFields) {
          if (row[typeField]) {
            const typeValue = String(row[typeField]).toLowerCase();
            if (typeValue.includes('debit') || typeValue.includes('dr') || typeValue.includes('withdrawal')) {
              return { amount, type: 'debit' };
            } else if (typeValue.includes('credit') || typeValue.includes('cr') || typeValue.includes('deposit')) {
              return { amount, type: 'credit' };
            }
          }
        }
        
        // If no type field, determine from amount sign
        const originalAmount = this.parseAmount(row[amountField]);
        return {
          amount,
          type: originalAmount < 0 ? 'debit' : 'credit'
        };
      }
    }
    
    return { amount: 0, type: 'debit' };
  }

  private static extractBalance(row: any): number | null {
    const balanceFields = ['Balance', 'BALANCE', 'balance', 'Running Balance'];
    
    for (const field of balanceFields) {
      if (row[field]) {
        const balance = this.parseAmount(row[field]);
        if (!isNaN(balance)) {
          return balance;
        }
      }
    }
    return null;
  }

  private static extractReference(row: any): string | null {
    const refFields = ['Reference', 'REFERENCE', 'reference', 'Ref', 'ref', 'Transaction ID'];
    
    for (const field of refFields) {
      if (row[field]) {
        return String(row[field]).trim();
      }
    }
    return null;
  }

  private static parseDate(dateStr: string): Date | null {
    // Common date formats
    const formats = [
      'yyyy-MM-dd',
      'dd/MM/yyyy',
      'MM/dd/yyyy',
      'dd-MM-yyyy',
      'MM-dd-yyyy',
      'yyyy/MM/dd',
      'dd MMM yyyy',
      'MMM dd, yyyy'
    ];
    
    // Try ISO format first
    try {
      const isoDate = parseISO(dateStr);
      if (isValid(isoDate)) {
        return isoDate;
      }
    } catch (error) {
      // Continue to other formats
    }
    
    // Try various formats
    for (const format of formats) {
      try {
        const date = parse(dateStr, format, new Date());
        if (isValid(date)) {
          return date;
        }
      } catch (error) {
        // Continue to next format
      }
    }
    
    // Try native Date parsing as fallback
    try {
      const date = new Date(dateStr);
      if (isValid(date)) {
        return date;
      }
    } catch (error) {
      // Failed to parse
    }
    
    return null;
  }

  private static parseAmount(amountStr: string | number): number {
    if (typeof amountStr === 'number') {
      return amountStr;
    }
    
    if (typeof amountStr !== 'string') {
      return 0;
    }
    
    // Remove currency symbols, commas, and other non-numeric characters except decimal point and minus
    const cleanedAmount = amountStr
      .replace(/[₦$€£¥,\s]/g, '') // Remove currency symbols and commas
      .replace(/[()]/g, '') // Remove parentheses (sometimes used for negative amounts)
      .trim();
    
    if (cleanedAmount === '' || cleanedAmount === '-') {
      return 0;
    }
    
    const amount = parseFloat(cleanedAmount);
    return isNaN(amount) ? 0 : amount;
  }
}
