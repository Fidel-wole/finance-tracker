import { PrismaClient } from "../../generated/prisma";
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
        recipientId: data.recipientId,
        tags: data.tags || [],
        isRecurring: data.isRecurring || false,
        recurringId: data.recurringId,
        location: data.location,
      },
      include: {
        user: true,
        category: true,
        recipient: true,
      },
    });
  }

  async getTransactionsByUserId(userId: string) {
    return prisma.transaction.findMany({
      where: {
        userId,
      },
      include: {
        user: true,
        category: true,
        recipient: true,
      },
      orderBy: {
        date: 'desc',
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
        recipient: true,
      },
    });
  }

  async updateTransaction(id: string, params: { data: Partial<CreateTransactionInput> }) {
    const { data } = params;
    
    return prisma.transaction.update({
      where: {
        id,
      },
      data,
      include: {
        user: true,
        category: true,
        recipient: true,
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
}
