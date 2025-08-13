import pdfParse from 'pdf-parse';
import { ExtractedTransaction } from '../../interfaces/bank-statement';
import { parseISO, parse, isValid } from 'date-fns';

export class PDFParser {
  static async parse(fileBuffer: Buffer): Promise<ExtractedTransaction[]> {
    try {
      const data = await pdfParse(fileBuffer);
      const text = data.text;
      
      // Debug: Log the extracted text to understand the format
      console.log('=== PDF TEXT EXTRACTION DEBUG ===');
      console.log('Total text length:', text.length);
      console.log('First 500 characters:');
      console.log(text.substring(0, 500));
      console.log('=== END DEBUG ===');
      
      // Detect bank type and use appropriate parsing strategy
      const bankType = this.detectBankType(text);
      console.log('Detected bank type:', bankType);
      
      let transactions: ExtractedTransaction[] = [];
      
      switch (bankType) {
        case 'gtbank':
          transactions = this.parseGTBankPDF(text);
          break;
        case 'access':
          transactions = this.parseAccessBankPDF(text);
          break;
        case 'firstbank':
          transactions = this.parseFirstBankPDF(text);
          break;
        case 'zenith':
          transactions = this.parseZenithBankPDF(text);
          break;
        case 'opay':
          transactions = this.parseOPayPDF(text);
          break;
        default:
          transactions = this.parseGenericPDF(text);
      }
      
      console.log('Extracted transactions count:', transactions.length);
      if (transactions.length > 0) {
        console.log('Sample transaction:', transactions[0]);
      }
      
      return transactions;
    } catch (error) {
      console.error('Error parsing PDF:', error);
      throw new Error('Failed to parse PDF file. Please ensure it\'s a valid bank statement.');
    }
  }

  private static detectBankType(text: string): string {
    const bankIndicators = {
      gtbank: ['Guaranty Trust Bank', 'GTBank', 'gtb'],
      access: ['Access Bank', 'Diamond Bank'],
      firstbank: ['First Bank', 'FirstBank'],
      zenith: ['Zenith Bank'],
      uba: ['United Bank for Africa', 'UBA'],
      fidelity: ['Fidelity Bank'],
      wema: ['Wema Bank'],
      union: ['Union Bank'],
      opay: ['OPay', 'Wallet Account', 'OWealth Balance', 'Blue Ridge Microfinance']
    };

    const lowerText = text.toLowerCase();
    
    for (const [bank, indicators] of Object.entries(bankIndicators)) {
      if (indicators.some(indicator => lowerText.includes(indicator.toLowerCase()))) {
        return bank;
      }
    }
    
    return 'generic';
  }

  private static parseGTBankPDF(text: string): ExtractedTransaction[] {
    const transactions: ExtractedTransaction[] = [];
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    console.log('=== GT BANK PDF PARSING ===');
    console.log('Total lines to process:', lines.length);
    
    // Updated regex for the GT Bank format shown in the image
    // Format: Date Time | Value Date | Description | Amount | Balance | Channel | Reference
    const transactionRegex = /(\d{4}\s+\w{3}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})\s+(\d{1,2}\s+\w{3}\s+\d{4})\s+(.+?)\s+([\+\-]?[\d,]+\.?\d*)\s+([\d,]+\.?\d*)\s+([\w\-]+)\s+([\w\d]+)$/;
    
    // Alternative simpler pattern focusing on key parts
    const altRegex = /(\d{4}\s+\w{3}\s+\d{1,2})\s+.*?\s+(\d{1,2}\s+\w{3}\s+\d{4})\s+(.+?)\s+([\+\-][\d,]+\.?\d*)\s+([\d,]+\.?\d*)/;
    
    let matchCount = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Skip header lines and non-transaction lines
      if (line.includes('Trans. Time') || 
          line.includes('Value Date') || 
          line.includes('Description') ||
          line.includes('Balance') ||
          line.length < 20) {
        continue;
      }
      
      console.log(`Processing line ${i}: "${line}"`);
      
