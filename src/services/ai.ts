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

      // Add timeout to prevent hanging
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('OpenAI API timeout')), 8000); // 8 second timeout
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
          max_tokens: 100,
          temperature: 0.1,
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

      // Add timeout to prevent hanging
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('OpenAI API timeout')), 8000); // 8 second timeout
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
          max_tokens: 100,
          temperature: 0.1,
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
      return this.fallbackStatementInsights(transactions, summary);
    }

    try {
      const totalTransactions = transactions.length;
      const avgTransactionAmount = totalTransactions > 0 ? summary.totalExpenses / totalTransactions : 0;
      
      // Sample some transactions for analysis
      const sampleTransactions = transactions.slice(0, 10).map(t => ({
        description: t.description,
        amount: t.amount,
        type: t.type,
        category: t.category
      }));

      const prompt = `
Analyze this bank statement data and provide 3-5 personalized financial insights:

Summary:
- Total transactions: ${totalTransactions}
- Total income: ₦${summary.totalIncome?.toLocaleString()}
- Total expenses: ₦${summary.totalExpenses?.toLocaleString()}
- Net cash flow: ₦${summary.netCashFlow?.toLocaleString()}
- Average transaction: ₦${avgTransactionAmount?.toLocaleString()}

Sample transactions:
${JSON.stringify(sampleTransactions, null, 2)}

Provide insights about:
- Spending patterns
- Areas for improvement
- Positive financial behaviors
- Budget recommendations

Respond with a JSON array of strings:
["insight 1", "insight 2", "insight 3"]
`;

      // Add timeout to prevent hanging - increased for large datasets
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('OpenAI API timeout')), 15000); // 15 second timeout for insights
      });

      const response = await Promise.race([
        this.openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [
            {
              role: "system",
              content: "You are a financial advisor providing personalized insights based on bank statement analysis. Always respond with valid JSON array of strings."
            },
            { role: "user", content: prompt }
          ],
          max_tokens: 500,
          temperature: 0.3,
        }),
        timeoutPromise
      ]) as OpenAI.Chat.Completions.ChatCompletion;

      const content = response.choices[0]?.message?.content?.trim();
      if (content) {
        const insights = JSON.parse(content);
        return Array.isArray(insights) ? insights : [content];
      }

      return this.fallbackStatementInsights(transactions, summary);

    } catch (error) {
      console.error("Error generating statement insights:", error);
      return this.fallbackStatementInsights(transactions, summary);
    }
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

  private fallbackStatementInsights(transactions: any[], summary: any): string[] {
    const insights = [];

    if (summary.netCashFlow > 0) {
      insights.push(`Great job! You had a positive cash flow of ₦${summary.netCashFlow?.toLocaleString()} during this period.`);
    } else {
      insights.push(`Your expenses exceeded income by ₦${Math.abs(summary.netCashFlow)?.toLocaleString()}. Consider reviewing your spending.`);
    }

    if (summary.totalExpenses > summary.totalIncome * 0.8) {
      insights.push('Your expenses are quite high relative to your income. Consider looking for areas to reduce spending.');
    }

    if (transactions.length > 100) {
      insights.push('You have a high number of transactions. Consider consolidating purchases to better track spending.');
    }

    const expenseTransactions = transactions.filter(t => t.type === 'debit');
    if (expenseTransactions.length > 0) {
      const avgExpense = expenseTransactions.reduce((sum, t) => sum + t.amount, 0) / expenseTransactions.length;
      insights.push(`Your average expense transaction is ₦${avgExpense?.toLocaleString()}. Consider setting limits for daily spending.`);
    }

    return insights.slice(0, 5); // Return up to 5 insights
  }
}
