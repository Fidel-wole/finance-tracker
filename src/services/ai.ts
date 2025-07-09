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
}
