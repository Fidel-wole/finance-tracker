import OpenAI from "openai";
import { RecipientAnalysis } from "../interfaces/ai-suggestions";
import { OPENAI_API_KEY } from "../configs/env";
export default class AIService {
  private openai: OpenAI | null = null;

  constructor() {
    try {
      const apiKey = OPENAI_API_KEY;
      if (apiKey && apiKey.length > 10) {
        this.openai = new OpenAI({ apiKey });
        console.log("OpenAI client initialized successfully");
      } else {
        console.log("OpenAI API key not provided or too short");
      }
    } catch (error) {
      console.error("Failed to initialize OpenAI client:", error);
    }
  }

  async classifyRecipients(
    recipients: Array<{ name: string; totalAmount: number }>
  ): Promise<RecipientAnalysis[]> {
    console.log(
      "AIService: classifyRecipients called with",
      recipients.length,
      "recipients"
    );

    if (!this.openai) {
      throw new Error("OpenAI API key not configured");
    }

    if (recipients.length === 0) {
      return [];
    }

    const recipientNames = recipients.map((r) => r.name).join(", ");

    const prompt = `
You are a financial advisor analyzing transaction recipients. For each recipient name below, classify them as exactly one of: "restaurant", "organization", or "individual".

Use real-world context and common naming patterns:
- "restaurant": Food establishments, cafes, fast food chains (e.g., "Chicken Republic", "McDonald's", "Pizza Hut")
- "organization": Banks, utilities, companies, services, government agencies (e.g., "DSTV", "MTN", "First Bank")  
- "individual": Personal names that clearly represent people (e.g., "John Okafor", "Mary Smith", "Ahmed Hassan")

Recipients to classify: ${recipientNames}

Respond with ONLY a JSON array in this exact format, no additional text:
[
  {"name": "Chicken Republic", "classification": "restaurant"},
  {"name": "John Okafor", "classification": "individual"}
]
`;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content:
              "You are a financial classification expert. Respond only with valid JSON.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.1,
        max_tokens: 1000,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error("No response from OpenAI");
      }

      const classifications = JSON.parse(content.trim());

