export interface Transaction {
  id: string;
  amount: number;
  type: 'income' | 'expense' | 'transfer';
  description?: string;
  notes?: string;
  date: Date;
  userId: string;
  categoryId?: string;
  recipientId?: string;
  tags: string[];
  isRecurring: boolean;
  recurringId?: string;
  location?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTransactionInput {
  amount: number;
  type: 'income' | 'expense' | 'transfer';
  description?: string;
  notes?: string;
  date: Date;
  userId: string;
  categoryId?: string;
  recipientId?: string;
  tags?: string[];
  isRecurring?: boolean;
  recurringId?: string;
  location?: string;
}
