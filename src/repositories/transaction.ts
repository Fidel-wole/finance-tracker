import { PrismaClient, Prisma } from "../../generated/prisma";
import { CreateTransactionInput } from "../interfaces/transaction";

const prisma = new PrismaClient();

export default class TransactionRepository {
  async createTransaction(params: { data: CreateTransactionInput }) {
    const { data } = params;

    return prisma.transaction.create({
      data: {
        amount: data.amount,
        type: data.type,
        description: data.description,
        notes: data.notes,
        date: data.date,
        userId: data.userId,
        categoryId: data.categoryId,
        recipient: data.recipient
          ? JSON.parse(JSON.stringify(data.recipient))
          : undefined,
        tags: data.tags || [],
        isRecurring: data.isRecurring || false,
        recurringId: data.recurringId,
        location: data.location,
      },
      include: {
        user: true,
        category: true,
      },
    });
  }

  async getUsertransactions(userId: string, startDate?: Date, endDate?: Date) {
    return prisma.transaction.findMany({
      where: {
        userId,
        createdAt: {
          gte: startDate || new Date("1970-01-01"),
          lte: endDate || new Date(),
        },
      },
      include: {
        user: true,
        category: true,
      },
      orderBy: {
        date: "desc",
      },
    });
  }

  async getTransactionById(id: string) {
    return prisma.transaction.findUnique({
      where: {
        id,
      },
      include: {
        user: true,
        category: true,
      },
    });
  }

  async updateTransaction(
    id: string,
    params: { data: Partial<CreateTransactionInput> }
  ) {
    const { data } = params;

    const { userId, categoryId, recipient, ...updateData } = data;

    return prisma.transaction.update({
      where: {
        id,
      },
      data: {
        ...updateData,
        ...(categoryId && { category: { connect: { id: categoryId } } }),
        ...(recipient && { recipient: JSON.parse(JSON.stringify(recipient)) }),
      },
      include: {
        user: true,
        category: true,
      },
    });
  }

  async deleteTransaction(id: string) {
    return prisma.transaction.delete({
      where: {
        id,
      },
    });
  }


  async getUserTransactionsWithFilters(
    userId: string,
    options?: {
      type?: string;
      limit?: number;
      startDate?: Date;
      endDate?: Date;
    }
  ) {
    return prisma.transaction.findMany({
      where: {
        userId,
        ...(options?.type && { type: options.type }),
        ...(options?.startDate && options?.endDate && {
          date: {
            gte: options.startDate,
            lte: options.endDate,
          },
        }),
      },
      include: {
        user: true,
        category: true,
      },
      orderBy: {
        date: "desc",
      },
      ...(options?.limit && { take: options.limit }),
    });
  }

  async getUserMonthlySummary(userId: string, year: number, month: number) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    return prisma.transaction.findMany({
      where: {
        userId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        category: true,
      },
    });
  }

  async getTopRecipients(userId: string, limit: number = 5) {
    // Get all transactions with recipients for the user
    const transactions = await prisma.transaction.findMany({
      where: {
        userId,
        recipient: {
          not: Prisma.JsonNull
        }
      },
      select: {
        amount: true,
        recipient: true,
        type: true,
      },
    });

    return transactions;
  }

  async getMonthlyRecipientsAnalysis(userId: string, year: number, month: number) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const transactions = await prisma.transaction.findMany({
      where: {
        userId,
        date: {
          gte: startDate,
          lte: endDate
        },
        recipient: {
          not: Prisma.JsonNull
        }
      },
      select: {
        amount: true,
        recipient: true,
        type: true,
      },
    });

    return transactions;
  }
}
