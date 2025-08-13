import xlsx from 'xlsx';
import { ExtractedTransaction } from '../../interfaces/bank-statement';
import { parseISO, parse, isValid } from 'date-fns';

export class ExcelParser {
  static async parse(fileBuffer: Buffer): Promise<ExtractedTransaction[]> {
    try {
      const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
      
      // Usually the first sheet contains the transactions
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // Convert to JSON for easier processing
      const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
      
      if (data.length === 0) {
        throw new Error('No data found in Excel file');
      }
      
      // Find header row and extract transactions
      return this.extractTransactionsFromData(data);
    } catch (error) {
      console.error('Error parsing Excel file:', error);
      throw new Error('Failed to parse Excel file. Please ensure it\'s a valid bank statement.');
    }
  }

  private static extractTransactionsFromData(data: any[][]): ExtractedTransaction[] {
    const transactions: ExtractedTransaction[] = [];
    
    // Find the header row
    let headerRowIndex = -1;
    let headers: string[] = [];
    
    for (let i = 0; i < Math.min(10, data.length); i++) {
      const row = data[i];
      if (this.looksLikeHeaderRow(row)) {
        headerRowIndex = i;
        headers = row.map(cell => String(cell || '').trim());
        break;
      }
    }
    
    if (headerRowIndex === -1) {
      throw new Error('Could not find header row in Excel file');
    }
    
    // Process data rows
    for (let i = headerRowIndex + 1; i < data.length; i++) {
      const row = data[i];
      
      if (!row || row.length === 0) continue;
      
      try {
        const transaction = this.parseExcelRow(headers, row);
        if (transaction) {
          transactions.push(transaction);
        }
      } catch (error) {
        console.error(`Error parsing Excel row ${i}:`, error);
      }
    }
    
    return transactions;
  }

  private static looksLikeHeaderRow(row: any[]): boolean {
    if (!row || row.length < 3) return false;
    
    const headerIndicators = [
      'date', 'transaction date', 'trans date', 'value date',
      'description', 'narration', 'memo', 'details',
      'amount', 'debit', 'credit', 'balance',
      'type', 'reference', 'ref'
    ];
    
    const cellText = row.map(cell => String(cell || '').toLowerCase().trim());
    const matches = cellText.filter(cell => 
      headerIndicators.some(indicator => cell.includes(indicator))
    );
    
    // If at least 60% of cells look like headers
    return matches.length >= Math.ceil(cellText.length * 0.6);
  }

