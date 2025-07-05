import { 
  NormalizedWebhookPayload, 
  OpayWebhookPayload, 
  KudaWebhookPayload, 
  PalmPayWebhookPayload,
  WebhookUser,
  WebhookTransaction
} from '../interfaces/webhook';

export class PayloadMapper {
  /**
   * Map partner-specific payload to normalized format
   * @param partnerName - Name of the fintech partner
   * @param payload - Raw payload from partner
   * @returns Normalized webhook payload
   */
  static mapPayload(partnerName: string, payload: any): NormalizedWebhookPayload {
    const mapper = this.getMapper(partnerName.toLowerCase());
    return mapper(payload);
  }

  /**
   * Get the appropriate mapper function for a partner
   * @param partnerName - Name of the partner
   * @returns Mapper function
   */
  private static getMapper(partnerName: string): (payload: any) => NormalizedWebhookPayload {
    const mappers: { [key: string]: (payload: any) => NormalizedWebhookPayload } = {
      opay: PayloadMapper.mapOpayPayload,
      kuda: PayloadMapper.mapKudaPayload,
      palmpay: PayloadMapper.mapPalmPayPayload,
    };

    const mapper = mappers[partnerName];
    if (!mapper) {
      throw new Error(`Unsupported partner: ${partnerName}`);
    }

    return mapper;
  }

  /**
   * Map Opay webhook payload to normalized format
   */
  private static mapOpayPayload(payload: OpayWebhookPayload): NormalizedWebhookPayload {
    const { data } = payload;
    
    const user: WebhookUser = {
      externalId: data.customer.id,
      name: data.customer.name,
      phone: data.customer.phone,
      email: data.customer.email,
    };

    const transaction: WebhookTransaction = {
      amount: data.amount,
      currency: data.currency,
      type: PayloadMapper.mapOpayTransactionType(data.type, data.status),
      tags: ['opay', payload.event, data.status].filter(Boolean),
      description: data.description || `Opay ${data.type} transaction`,
      timestamp: new Date(data.created_at),
    };

    return { user, transaction };
  }

  /**
   * Map Kuda webhook payload to normalized format
   */
  private static mapKudaPayload(payload: KudaWebhookPayload): NormalizedWebhookPayload {
    const { transactionData } = payload;
    
    const user: WebhookUser = {
      externalId: transactionData.accountNumber,
      name: transactionData.accountName,
      phone: transactionData.phoneNumber,
      email: transactionData.email,
    };

    const transaction: WebhookTransaction = {
      amount: parseFloat(transactionData.amount),
      currency: transactionData.currency,
      type: PayloadMapper.mapKudaTransactionType(transactionData.transactionType),
      tags: ['kuda', payload.eventType, transactionData.transactionType].filter(Boolean),
      description: transactionData.narration || `Kuda ${transactionData.transactionType} transaction`,
      timestamp: new Date(transactionData.timestamp),
    };

    return { user, transaction };
  }

  /**
   * Map PalmPay webhook payload to normalized format
   */
  private static mapPalmPayPayload(payload: PalmPayWebhookPayload): NormalizedWebhookPayload {
    const { transaction } = payload;
    
    const user: WebhookUser = {
      externalId: transaction.user.user_id,
      name: transaction.user.full_name,
      phone: transaction.user.phone_number,
      email: transaction.user.email_address,
    };

    const webhookTransaction: WebhookTransaction = {
      amount: transaction.amount,
      currency: transaction.currency,
      type: PayloadMapper.mapPalmPayTransactionType(transaction.transaction_type),
      tags: [...(transaction.tags || []), 'palmpay', payload.event_type].filter(Boolean),
      description: transaction.description || `PalmPay ${transaction.transaction_type} transaction`,
      timestamp: new Date(transaction.created_at),
    };

    return { user, transaction: webhookTransaction };
  }

  /**
   * Map Opay transaction types to normalized types
   */
  private static mapOpayTransactionType(type: string, status: string): 'income' | 'expense' | 'transfer' {
    const typeMap: { [key: string]: 'income' | 'expense' | 'transfer' } = {
      'payment': status === 'successful' ? 'income' : 'expense',
      'transfer': 'transfer',
      'withdrawal': 'expense',
      'deposit': 'income',
      'refund': 'income',
    };

    return typeMap[type.toLowerCase()] || 'income';
  }

  /**
   * Map Kuda transaction types to normalized types
   */
  private static mapKudaTransactionType(type: string): 'income' | 'expense' | 'transfer' {
    const typeMap: { [key: string]: 'income' | 'expense' | 'transfer' } = {
      'credit': 'income',
      'debit': 'expense',
      'transfer_in': 'income',
      'transfer_out': 'expense',
      'internal_transfer': 'transfer',
    };

    return typeMap[type.toLowerCase()] || 'income';
  }

  /**
   * Map PalmPay transaction types to normalized types
   */
  private static mapPalmPayTransactionType(type: string): 'income' | 'expense' | 'transfer' {
    const typeMap: { [key: string]: 'income' | 'expense' | 'transfer' } = {
      'payment_received': 'income',
      'payment_sent': 'expense',
      'transfer': 'transfer',
      'cashback': 'income',
      'fee': 'expense',
      'refund': 'income',
    };

    return typeMap[type.toLowerCase()] || 'income';
  }

  /**
   * Validate that required fields are present in normalized payload
   */
  static validateNormalizedPayload(payload: NormalizedWebhookPayload): void {
    const { user, transaction } = payload;

    if (!user.externalId) {
      throw new Error('Missing required field: user.externalId');
    }

    if (!user.name) {
      throw new Error('Missing required field: user.name');
    }

    if (!transaction.amount || transaction.amount <= 0) {
      throw new Error('Invalid transaction amount');
    }

    if (!transaction.currency) {
      throw new Error('Missing required field: transaction.currency');
    }

    if (!['income', 'expense', 'transfer'].includes(transaction.type)) {
      throw new Error('Invalid transaction type');
    }

    if (!transaction.timestamp || isNaN(transaction.timestamp.getTime())) {
      throw new Error('Invalid transaction timestamp');
    }
  }
}
