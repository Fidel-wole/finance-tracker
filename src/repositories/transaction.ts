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

  async getTransactionsByUserId(userId: string) {
    return prisma.transaction.findMany({
      where: {
        userId,
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

    // Remove userId from update data as it can't be updated directly
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
}
