import { Decimal } from "decimal.js";
import TransactionRepository from "../repositories/transaction";
import UserRepository from "../repositories/user";
import { Recipient } from "../interfaces/transaction";

interface MonthlySummary {
  totalSpent: number;
  totalIncome: number;
  burnRate: number;
  topCategories: Array<{
    name: string;
    amount: number;
    count: number;
  }>;
}

interface TopRecipient {
  name: string;
  totalAmount: number;
  transactionCount: number;
  account_number?: string;
  bank_code?: string;
}

export default class UserAnalyticsService {
  private transactionRepository: TransactionRepository;
  private userRepository: UserRepository;

  constructor() {
    this.transactionRepository = new TransactionRepository();
    this.userRepository = new UserRepository();
  }

  async getUserTransactions(
    userId: string,
    options?: {
      type?: string;
      limit?: number;
    }
  ) {
    // Verify user exists
    const user = await this.userRepository.getUserById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    const transactions = await this.transactionRepository.getUserTransactionsWithFilters(
      userId,
      options
    );

    return {
      transactions: transactions.map(transaction => ({
        id: transaction.id,
        amount: Number(transaction.amount),
        type: transaction.type,
        description: transaction.description,
        notes: transaction.notes,
        date: transaction.date,
        category: transaction.category ? {
          id: transaction.category.id,
          name: transaction.category.name,
          color: transaction.category.color,
          icon: transaction.category.icon
        } : null,
        recipient: transaction.recipient,
        tags: transaction.tags,
        location: transaction.location,
        createdAt: transaction.createdAt
      })),
      count: transactions.length
    };
  }

  async getUserMonthlySummary(userId: string): Promise<MonthlySummary> {
    // Verify user exists
    const user = await this.userRepository.getUserById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    const transactions = await this.transactionRepository.getUserMonthlySummary(
      userId,
      currentYear,
      currentMonth
    );

    // Calculate totals
    let totalSpent = 0;
    let totalIncome = 0;
    const categoryTotals = new Map<string, { amount: number; count: number; name: string }>();

    transactions.forEach(transaction => {
      const amount = Number(transaction.amount);
      
      if (transaction.type === "expense") {
        totalSpent += amount;
      } else if (transaction.type === "income") {
        totalIncome += amount;
      }

      // Track category spending
      if (transaction.category) {
        const categoryId = transaction.category.id;
        const existing = categoryTotals.get(categoryId) || { 
          amount: 0, 
          count: 0, 
          name: transaction.category.name 
        };
        
        categoryTotals.set(categoryId, {
          amount: existing.amount + amount,
          count: existing.count + 1,
          name: existing.name
        });
      }
    });

    // Calculate burn rate (daily average spending)
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
    const burnRate = totalSpent / daysInMonth;

    // Get top 5 categories by spending
    const topCategories = Array.from(categoryTotals.values())
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5)
      .map(cat => ({
        name: cat.name,
        amount: cat.amount,
        count: cat.count
      }));

    return {
      totalSpent,
      totalIncome,
      burnRate,
      topCategories
    };
  }

  async getTopRecipients(userId: string): Promise<TopRecipient[]> {
    // Verify user exists
    const user = await this.userRepository.getUserById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    const transactions = await this.transactionRepository.getTopRecipients(userId);

    // Aggregate recipients
    const recipientMap = new Map<string, {
      totalAmount: number;
      count: number;
      recipient: Recipient;
    }>();

    transactions.forEach(transaction => {
      if (transaction.recipient) {
        const recipient = transaction.recipient as unknown as Recipient;
        const key = recipient.name.toLowerCase().trim();
        const amount = Number(transaction.amount);

        const existing = recipientMap.get(key) || {
          totalAmount: 0,
          count: 0,
          recipient
        };

        recipientMap.set(key, {
          totalAmount: existing.totalAmount + amount,
          count: existing.count + 1,
          recipient: existing.recipient
        });
      }
    });

    // Sort by total amount and return top 5
    return Array.from(recipientMap.values())
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .slice(0, 5)
      .map(item => ({
        name: item.recipient.name,
        totalAmount: item.totalAmount,
        transactionCount: item.count,
        account_number: item.recipient.account_number,
        bank_code: item.recipient.bank_code
      }));
  }
}