  private static parseExcelRow(headers: string[], row: any[]): ExtractedTransaction | null {
    try {
      const rowData: { [key: string]: any } = {};
      
      // Map row values to headers
      for (let i = 0; i < headers.length && i < row.length; i++) {
        rowData[headers[i]] = row[i];
      }
      
      // Extract required fields
      const date = this.extractDate(rowData, headers);
      const description = this.extractDescription(rowData, headers);
      const { amount, type } = this.extractAmount(rowData, headers);
      const balance = this.extractBalance(rowData, headers);
      const reference = this.extractReference(rowData, headers);
      
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
        rawData: rowData
      };
    } catch (error) {
      console.error('Error parsing Excel row:', error);
      return null;
    }
  }

  private static extractDate(rowData: any, headers: string[]): Date | null {
    const dateFields = [
      'Transaction Date', 'Date', 'TRANS DATE', 'Transaction_Date',
      'date', 'transaction_date', 'Value Date', 'VALUE_DATE',
      'trans date', 'value date'
    ];
    
    for (const field of dateFields) {
      // Try exact match first
      if (rowData[field]) {
        const date = this.parseDate(rowData[field]);
        if (date && isValid(date)) {
          return date;
        }
      }
      
      // Try case-insensitive match
      const matchingHeader = headers.find(header => 
        header.toLowerCase().includes(field.toLowerCase())
      );
      
      if (matchingHeader && rowData[matchingHeader]) {
        const date = this.parseDate(rowData[matchingHeader]);
        if (date && isValid(date)) {
          return date;
        }
      }
    }
    
    return null;
  }

  private static extractDescription(rowData: any, headers: string[]): string {
    const descFields = [
      'Narration', 'Description', 'DESCRIPTION', 'Memo',
      'narration', 'description', 'memo', 'Details', 'details',
      'transaction description', 'trans description'
    ];
    
    for (const field of descFields) {
      // Try exact match
      if (rowData[field]) {
        return String(rowData[field]).trim();
      }
      
      // Try case-insensitive match
      const matchingHeader = headers.find(header => 
        header.toLowerCase().includes(field.toLowerCase())
      );
      
      if (matchingHeader && rowData[matchingHeader]) {
        return String(rowData[matchingHeader]).trim();
      }
    }
    
    return 'Unknown Transaction';
  }

  private static extractAmount(rowData: any, headers: string[]): { amount: number; type: 'debit' | 'credit' } {
    // Check for separate debit/credit columns
    const debitFields = ['Debit', 'DEBIT', 'debit', 'DR', 'Withdrawal', 'debit amount'];
    const creditFields = ['Credit', 'CREDIT', 'credit', 'CR', 'Deposit', 'credit amount'];
    
    let debitAmount = 0;
    let creditAmount = 0;
    
    // Extract debit amount
    for (const field of debitFields) {
      const matchingHeader = headers.find(header => 
        header.toLowerCase().includes(field.toLowerCase()) ||
        header.toLowerCase() === field.toLowerCase()
      );
      
      if (matchingHeader && rowData[matchingHeader]) {
        const amount = this.parseAmount(rowData[matchingHeader]);
        if (amount > 0) {
          debitAmount = amount;
          break;
        }
      }
    }
    
    // Extract credit amount
    for (const field of creditFields) {
      const matchingHeader = headers.find(header => 
        header.toLowerCase().includes(field.toLowerCase()) ||
        header.toLowerCase() === field.toLowerCase()
      );
      
      if (matchingHeader && rowData[matchingHeader]) {
        const amount = this.parseAmount(rowData[matchingHeader]);
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
    
    // Check for single amount column
    const amountFields = ['Amount', 'AMOUNT', 'amount', 'Value', 'transaction amount'];
    
    for (const field of amountFields) {
      const matchingHeader = headers.find(header => 
        header.toLowerCase().includes(field.toLowerCase()) ||
        header.toLowerCase() === field.toLowerCase()
      );
      
      if (matchingHeader && rowData[matchingHeader]) {
        const originalAmount = this.parseAmount(rowData[matchingHeader]);
        const amount = Math.abs(originalAmount);
        
        // Try to determine type from a separate type field
        const typeFields = ['Type', 'TYPE', 'type', 'Transaction Type', 'trans type'];
        
        for (const typeField of typeFields) {
          const typeHeader = headers.find(header => 
            header.toLowerCase().includes(typeField.toLowerCase())
          );
          
          if (typeHeader && rowData[typeHeader]) {
            const typeValue = String(rowData[typeHeader]).toLowerCase();
            if (typeValue.includes('debit') || typeValue.includes('dr') || typeValue.includes('withdrawal')) {
              return { amount, type: 'debit' };
            } else if (typeValue.includes('credit') || typeValue.includes('cr') || typeValue.includes('deposit')) {
              return { amount, type: 'credit' };
            }
          }
        }
        
        // Determine from amount sign
        return {
          amount,
          type: originalAmount < 0 ? 'debit' : 'credit'
        };
      }
    }
    
    return { amount: 0, type: 'debit' };
  }

  private static extractBalance(rowData: any, headers: string[]): number | null {
    const balanceFields = ['Balance', 'BALANCE', 'balance', 'Running Balance', 'Account Balance'];
    
    for (const field of balanceFields) {
      const matchingHeader = headers.find(header => 
        header.toLowerCase().includes(field.toLowerCase()) ||
        header.toLowerCase() === field.toLowerCase()
      );
      
      if (matchingHeader && rowData[matchingHeader]) {
        const balance = this.parseAmount(rowData[matchingHeader]);
        if (!isNaN(balance)) {
          return balance;
        }
      }
    }
    
    return null;
  }

  private static extractReference(rowData: any, headers: string[]): string | null {
    const refFields = ['Reference', 'REFERENCE', 'reference', 'Ref', 'ref', 'Transaction ID', 'trans id'];
    
    for (const field of refFields) {
      const matchingHeader = headers.find(header => 
        header.toLowerCase().includes(field.toLowerCase()) ||
        header.toLowerCase() === field.toLowerCase()
      );
      
      if (matchingHeader && rowData[matchingHeader]) {
        return String(rowData[matchingHeader]).trim();
      }
    }
    
    return null;
  }

  private static parseDate(dateValue: any): Date | null {
    if (!dateValue) return null;
    
    // Handle Excel date numbers
    if (typeof dateValue === 'number') {
      try {
        // Excel date serial number (days since 1900-01-01)
        const excelDate = xlsx.SSF.parse_date_code(dateValue);
        if (excelDate) {
          return new Date(excelDate.y, excelDate.m - 1, excelDate.d);
        }
      } catch (error) {
        // Fall through to string parsing
      }
    }
    
    // Handle string dates
    const dateStr = String(dateValue);
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

  private static parseAmount(amountValue: any): number {
    if (typeof amountValue === 'number') {
      return amountValue;
    }
    
    if (typeof amountValue !== 'string' && amountValue !== null && amountValue !== undefined) {
      return 0;
    }
    
    const amountStr = String(amountValue || '');
    
    // Remove currency symbols, commas, and other non-numeric characters
    const cleanedAmount = amountStr
      .replace(/[₦$€£¥,\s()]/g, '') // Remove currency symbols, commas, spaces, parentheses
      .trim();
    
    if (cleanedAmount === '' || cleanedAmount === '-') {
      return 0;
    }
    
    const amount = parseFloat(cleanedAmount);
    return isNaN(amount) ? 0 : amount;
  }
}
