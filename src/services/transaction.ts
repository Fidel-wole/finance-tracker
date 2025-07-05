import { CreateTransactionInput } from "../interfaces/transaction";
import TransactionRepository from "../repositories/transaction";

export default class TransactionService {
  private transactionRepository: TransactionRepository;
  
  constructor() {
    this.transactionRepository = new TransactionRepository();
  }

  async createTransaction(input: CreateTransactionInput) {
    return this.transactionRepository.createTransaction({
      data: input,
    });
  }

  async getTransactionsByUserId(userId: string) {
    return this.transactionRepository.getTransactionsByUserId(userId);
  }

  async getTransactionById(id: string) {
    return this.transactionRepository.getTransactionById(id);
  }

  async updateTransaction(id: string, input: Partial<CreateTransactionInput>) {
    return this.transactionRepository.updateTransaction(id, {
      data: input,
    });
  }

  async deleteTransaction(id: string) {
    return this.transactionRepository.deleteTransaction(id);
  }
}
