import TransactionRepository from "../repositories/transaction";
import UserRepository from "../repositories/user";
import AIService from "./ai";
import { AISuggestionRequest, AISuggestionResponse, RecipientAnalysis } from "../interfaces/ai-suggestions";
import { Recipient } from "../interfaces/transaction";

export default class AISuggestionsService {
  private transactionRepository: TransactionRepository;
  private userRepository: UserRepository;
  private aiService: AIService;

  constructor() {
    this.transactionRepository = new TransactionRepository();
    this.userRepository = new UserRepository();
    this.aiService = new AIService();
  }

  async generateSuggestions(request: AISuggestionRequest): Promise<AISuggestionResponse> {
    const { userId, year, month } = request;

    const user = await this.userRepository.getUserById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Use current month if not specified
    const now = new Date();
    const targetYear = year || now.getFullYear();
    const targetMonth = month || (now.getMonth() + 1);

    // Step 1: Fetch user's transactions for the specified month
    const transactions = await this.transactionRepository.getMonthlyRecipientsAnalysis(
      userId,
      targetYear,
      targetMonth
    );

    if (transactions.length === 0) {
      return {
        suggestions: ["No transactions found for this month. Start tracking your expenses to get personalized suggestions!"],
        totalAnalyzed: 0,
        monthYear: `${targetMonth}/${targetYear}`
      };
    }

    // Step 2: Group transactions by recipient.name and sum total amount per recipient
    const recipientMap = new Map<string, { totalAmount: number; count: number }>();

    transactions.forEach(transaction => {
      if (transaction.recipient) {
        const recipient = transaction.recipient as unknown as Recipient;
        const key = recipient.name.toLowerCase().trim();
        const amount = Number(transaction.amount);

        const existing = recipientMap.get(key) || { totalAmount: 0, count: 0 };
        recipientMap.set(key, {
          totalAmount: existing.totalAmount + amount,
          count: existing.count + 1
        });
      }
    });

    // Step 3: Identify top 3-5 recipients by spend amount
    const topRecipients = Array.from(recipientMap.entries())
      .map(([name, data]) => ({
        name: this.capitalizeRecipientName(name),
        totalAmount: data.totalAmount,
        transactionCount: data.count
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .slice(0, 5);

    if (topRecipients.length === 0) {
      return {
        suggestions: ["No recipients found in transactions. Most transactions seem to be without recipient information."],
        totalAnalyzed: 0,
        monthYear: `${targetMonth}/${targetYear}`
      };
    }

    // Step 4: Use OpenAI to classify each recipient
    const classifiedRecipients = await this.aiService.classifyRecipients(topRecipients);

    // Update with correct transaction counts
    const recipientAnalysis: RecipientAnalysis[] = classifiedRecipients.map(classified => {
      const original = topRecipients.find(r => r.name === classified.name);
      return {
        ...classified,
        transactionCount: original?.transactionCount || 1
      };
    });

    // Step 5: Calculate total analyzed amount
    const totalAnalyzed = recipientAnalysis.reduce((sum, r) => sum + r.totalAmount, 0);

    // Step 6: Send to OpenAI again to generate intelligent savings suggestions
    const suggestions = await this.aiService.generateSavingsSuggestions(recipientAnalysis, totalAnalyzed);

    return {
      suggestions,
      totalAnalyzed,
      monthYear: `${targetMonth}/${targetYear}`
    };
  }

  private capitalizeRecipientName(name: string): string {
    return name
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }
}
