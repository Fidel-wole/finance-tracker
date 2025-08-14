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
      // OPay should be checked first and with more specific patterns
      opay: ['OPay', 'OWealth Balance', 'Blue Ridge Microfinance', 'Wallet Account & Savings Account'],
      gtbank: ['Guaranty Trust Bank', 'GTBank', 'gtb'],
      access: ['Access Bank', 'Diamond Bank'],
      firstbank: ['First Bank', 'FirstBank'],
      zenith: ['Zenith Bank'],
      uba: ['United Bank for Africa', 'UBA Bank', ' UBA '], // More specific UBA patterns
      fidelity: ['Fidelity Bank'],
      wema: ['Wema Bank'],
      union: ['Union Bank']
    };

    const lowerText = text.toLowerCase();
    
    console.log('=== BANK DETECTION DEBUG ===');
    console.log('Text sample for detection:', text.substring(0, 1000));
    
    // Check OPay patterns first with higher priority
    console.log('Checking OPay patterns...');
    for (const indicator of bankIndicators.opay) {
      const found = lowerText.includes(indicator.toLowerCase());
      console.log(`  "${indicator}": ${found}`);
      if (found) {
        console.log('Detected bank: opay');
        return 'opay';
      }
    }
    
    // Then check other banks
    for (const [bank, indicators] of Object.entries(bankIndicators)) {
      if (bank === 'opay') continue; // Already checked above
      
      console.log(`Checking ${bank} patterns...`);
      for (const indicator of indicators) {
        const found = lowerText.includes(indicator.toLowerCase());
        console.log(`  "${indicator}": ${found}`);
        if (found) {
          console.log(`Detected bank: ${bank}`);
          return bank;
        }
      }
    }
    
    console.log('No bank patterns matched, using generic parser');
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
    lines.slice(0, 25).forEach((line, i) => {
      console.log(`Line ${i + 1}: "${line}"`);
    });
    
    // Look for the transaction table header specific to OPay format
    let transactionSectionStart = -1;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase();
      // Look for the exact header pattern: "Trans. Time Value Date Description Debit/Credit Balance(₦) Channel Transaction Reference"
      if ((line.includes('trans') && line.includes('time') && line.includes('value') && line.includes('date')) ||
          (line.includes('transaction') && line.includes('reference')) ||
          (line.includes('debit') && line.includes('credit') && line.includes('balance'))) {
        transactionSectionStart = i;
        console.log(`Found transaction table header at line ${i + 1}: "${lines[i]}"`);
        break;
      }
    }
    
    if (transactionSectionStart === -1) {
      console.log('No transaction table header found, scanning all lines for transactions...');
      transactionSectionStart = 0;
    }
    
    // Process lines after the header, looking for OPay transaction format
    for (let i = transactionSectionStart + 1; i < lines.length; i++) {
      const line = lines[i];
      
      // Skip empty lines and summary sections
      if (!line || line.length < 20 || 
          line.toLowerCase().includes('summary') ||
          line.toLowerCase().includes('total') ||
          line.toLowerCase().includes('opening') ||
          line.toLowerCase().includes('closing') ||
          line.toLowerCase().includes('note:')) {
        continue;
      }
      
      // OPay transaction line format (actual format from logs):
      // "2025 Aug 13 18:21:5013 Aug 2025Mobile Data-500.001,025.79E-Channel250813110100427972073969"
      // Format: TransTime + ValueDate + Description + Amount + Balance + Channel + Reference (NO SPACES!)
      
      // Pattern for OPay concatenated format - we need to carefully extract each field
      // TransTime: "2025 Aug 13 18:21:50" (19 chars)
      // ValueDate: "13 Aug 2025" (11 chars) 
      // Then Description, Amount, Balance, Channel, Reference
      const opayPattern = /(\d{4}\s+\w{3}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})(\d{1,2}\s+\w{3}\s+\d{4})(.+?)([+\-][\d,]+\.?\d*)([\d,]+\.?\d*)([A-Za-z\-]+)([\d]+)$/;
      
      // More flexible pattern for variations
      const opayFlexiblePattern = /(\d{4}\s+\w{3}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})(\d{1,2}\s+\w{3}\s+\d{4})(.+?)([+\-][\d,]+\.?\d*)([\d,]+\.?\d*)(.+?)$/;
      
      let match = line.match(opayPattern) || line.match(opayFlexiblePattern);
      
      if (match) {
        console.log(`Found OPay transaction at line ${i + 1}: "${line}"`);
        console.log('Match groups:', match);
        
        try {
          const transTime = match[1]; // e.g., "2025 Aug 13 18:21:50"
          const valueDate = match[2]; // e.g., "13 Aug 2025"
          let description = match[3]?.trim(); // e.g., "Mobile Data"
          const amountStr = match[4]; // e.g., "-500.00"
          const balanceStr = match[5]; // e.g., "1,025.79"
          
          // For the main pattern, extract channel and reference separately
          let channel = 'E-Channel';
          let reference = '';
          
          if (match.length >= 8) {
            // Full pattern matched
            channel = match[6] || 'E-Channel';
            reference = match[7] || '';
          } else if (match.length >= 7) {
            // Flexible pattern - last part contains channel + reference
            const remaining = match[6] || '';
            // Try to extract channel and reference from remaining text
            const channelMatch = remaining.match(/^([A-Za-z\-]+)/);
            if (channelMatch) {
              channel = channelMatch[1];
              reference = remaining.substring(channelMatch[1].length);
            }
          }
          
          // Clean up description - remove any trailing numbers or channel info that got mixed in
          if (description) {
            // Remove trailing numbers, E-Channel, etc.
            description = description.replace(/E-Channel.*$/, '').replace(/\d{10,}.*$/, '').trim();
            
            // If description is too short, try to extract more meaningful text
            if (description.length < 3) {
              // Look for common transaction types
              if (line.toLowerCase().includes('mobile data')) description = 'Mobile Data';
              else if (line.toLowerCase().includes('transfer')) description = 'Transfer';
              else if (line.toLowerCase().includes('payment')) description = 'Payment';
              else if (line.toLowerCase().includes('airtime')) description = 'Airtime';
              else description = 'OPay Transaction';
            }
          } else {
            description = 'OPay Transaction';
          }
          
          // Parse the value date (more reliable than trans time)
          const date = this.parseOPayDate(valueDate);
          if (!date) {
            console.log('Failed to parse date:', valueDate);
            continue;
          }
          
          if (!description || description.length < 2) {
            console.log('Invalid description after cleaning:', description);
            continue;
          }
          
          // Parse amount and determine type
          const isCredit = amountStr.startsWith('+');
          const amount = this.parseAmount(amountStr.replace(/[+\-]/g, ''));
          const balance = this.parseAmount(balanceStr);
          
          if (amount > 0) {
            const transaction = {
              date,
              description,
              amount,
              type: isCredit ? 'credit' : 'debit' as 'debit' | 'credit',
              balance,
              reference: reference || undefined,
              rawData: { 
                line, 
                bank: 'opay',
                transTime,
                valueDate,
                amountStr,
                balanceStr,
                channel
              }
            };
            
            transactions.push(transaction);
            console.log('Added OPay transaction:', transaction);
          } else {
            console.log('Invalid amount:', amountStr);
          }
          
        } catch (error) {
          console.error('Error parsing OPay transaction line:', line, error);
        }
      } else {
        // Check if line contains date pattern - might be a transaction we're missing
        if (/\d{4}\s+\w{3}\s+\d{1,2}/.test(line) || /\d{1,2}\s+\w{3}\s+\d{4}/.test(line)) {
          console.log(`Line with date pattern but no match at line ${i + 1}: "${line}"`);
        }
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
      
      // Look for date patterns - OPay supports multiple formats
      const datePattern1 = /(\d{4}\s+\w{3}\s+\d{1,2})/; // 2025 Jul 14
      const datePattern2 = /(\d{1,2}\s+\w{3}\s+\d{4})/; // 14 Jul 2025
      const datePattern3 = /(\d{1,2}\/\d{1,2}\/\d{4})/; // 14/07/2025
      const datePattern4 = /(\d{4}-\d{2}-\d{2})/; // 2025-07-14
      
      let dateStr = '';
      let dateFormat = '';
      
      const dateMatch1 = fullText.match(datePattern1);
      const dateMatch2 = fullText.match(datePattern2);
      const dateMatch3 = fullText.match(datePattern3);
      const dateMatch4 = fullText.match(datePattern4);
      
      if (dateMatch1) {
        dateStr = dateMatch1[1];
        dateFormat = 'yyyy MMM d';
        console.log('Found date pattern 1:', dateStr);
      } else if (dateMatch2) {
        dateStr = dateMatch2[1];
        dateFormat = 'd MMM yyyy';
        console.log('Found date pattern 2:', dateStr);
      } else if (dateMatch3) {
        dateStr = dateMatch3[1];
        dateFormat = 'd/M/yyyy';
        console.log('Found date pattern 3:', dateStr);
      } else if (dateMatch4) {
        dateStr = dateMatch4[1];
        dateFormat = 'yyyy-MM-dd';
        console.log('Found date pattern 4:', dateStr);
      } else {
        console.log('No date pattern found');
        return null;
      }
      
      // Parse the date
      const date = this.parseOPayDate(dateStr, dateFormat);
      if (!date) {
        console.log('Failed to parse date:', dateStr);
        return null;
      }
      
      // Look for amount patterns - OPay uses various formats
      const amountPatterns = [
        /([+\-])₦([\d,]+\.?\d*)/,        // +₦76,695.00
        /₦([+\-])([\d,]+\.?\d*)/,        // ₦+76,695.00
        /([+\-])([\d,]+\.?\d*)/,         // +76,695.00
        /(₦[\d,]+\.?\d*)\s*(DR|CR)/i,    // ₦76,695.00 DR
        /([\d,]+\.?\d*)\s*(DR|CR)/i      // 76,695.00 DR
      ];
      
      let amountMatch = null;
      let amountPattern = null;
      
      for (const pattern of amountPatterns) {
        amountMatch = fullText.match(pattern);
        if (amountMatch) {
          amountPattern = pattern;
          console.log('Found amount with pattern:', pattern.toString(), 'Match:', amountMatch);
          break;
        }
      }
      
      if (!amountMatch) {
        console.log('No amount pattern found in:', fullText);
        return null;
      }
      
      let amount = 0;
      let type: 'debit' | 'credit' = 'debit';
      
      // Parse amount based on which pattern matched
      if (amountPattern === amountPatterns[0] || amountPattern === amountPatterns[1] || amountPattern === amountPatterns[2]) {
        // Pattern with +/- sign
        const sign = amountMatch[1] === '+' ? '+' : '-';
        const amountStr = amountMatch[2] || amountMatch[1];
        amount = this.parseAmount(amountStr);
        type = sign === '+' ? 'credit' : 'debit';
      } else {
        // Pattern with DR/CR
        const amountStr = amountMatch[1];
        const drCr = amountMatch[2].toUpperCase();
        amount = this.parseAmount(amountStr);
        type = drCr === 'CR' ? 'credit' : 'debit';
      }
      
      console.log('Extracted amount:', { amount, type });
      
      // Extract description - everything between date and amount
      let description = fullText;
      
      // Remove date parts
      description = description.replace(datePattern1, '').replace(datePattern2, '')
        .replace(datePattern3, '').replace(datePattern4, '');
      
      // Remove amount parts
      for (const pattern of amountPatterns) {
        description = description.replace(pattern, '');
      }
      
      // Remove time patterns
      description = description.replace(/\d{2}:\d{2}:\d{2}/, '');
      
      // Remove common OPay keywords
      description = description.replace(/\b(transaction|transfer|payment|wallet|opay)\b/gi, '');
      
      // Clean up description
      description = description.trim().replace(/\s+/g, ' ');
      
      if (!description || description.length < 3) {
        description = 'OPay Transaction';
      }
      
      return {
        date,
        description,
        amount,
        type,
        rawData: {
          originalLines: lines,
          fullText: fullText,
          dateFormat,
          amountPattern: amountPattern?.toString()
        }
      };
      
    } catch (error) {
      console.error('Error extracting OPay transaction:', error);
      return null;
    }
  }

  private static parseOPayDate(dateStr: string, format?: string): Date | null {
    try {
      // Handle different date formats based on the format parameter
      if (format === 'd/M/yyyy') {
        // Handle "14/07/2025" format
        const parts = dateStr.split('/');
        if (parts.length === 3) {
          const day = parseInt(parts[0]);
          const month = parseInt(parts[1]) - 1; // JavaScript months are 0-indexed
          const year = parseInt(parts[2]);
          return new Date(year, month, day);
        }
      }
      
      if (format === 'yyyy-MM-dd') {
        // Handle "2025-07-14" format
        const date = new Date(dateStr);
        return isValid(date) ? date : null;
      }
      
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