      // Try main pattern first
      let match = line.match(transactionRegex);
      if (!match) {
        // Try alternative pattern
        match = line.match(altRegex);
      }
      
      if (match) {
        console.log('Match found:', match);
        
        try {
          // Parse the transaction date (first date in the line)
          const transDateStr = match[1]; // e.g., "2025 Jul 14 06:00:02"
          const valueDateStr = match[2]; // e.g., "14 Jul 2025"
          const description = match[3]?.trim();
          const amountStr = match[4]; // e.g., "+76,695.00" or "-50.00"
          const balanceStr = match[5]; // e.g., "76,695.00"
          
          // Parse date from value date (more reliable)
          const date = this.parseGTBankDate(valueDateStr);
          if (!date) {
            console.log('Failed to parse date:', valueDateStr);
            continue;
          }
          
          if (!description || description.length < 2) {
            console.log('Invalid description:', description);
            continue;
          }
          
          // Parse amount and determine type
          const cleanAmount = amountStr.replace(/[^\d\.\+\-,]/g, '');
          const isCredit = cleanAmount.startsWith('+') || (!cleanAmount.startsWith('-') && cleanAmount.includes('+'));
          const amount = this.parseAmount(cleanAmount.replace(/[\+\-]/g, ''));
          const balance = this.parseAmount(balanceStr);
          
          if (amount > 0) {
            const transaction = {
              date,
              description,
              amount,
              type: isCredit ? 'credit' : 'debit' as 'debit' | 'credit',
              balance,
              reference: match[7] || undefined, // Transaction reference if available
              rawData: { 
                line, 
                bank: 'gtbank', 
                transTime: transDateStr,
                valueDate: valueDateStr,
                amountStr,
                balanceStr
              }
            };
            
            transactions.push(transaction);
            matchCount++;
            console.log('Added GT Bank transaction:', transaction);
          }
        } catch (error) {
          console.error('Error parsing GT Bank line:', line, error);
        }
      } else {
        console.log('No match for line:', line);
      }
    }
    
    console.log(`GT Bank: Successfully parsed ${matchCount} transactions`);
    return transactions;
  }

  private static parseAccessBankPDF(text: string): ExtractedTransaction[] {
    const transactions: ExtractedTransaction[] = [];
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    // Access Bank format
    const transactionRegex = /(\d{2}[-/]\d{2}[-/]\d{4})\s+(.+?)\s+(DR|CR)\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})/;
    
    for (const line of lines) {
      const match = line.match(transactionRegex);
      if (match) {
        const [, dateStr, description, type, amountStr, balanceStr] = match;
        
        const date = this.parseDate(dateStr);
        if (!date) continue;
        
        const amount = this.parseAmount(amountStr);
        const balance = this.parseAmount(balanceStr);
        const transactionType = type === 'DR' ? 'debit' : 'credit';
        
        transactions.push({
          date,
          description: description.trim(),
          amount,
          type: transactionType,
          balance,
          rawData: { line, bank: 'access' }
        });
      }
    }
    
    return transactions;
  }

  private static parseFirstBankPDF(text: string): ExtractedTransaction[] {
    const transactions: ExtractedTransaction[] = [];
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    // First Bank format
    const transactionRegex = /(\d{2}[-/]\d{2}[-/]\d{4})\s+(.+?)\s+([\d,]+\.\d{2})?\s+([\d,]+\.\d{2})?\s+([\d,]+\.\d{2})/;
    
    for (const line of lines) {
      const match = line.match(transactionRegex);
      if (match) {
        const [, dateStr, description, debitStr, creditStr, balanceStr] = match;
        
        const date = this.parseDate(dateStr);
        if (!date) continue;
        
        const debit = debitStr ? this.parseAmount(debitStr) : 0;
        const credit = creditStr ? this.parseAmount(creditStr) : 0;
        const balance = this.parseAmount(balanceStr);
        
        if (debit > 0) {
          transactions.push({
            date,
            description: description.trim(),
            amount: debit,
            type: 'debit',
            balance,
            rawData: { line, bank: 'firstbank' }
          });
        } else if (credit > 0) {
          transactions.push({
            date,
            description: description.trim(),
            amount: credit,
            type: 'credit',
            balance,
            rawData: { line, bank: 'firstbank' }
          });
        }
      }
    }
    
    return transactions;
  }

  private static parseZenithBankPDF(text: string): ExtractedTransaction[] {
    const transactions: ExtractedTransaction[] = [];
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    // Zenith Bank format (similar to GTBank)
    const transactionRegex = /(\d{2}[-/]\d{2}[-/]\d{4})\s+(.+?)\s+([\d,]+\.\d{2})?\s+([\d,]+\.\d{2})?\s+([\d,]+\.\d{2})/;
    
    for (const line of lines) {
      const match = line.match(transactionRegex);
      if (match) {
        const [, dateStr, description, debitStr, creditStr, balanceStr] = match;
        
        const date = this.parseDate(dateStr);
        if (!date) continue;
        
        const debit = debitStr ? this.parseAmount(debitStr) : 0;
        const credit = creditStr ? this.parseAmount(creditStr) : 0;
        const balance = this.parseAmount(balanceStr);
        
        if (debit > 0) {
          transactions.push({
            date,
            description: description.trim(),
            amount: debit,
            type: 'debit',
            balance,
            rawData: { line, bank: 'zenith' }
          });
        } else if (credit > 0) {
          transactions.push({
            date,
            description: description.trim(),
            amount: credit,
            type: 'credit',
            balance,
            rawData: { line, bank: 'zenith' }
          });
        }
      }
    }
    
    return transactions;
  }

  private static parseGenericPDF(text: string): ExtractedTransaction[] {
    const transactions: ExtractedTransaction[] = [];
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    console.log('=== GENERIC PDF PARSING DEBUG ===');
    console.log('Total lines:', lines.length);
    console.log('Sample lines:');
    lines.slice(0, 20).forEach((line, i) => {
      console.log(`Line ${i + 1}: "${line}"`);
    });
    console.log('=== END PARSING DEBUG ===');
    
    // Enhanced patterns for different PDF formats
    const patterns = [
      // Pattern 1: Date Description Amount Type Balance
      /(\d{1,2}[-/]\d{1,2}[-/]\d{4})\s+(.+?)\s+([\d,]+\.?\d*)\s+(DR|CR|DEBIT|CREDIT)\s+([\d,]+\.?\d*)/i,
      
      // Pattern 2: Date Description Debit Credit Balance
      /(\d{1,2}[-/]\d{1,2}[-/]\d{4})\s+(.+?)\s+([\d,]+\.?\d*)?\s+([\d,]+\.?\d*)?\s+([\d,]+\.?\d*)/,
      
      // Pattern 3: Date Description Amount Balance
      /(\d{1,2}[-/]\d{1,2}[-/]\d{4})\s+(.+?)\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)/,
      
      // Pattern 4: More flexible date formats
      /(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})\s+(.+?)\s+([\d,]+\.?\d*)/,
      
      // Pattern 5: ISO date format
      /(\d{4}[-/]\d{1,2}[-/]\d{1,2})\s+(.+?)\s+([\d,]+\.?\d*)/,
      
      // Pattern 6: Very flexible pattern for any date-like string followed by text and numbers
      /(\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4})\s+([^0-9]+)\s*([\d,]+\.?\d*)/
    ];
    
    let matchedLines = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Skip obviously non-transaction lines
      if (line.length < 10 || 
          line.toLowerCase().includes('statement') || 
          line.toLowerCase().includes('balance brought forward') ||
          line.toLowerCase().includes('total') ||
          line.toLowerCase().includes('date') ||
          line.toLowerCase().includes('description')) {
        continue;
      }
      
      for (let patternIndex = 0; patternIndex < patterns.length; patternIndex++) {
        const pattern = patterns[patternIndex];
        const match = line.match(pattern);
        
        if (match) {
          console.log(`Pattern ${patternIndex + 1} matched line ${i + 1}: "${line}"`);
          console.log('Match groups:', match);
          
          try {
            const date = this.parseDate(match[1]);
            if (!date) {
              console.log('Failed to parse date:', match[1]);
              continue;
            }
            
            const description = match[2]?.trim();
            if (!description || description.length < 2) {
              console.log('Invalid description:', description);
              continue;
            }
            
            // Extract amount and type based on pattern
            let amount = 0;
            let type: 'debit' | 'credit' = 'debit';
            let balance: number | undefined;
            
            if (match.length >= 6 && (match[4]?.toLowerCase().includes('cr') || match[4]?.toLowerCase().includes('credit'))) {
              // Pattern 1: explicit type
              amount = this.parseAmount(match[3]);
              type = 'credit';
              balance = match[5] ? this.parseAmount(match[5]) : undefined;
            } else if (match.length >= 6 && match[3] && match[4]) {
              // Pattern 2: debit/credit columns
              const debit = match[3] ? this.parseAmount(match[3]) : 0;
              const credit = match[4] ? this.parseAmount(match[4]) : 0;
              
              if (debit > 0) {
                amount = debit;
                type = 'debit';
              } else if (credit > 0) {
                amount = credit;
                type = 'credit';
              } else {
                continue; // No valid amount found
              }
              balance = match[5] ? this.parseAmount(match[5]) : undefined;
            } else if (match.length >= 4) {
              // Pattern 3, 4, 5, 6: single amount
              const amountStr = match[3];
              amount = Math.abs(this.parseAmount(amountStr));
              
              // Try to determine type from description or context
              const descLower = description.toLowerCase();
              if (descLower.includes('credit') || descLower.includes('deposit') || descLower.includes('salary') || descLower.includes('transfer in')) {
                type = 'credit';
              } else if (descLower.includes('debit') || descLower.includes('withdrawal') || descLower.includes('payment') || descLower.includes('pos')) {
                type = 'debit';
              } else {
                // Default logic: if we can find next amount, it might be balance
                type = 'debit'; // Default assumption
              }
              
              balance = match[4] ? this.parseAmount(match[4]) : undefined;
            }
            
            if (amount > 0) {
              const transaction = {
                date,
                description,
                amount,
                type,
                balance,
                rawData: { line, bank: 'generic', pattern: patternIndex + 1 }
              };
              
              transactions.push(transaction);
              matchedLines++;
              console.log('Added transaction:', transaction);
              break; // Found a match, no need to try other patterns
            }
          } catch (error) {
            console.error('Error parsing line:', line, error);
          }
        }
      }
    }
    
    console.log(`Successfully matched ${matchedLines} lines out of ${lines.length} total lines`);
    return transactions;
  }

  private static parseDate(dateStr: string): Date | null {
    if (!dateStr) return null;
    
    // Clean the date string
    const cleaned = dateStr.trim().replace(/[^\d\/\-\.]/g, '');
    
    const formats = [
      'dd/MM/yyyy',
      'MM/dd/yyyy', 
      'dd-MM-yyyy',
      'MM-dd-yyyy',
      'yyyy-MM-dd',
      'yyyy/MM/dd',
      'dd.MM.yyyy',
      'MM.dd.yyyy',
      'dd/MM/yy',
      'MM/dd/yy',
      'dd-MM-yy',
      'MM-dd-yy'
    ];
    
    for (const format of formats) {
      try {
        const date = parse(cleaned, format, new Date());
        if (isValid(date)) {
          // If year is less than 1970, assume it's a 2-digit year that should be 20XX
          if (date.getFullYear() < 1970) {
            date.setFullYear(date.getFullYear() + 2000);
          }
          return date;
        }
      } catch (error) {
        // Continue to next format
      }
    }
    
    // Try native Date parsing as fallback
    try {
      const date = new Date(cleaned);
      if (isValid(date) && date.getFullYear() > 1900) {
        return date;
      }
    } catch (error) {
      // Ignore
    }
    
    console.log('Failed to parse date:', dateStr, 'cleaned:', cleaned);
    return null;
  }

  private static parseGTBankDate(dateStr: string): Date | null {
    if (!dateStr) return null;
    
    // GT Bank date format: "14 Jul 2025"
    try {
      const date = parse(dateStr.trim(), 'dd MMM yyyy', new Date());
      if (isValid(date)) {
        return date;
      }
    } catch (error) {
      console.log('Failed to parse GT Bank date:', dateStr, error);
    }
    
    // Fallback to general date parsing
    return this.parseDate(dateStr);
  }

  private static parseAmount(amountStr: string): number {
    if (!amountStr) return 0;
    
    // Remove currency symbols, commas, spaces, and other non-numeric characters except decimal point and minus
    const cleaned = amountStr.replace(/[₦$€£¥,\s()]/g, '').trim();
    
    // Handle different decimal separators
    let normalizedAmount = cleaned;
    
    // If there are multiple dots, treat the last one as decimal separator
    const dotCount = (cleaned.match(/\./g) || []).length;
    if (dotCount > 1) {
      const lastDotIndex = cleaned.lastIndexOf('.');
      normalizedAmount = cleaned.substring(0, lastDotIndex).replace(/\./g, '') + '.' + cleaned.substring(lastDotIndex + 1);
    }
    
    const amount = parseFloat(normalizedAmount);
    const result = isNaN(amount) ? 0 : Math.abs(amount); // Always return positive amount
    
    if (result === 0 && amountStr.length > 0) {
      console.log('Failed to parse amount:', amountStr, 'cleaned:', cleaned, 'normalized:', normalizedAmount);
    }
    
    return result;
  }

  private static parseOPayPDF(text: string): ExtractedTransaction[] {
    const transactions: ExtractedTransaction[] = [];
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    console.log('=== OPAY PDF PARSING ===');
    console.log('Total lines:', lines.length);
    console.log('Sample lines:');
    lines.slice(0, 10).forEach((line, i) => {
      console.log(`Line ${i + 1}: "${line}"`);
    });
    
    let inTransactionSection = false;
    let i = 0;
    
    while (i < lines.length) {
      const line = lines[i];
      
      // Look for transaction start patterns
      // OPay transactions often have date patterns like "2025 Jul 14" or "14 Jul 2025"
      const datePattern1 = /^(\d{4}\s+\w{3}\s+\d{1,2})\s+(\d{2}:\d{2}:\d{2})?/; // 2025 Jul 14
      const datePattern2 = /^(\d{1,2}\s+\w{3}\s+\d{4})/; // 14 Jul 2025
      
      if (datePattern1.test(line) || datePattern2.test(line)) {
        console.log(`Found potential transaction at line ${i + 1}: "${line}"`);
        // Found a potential transaction line
        const transactionData = this.parseOPayTransactionBlock(lines, i);
        if (transactionData.transaction) {
          console.log('Successfully parsed transaction:', transactionData.transaction);
          transactions.push(transactionData.transaction);
        } else {
          console.log('Failed to parse transaction block starting at line', i + 1);
        }
        i = transactionData.nextIndex;
      } else {
        i++;
      }
    }
    
    console.log('=== OPAY PARSING COMPLETE ===');
    console.log('Found transactions:', transactions.length);
    
    return transactions;
  }

  private static parseOPayTransactionBlock(lines: string[], startIndex: number): { transaction: ExtractedTransaction | null, nextIndex: number } {
    let i = startIndex;
    const transactionLines = [];
    
    // Collect lines that might be part of this transaction (usually 3-5 lines)
    while (i < lines.length && i < startIndex + 6) {
      transactionLines.push(lines[i]);
      i++;
      
      // Stop if we hit another date pattern (start of next transaction)
      if (i < lines.length) {
        const nextLine = lines[i];
        const datePattern1 = /^(\d{4}\s+\w{3}\s+\d{1,2})\s+(\d{2}:\d{2}:\d{2})?/;
        const datePattern2 = /^(\d{1,2}\s+\w{3}\s+\d{4})/;
        if ((datePattern1.test(nextLine) || datePattern2.test(nextLine)) && i > startIndex + 1) {
          break;
        }
      }
    }
    
    // Try to parse the collected lines as a transaction
    const transaction = this.extractOPayTransaction(transactionLines);
    
    return {
      transaction,
      nextIndex: i
    };
  }

  private static extractOPayTransaction(lines: string[]): ExtractedTransaction | null {
    try {
      const fullText = lines.join(' ');
      console.log('Extracting from text:', fullText);
      
      // Look for date patterns
      const datePattern1 = /(\d{4}\s+\w{3}\s+\d{1,2})/; // 2025 Jul 14
      const datePattern2 = /(\d{1,2}\s+\w{3}\s+\d{4})/; // 14 Jul 2025
      
      let dateStr = '';
      const dateMatch1 = fullText.match(datePattern1);
      const dateMatch2 = fullText.match(datePattern2);
      
      if (dateMatch1) {
        dateStr = dateMatch1[1];
        console.log('Found date pattern 1:', dateStr);
      } else if (dateMatch2) {
        dateStr = dateMatch2[1];
        console.log('Found date pattern 2:', dateStr);
      } else {
        console.log('No date pattern found');
        return null;
      }
      
      // Parse the date
      const date = this.parseOPayDate(dateStr);
      if (!date) {
        console.log('Failed to parse date:', dateStr);
        return null;
      }
      
      // Look for amount patterns - OPay uses ₦ symbol and + for credit, - for debit
      // Also handle format without currency symbol: +76,695.00 or -76,695.00
      const amountPattern1 = /([+\-])₦([\d,]+\.?\d*)/; // With currency symbol
      const amountPattern2 = /([+\-])([\d,]+\.?\d*)/; // Without currency symbol
      
      let amountMatch = fullText.match(amountPattern1);
      if (!amountMatch) {
        amountMatch = fullText.match(amountPattern2);
      }
      
      if (!amountMatch) {
        console.log('No amount pattern found in:', fullText);
        return null;
      }
      
      const sign = amountMatch[1];
      const amountStr = amountMatch[2];
      const amount = this.parseAmount(amountStr);
      const type = sign === '+' ? 'credit' : 'debit';
      
      console.log('Extracted amount:', { sign, amountStr, amount, type });
      
      // Extract description - everything between date and amount
      let description = fullText;
      
      // Remove date part
      description = description.replace(datePattern1, '').replace(datePattern2, '');
      
      // Remove amount part
      description = description.replace(amountPattern1, '').replace(amountPattern2, '');
      
      // Remove time patterns
      description = description.replace(/\d{2}:\d{2}:\d{2}/, '');
      
      // Clean up description
      description = description.trim().replace(/\s+/g, ' ');
      
      if (!description || description.length < 3) {
        description = 'OPay Transaction';
      }
      
      return {
        date,
        description,
        amount,
        type: type as 'debit' | 'credit',
        rawData: {
          originalLines: lines,
          fullText: fullText
        }
      };
      
    } catch (error) {
      console.error('Error extracting OPay transaction:', error);
      return null;
    }
  }

  private static parseOPayDate(dateStr: string): Date | null {
    try {
      // Handle "2025 Jul 14" format
      const pattern1 = /(\d{4})\s+(\w{3})\s+(\d{1,2})/;
      const match1 = dateStr.match(pattern1);
      
      if (match1) {
        const [, year, monthName, day] = match1;
        const monthMap: { [key: string]: number } = {
          'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
          'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11
        };
        
        const month = monthMap[monthName.toLowerCase()];
        if (month !== undefined) {
          return new Date(parseInt(year), month, parseInt(day));
        }
      }
      
      // Handle "14 Jul 2025" format
      const pattern2 = /(\d{1,2})\s+(\w{3})\s+(\d{4})/;
      const match2 = dateStr.match(pattern2);
      
      if (match2) {
        const [, day, monthName, year] = match2;
        const monthMap: { [key: string]: number } = {
          'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
          'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11
        };
        
        const month = monthMap[monthName.toLowerCase()];
        if (month !== undefined) {
          return new Date(parseInt(year), month, parseInt(day));
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error parsing OPay date:', dateStr, error);
      return null;
    }
  }
}