      // Combine with amount data
      return recipients.map((recipient) => {
        const classification = classifications.find(
          (c: any) => c.name === recipient.name
        );
        return {
          name: recipient.name,
          totalAmount: recipient.totalAmount,
          transactionCount: 1, // This will be calculated properly in the service
          classification: classification?.classification || "organization",
        };
      });
    } catch (error) {
      console.error("Error classifying recipients:", error);
      // Fallback: classify everything as organization
      return recipients.map((recipient) => ({
        name: recipient.name,
        totalAmount: recipient.totalAmount,
        transactionCount: 1,
        classification: "organization" as const,
      }));
    }
  }

  async generateSavingsSuggestions(
    recipientAnalysis: RecipientAnalysis[],
    totalSpent: number
  ): Promise<string[]> {
    if (!this.openai) {
      throw new Error("OpenAI API key not configured");
    }

    if (recipientAnalysis.length === 0) {
      return ["No transaction data available for suggestions this month."];
    }

    const analysisText = recipientAnalysis
      .map(
        (r) =>
          `${r.name} (${r.classification}): ₦${r.totalAmount.toLocaleString()}`
      )
      .join("\n");

    const prompt = `
You are a Nigerian financial advisor helping users save money. Analyze this spending data and provide 2-4 practical, actionable savings suggestions.

Monthly spending breakdown:
${analysisText}

Total analyzed: ₦${totalSpent.toLocaleString()}

Guidelines:
1. For restaurants: Suggest cooking at home, meal prep, or eating out less frequently
2. For individuals: Suggest budgeting personal transfers or setting limits
3. For organizations: Suggest ways to reduce utility bills, find better deals, or optimize subscriptions
4. Be specific with estimated savings amounts
5. Use Nigerian Naira (₦) currency
6. Keep suggestions practical and achievable
7. Focus on the top 2-3 highest spending categories

Respond with a JSON array of suggestion strings:
["suggestion 1", "suggestion 2", "suggestion 3"]
`;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content:
              "You are a Nigerian financial advisor. Provide practical money-saving advice. Respond only with a valid JSON array of strings.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 800,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error("No response from OpenAI");
      }

      return JSON.parse(content.trim());
    } catch (error) {
      console.error("Error generating suggestions:", error);
      // Fallback suggestions
      return [
        "Review your spending patterns to identify areas where you can cut costs.",
        "Consider setting a monthly budget limit for discretionary expenses.",
        "Look for opportunities to reduce recurring payments and subscriptions.",
      ];
    }
  }

  async categorizeTransaction(description: string): Promise<{ category: string; confidence: number } | null> {
    if (!this.openai) {
      return this.fallbackCategorization(description);
    }

    try {
      const prompt = `
Categorize this bank transaction description into one of these categories:
- Food & Dining
- Transportation
- Shopping
- Bills & Utilities
- Banking & Finance
- Healthcare
- Entertainment
- Education
- Travel
- Other

Transaction description: "${description}"

Respond with ONLY a JSON object in this format:
{
  "category": "category_name",
  "confidence": 0.95
}

The confidence should be between 0.0 and 1.0 based on how certain you are about the categorization.
`;

      // Add timeout to prevent hanging - reduced timeout for faster failure
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('OpenAI API timeout')), 5000); // Reduced to 5 seconds
      });

      const response = await Promise.race([
        this.openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [
            {
              role: "system",
              content: "You are a financial transaction categorization expert. Always respond with valid JSON only."
            },
            { role: "user", content: prompt }
          ],
          max_tokens: 50, // Reduced for faster response
          temperature: 0, // More deterministic
        }, {
          timeout: 4000, // OpenAI client timeout in options
        }),
        timeoutPromise
      ]) as OpenAI.Chat.Completions.ChatCompletion;

      const content = response.choices[0]?.message?.content?.trim();
      if (content) {
        const result = JSON.parse(content);
        return {
          category: result.category,
          confidence: result.confidence
        };
      }

      return this.fallbackCategorization(description);

    } catch (error) {
      console.error("Error categorizing transaction:", error);
      return this.fallbackCategorization(description);
    }
  }

  async extractMerchant(description: string): Promise<{ name: string; confidence: number } | null> {
    if (!this.openai) {
      return this.fallbackMerchantExtraction(description);
    }

    try {
      const prompt = `
Extract the merchant or business name from this transaction description:
"${description}"

Respond with ONLY a JSON object in this format:
{
  "name": "merchant_name",
  "confidence": 0.95
}

The confidence should be between 0.0 and 1.0. If no clear merchant can be identified, use "Unknown" as the name with low confidence.
`;

      // Add timeout to prevent hanging - reduced timeout for faster failure
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('OpenAI API timeout')), 5000); // Reduced to 5 seconds
      });

      const response = await Promise.race([
        this.openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [
            {
              role: "system",
              content: "You are a financial transaction analysis expert. Extract merchant names accurately. Always respond with valid JSON only."
            },
            { role: "user", content: prompt }
          ],
          max_tokens: 50, // Reduced for faster response
          temperature: 0, // More deterministic
        }, {
          timeout: 4000, // OpenAI client timeout in options
        }),
        timeoutPromise
      ]) as OpenAI.Chat.Completions.ChatCompletion;

      const content = response.choices[0]?.message?.content?.trim();
      if (content) {
        const result = JSON.parse(content);
        return {
          name: result.name,
          confidence: result.confidence
        };
      }

      return this.fallbackMerchantExtraction(description);

    } catch (error) {
      console.error("Error extracting merchant:", error);
      return this.fallbackMerchantExtraction(description);
    }
  }

  async generateStatementInsights(transactions: any[], summary: any): Promise<string[]> {
    if (!this.openai) {
      throw new Error('OpenAI API key not configured - cannot generate insights');
    }

    try {
      const debitTransactions = transactions.filter(t => t.type === 'debit');
      
      // ANALYZE WHO/WHAT IS TAKING THEIR MONEY
      
      // 1. Find top recipients/merchants (WHO they're paying)
      const recipientSpending = debitTransactions.reduce((acc, t) => {
        const recipient = t.merchant || t.description.split(' ').slice(0, 3).join(' '); // First 3 words as recipient
        acc[recipient] = (acc[recipient] || 0) + t.amount;
        return acc;
      }, {} as Record<string, number>);
      
      const topRecipients = Object.entries(recipientSpending)
        .sort(([,a], [,b]) => (b as number) - (a as number))
        .slice(0, 5)
        .map(([name, amount]) => ({ name, amount: amount as number, percentage: Math.round(((amount as number) / summary.totalExpenses) * 100) }));
      
      // 2. Find top categories (WHAT they're spending on)
      const categorySpending = debitTransactions.reduce((acc, t) => {
        const category = t.category || 'Other';
        acc[category] = (acc[category] || 0) + t.amount;
        return acc;
      }, {} as Record<string, number>);
      
      const topCategories = Object.entries(categorySpending)
        .sort(([,a], [,b]) => (b as number) - (a as number))
        .slice(0, 5)
        .map(([name, amount]) => ({ name, amount: amount as number, percentage: Math.round(((amount as number) / summary.totalExpenses) * 100) }));
      
      // 3. Find largest individual transactions (BIGGEST money drains)
      const biggestExpenses = debitTransactions
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5)
        .map(t => ({ 
          description: t.description.substring(0, 40), 
          amount: t.amount,
          percentage: Math.round((t.amount / summary.totalExpenses) * 100)
        }));

      // 4. Find frequent transfer patterns (HIGH FREQUENCY recipients)
      const transferFrequency = debitTransactions.reduce((acc, t) => {
        const recipient = t.merchant || t.description.split(' ').slice(0, 3).join(' ');
        if (!acc[recipient]) {
          acc[recipient] = { count: 0, totalAmount: 0, transactions: [] };
        }
        acc[recipient].count++;
        acc[recipient].totalAmount += t.amount;
        acc[recipient].transactions.push(t.amount);
        return acc;
      }, {} as Record<string, { count: number; totalAmount: number; transactions: number[] }>);
      
      const frequentRecipients = Object.entries(transferFrequency)
        .filter(([, data]) => (data as { count: number; totalAmount: number; transactions: number[] }).count >= 3) // 3 or more transactions
        .sort(([,a], [,b]) => (b as { count: number; totalAmount: number; transactions: number[] }).count - (a as { count: number; totalAmount: number; transactions: number[] }).count)
        .slice(0, 5)
        .map(([name, data]) => ({ 
          name, 
          count: (data as { count: number; totalAmount: number; transactions: number[] }).count, 
          totalAmount: (data as { count: number; totalAmount: number; transactions: number[] }).totalAmount,
          avgAmount: Math.round((data as { count: number; totalAmount: number; transactions: number[] }).totalAmount / (data as { count: number; totalAmount: number; transactions: number[] }).count),
          percentage: Math.round(((data as { count: number; totalAmount: number; transactions: number[] }).totalAmount / summary.totalExpenses) * 100)
        }));

      // 5. Analyze spending trends/patterns
      const monthlyAvgExpense = summary.totalExpenses / (debitTransactions.length || 1);
      const highValueThreshold = monthlyAvgExpense * 2; // Transactions 2x above average
      const highValueCount = debitTransactions.filter(t => t.amount > highValueThreshold).length;

      const prompt = `
You are analyzing someone's spending to help them understand WHERE their money goes. Focus on WHO and WHAT is taking their money.

TOTAL EXPENSES: ₦${summary.totalExpenses?.toLocaleString()}
TOTAL TRANSACTIONS: ${debitTransactions.length}

TOP RECIPIENTS (Who you pay most):
${topRecipients.map(r => `• ${r.name}: ₦${r.amount.toLocaleString()} (${r.percentage}% of total)`).join('\n')}

TOP CATEGORIES (What you spend on most):
${topCategories.map(c => `• ${c.name}: ₦${c.amount.toLocaleString()} (${c.percentage}% of total)`).join('\n')}

BIGGEST INDIVIDUAL EXPENSES:
${biggestExpenses.map(e => `• ₦${e.amount.toLocaleString()} - ${e.description} (${e.percentage}% of total)`).join('\n')}

FREQUENT TRANSFER RECIPIENTS (3+ transactions):
${frequentRecipients.map(f => `• ${f.name}: ${f.count} transfers, ₦${f.totalAmount.toLocaleString()} total (avg ₦${f.avgAmount.toLocaleString()}/transfer)`).join('\n')}

SPENDING PATTERNS:
• Average transaction: ₦${Math.round(monthlyAvgExpense).toLocaleString()}
• High-value transactions (₦${Math.round(highValueThreshold).toLocaleString()}+): ${highValueCount} transactions

Generate 5 insights that help them realize:
1. WHO takes most of their money (specific names with amounts and percentages)
2. WHAT categories dominate their spending (with amounts and percentages)
3. Biggest single expenses that drain their budget
4. Frequent transfer patterns (people/services they pay repeatedly - even small amounts add up)
5. Specific cost-cutting actions based on their patterns

Be direct and specific. Use actual amounts and percentages. Focus on both HIGH-VALUE and HIGH-FREQUENCY spending patterns.

Respond with ONLY a JSON array of 5 strings:
["insight 1", "insight 2", "insight 3", "insight 4", "insight 5"]
`;

      // Add timeout to prevent hanging - increased timeout for quality insights
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('OpenAI API timeout')), 20000); // 20 second timeout for insights
      });

      const response = await Promise.race([
        this.openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [
            {
              role: "system",
              content: "You are a professional financial advisor with expertise in personal finance analysis. Provide specific, actionable insights based on transaction data. Always respond with valid JSON array of strings only."
            },
            { role: "user", content: prompt }
          ],
          max_tokens: 800, // Increased for more detailed insights
          temperature: 0.7, // More creative for varied insights
        }, {
          timeout: 18000, // OpenAI client timeout slightly less than our timeout
        }),
        timeoutPromise
      ]) as OpenAI.Chat.Completions.ChatCompletion;

      const content = response.choices[0]?.message?.content?.trim();
      if (content) {
        const insights = JSON.parse(content);
        return Array.isArray(insights) ? insights : [content];
      }

      // Fallback to manual insights if AI fails
      return this.generateManualInsights(topRecipients, topCategories, biggestExpenses, frequentRecipients, summary);

    } catch (error) {
      console.error("Error generating statement insights:", error);
      // Generate manual insights as fallback
      const debitTransactions = transactions.filter(t => t.type === 'debit');
      
      const recipientSpending = debitTransactions.reduce((acc, t) => {
        const recipient = t.merchant || t.description.split(' ').slice(0, 3).join(' ');
        acc[recipient] = (acc[recipient] || 0) + t.amount;
        return acc;
      }, {} as Record<string, number>);
      
      const topRecipients = Object.entries(recipientSpending)
        .sort(([,a], [,b]) => (b as number) - (a as number))
        .slice(0, 5)
        .map(([name, amount]) => ({ name, amount: amount as number, percentage: Math.round(((amount as number) / summary.totalExpenses) * 100) }));
      
      const categorySpending = debitTransactions.reduce((acc, t) => {
        const category = t.category || 'Other';
        acc[category] = (acc[category] || 0) + t.amount;
        return acc;
      }, {} as Record<string, number>);
      
      const topCategories = Object.entries(categorySpending)
        .sort(([,a], [,b]) => (b as number) - (a as number))
        .slice(0, 5)
        .map(([name, amount]) => ({ name, amount: amount as number, percentage: Math.round(((amount as number) / summary.totalExpenses) * 100) }));
      
      const biggestExpenses = debitTransactions
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5)
        .map(t => ({ 
          description: t.description.substring(0, 40), 
          amount: t.amount,
          percentage: Math.round((t.amount / summary.totalExpenses) * 100)
        }));

      // Calculate frequent recipients for fallback
      const transferFrequency = debitTransactions.reduce((acc, t) => {
        const recipient = t.merchant || t.description.split(' ').slice(0, 3).join(' ');
        if (!acc[recipient]) {
          acc[recipient] = { count: 0, totalAmount: 0, transactions: [] };
        }
        acc[recipient].count++;
        acc[recipient].totalAmount += t.amount;
        acc[recipient].transactions.push(t.amount);
        return acc;
      }, {} as Record<string, { count: number; totalAmount: number; transactions: number[] }>);
      
      const frequentRecipients = Object.entries(transferFrequency)
        .filter(([, data]) => (data as { count: number; totalAmount: number; transactions: number[] }).count >= 3)
        .sort(([,a], [,b]) => (b as { count: number; totalAmount: number; transactions: number[] }).count - (a as { count: number; totalAmount: number; transactions: number[] }).count)
        .slice(0, 5)
        .map(([name, data]) => ({ 
          name, 
          count: (data as { count: number; totalAmount: number; transactions: number[] }).count, 
          totalAmount: (data as { count: number; totalAmount: number; transactions: number[] }).totalAmount,
          avgAmount: Math.round((data as { count: number; totalAmount: number; transactions: number[] }).totalAmount / (data as { count: number; totalAmount: number; transactions: number[] }).count),
          percentage: Math.round(((data as { count: number; totalAmount: number; transactions: number[] }).totalAmount / summary.totalExpenses) * 100)
        }));
      
      return this.generateManualInsights(topRecipients, topCategories, biggestExpenses, frequentRecipients, summary);
    }
  }

  // Generate insights manually when AI fails
  private generateManualInsights(topRecipients: any[], topCategories: any[], biggestExpenses: any[], frequentRecipients: any[], summary: any): string[] {
    const insights: string[] = [];
    
    // Insight 1: Top recipient/money drain (WHO)
    if (topRecipients.length > 0) {
      const topRecipient = topRecipients[0];
      insights.push(`🚨 ${topRecipient.name} is your biggest money drain at ₦${topRecipient.amount.toLocaleString()} (${topRecipient.percentage}% of total expenses). Consider if this spending is necessary or can be reduced.`);
    }
    
    // Insight 2: Top category analysis (WHAT)
    if (topCategories.length > 0) {
      const topCategory = topCategories[0];
      if (topCategories.length > 1) {
        const secondCategory = topCategories[1];
        insights.push(`💰 Your top 2 spending categories are ${topCategory.name} (₦${topCategory.amount.toLocaleString()}, ${topCategory.percentage}%) and ${secondCategory.name} (₦${secondCategory.amount.toLocaleString()}, ${secondCategory.percentage}%). These two alone consume ${topCategory.percentage + secondCategory.percentage}% of your budget.`);
      } else {
        insights.push(`💰 ${topCategory.name} dominates your spending at ₦${topCategory.amount.toLocaleString()} (${topCategory.percentage}% of total expenses). Set strict limits for this category.`);
      }
    }
    
    // Insight 3: Biggest single expense
    if (biggestExpenses.length > 0) {
      const biggestExpense = biggestExpenses[0];
      insights.push(`⚡ Your single largest expense was ₦${biggestExpense.amount.toLocaleString()} for "${biggestExpense.description}" - that's ${biggestExpense.percentage}% of your total spending in one transaction. Review if such large expenses align with your financial goals.`);
    }
    
    // Insight 4: Frequent transfer patterns (HIGH FREQUENCY)
    if (frequentRecipients.length > 0) {
      const mostFrequent = frequentRecipients[0];
      insights.push(`🔄 You transfer to ${mostFrequent.name} frequently (${mostFrequent.count} times, ₦${mostFrequent.avgAmount.toLocaleString()} average). These small but frequent transfers total ₦${mostFrequent.totalAmount.toLocaleString()} (${mostFrequent.percentage}% of expenses). Consider if these are necessary or can be consolidated.`);
    }
    
    // Insight 5: Cost-cutting action based on patterns
    if (insights.length < 5) {
      if (topRecipients.length > 2) {
        const top3Total = topRecipients.slice(0, 3).reduce((sum, r) => sum + r.amount, 0);
        const top3Percentage = Math.round((top3Total / summary.totalExpenses) * 100);
        insights.push(`📊 Your top 3 recipients (${topRecipients.slice(0, 3).map(r => r.name).join(', ')}) receive ${top3Percentage}% of your money. Focus on negotiating better rates or reducing payments to these to see significant savings.`);
      } else if (frequentRecipients.length > 1) {
        const totalFrequentTransfers = frequentRecipients.reduce((sum, r) => sum + r.totalAmount, 0);
        const freqPercentage = Math.round((totalFrequentTransfers / summary.totalExpenses) * 100);
        insights.push(`🎯 You have ${frequentRecipients.length} recipients you pay frequently. Combined, these frequent transfers represent ₦${totalFrequentTransfers.toLocaleString()} (${freqPercentage}% of expenses). Consider setting monthly limits for these recurring payments.`);
      } else {
        insights.push(`💡 Based on your spending pattern, focus on your top expense categories and largest individual transactions. Even a 10% reduction in your biggest spending areas could save you significant money.`);
      }
    }
    
    return insights.slice(0, 5); // Return exactly 5 insights
  }

  private fallbackCategorization(description: string): { category: string; confidence: number } {
    const categories = {
      'Food & Dining': ['restaurant', 'food', 'lunch', 'dinner', 'cafe', 'pizza', 'chicken', 'mcdonald', 'kfc'],
      'Transportation': ['uber', 'taxi', 'bus', 'transport', 'fuel', 'petrol', 'gas'],
      'Shopping': ['shoprite', 'mall', 'store', 'market', 'purchase', 'buy'],
      'Bills & Utilities': ['electric', 'water', 'phone', 'internet', 'dstv', 'cable', 'subscription'],
      'Banking & Finance': ['bank', 'atm', 'transfer', 'fee', 'charge', 'interest'],
      'Healthcare': ['hospital', 'clinic', 'pharmacy', 'medical', 'doctor'],
      'Entertainment': ['cinema', 'movie', 'game', 'entertainment', 'music']
    };

    const lowerDesc = description.toLowerCase();

    for (const [category, keywords] of Object.entries(categories)) {
      for (const keyword of keywords) {
        if (lowerDesc.includes(keyword)) {
          return { category, confidence: 0.7 };
        }
      }
    }

    return { category: 'Other', confidence: 0.3 };
  }

  private fallbackMerchantExtraction(description: string): { name: string; confidence: number } {
    // Simple merchant extraction - take first few meaningful words
    const words = description.trim().split(/\s+/);
    const meaningfulWords = words.filter(word => 
      word.length > 2 && 
      !['the', 'and', 'for', 'with', 'from', 'payment', 'transfer'].includes(word.toLowerCase())
    );
    
    const merchantName = meaningfulWords.slice(0, 2).join(' ');
    return {
      name: merchantName || 'Unknown',
      confidence: merchantName ? 0.5 : 0.1
    };
  }
}
