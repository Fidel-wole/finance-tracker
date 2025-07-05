export interface WebhookUser {
  externalId: string;
  name: string;
  phone?: string;
  email?: string;
}

export interface WebhookTransaction {
  amount: number;
  currency: string;
  type: 'income' | 'expense' | 'transfer';
  tags: string[];
  description?: string;
  timestamp: Date;
}

export interface NormalizedWebhookPayload {
  user: WebhookUser;
  transaction: WebhookTransaction;
}

export interface PartnerConfig {
  name: string;
  secretKey: string;
  signatureHeader: string;
  signaturePrefix?: string;
}

export interface WebhookRequest {
  body: any;
  headers: { [key: string]: string };
  rawBody: Buffer;
}

// Partner-specific payload interfaces
export interface OpayWebhookPayload {
  event: string;
  data: {
    reference: string;
    amount: number;
    currency: string;
    customer: {
      id: string;
      name: string;
      email?: string;
      phone?: string;
    };
    status: string;
    type: string;
    created_at: string;
    description?: string;
  };
}

export interface KudaWebhookPayload {
  eventType: string;
  transactionData: {
    transactionId: string;
    amount: string;
    currency: string;
    accountNumber: string;
    accountName: string;
    narration?: string;
    transactionType: string;
    timestamp: string;
    phoneNumber?: string;
    email?: string;
  };
}

export interface PalmPayWebhookPayload {
  event_type: string;
  transaction: {
    id: string;
    amount: number;
    currency: string;
    user: {
      user_id: string;
      full_name: string;
      phone_number?: string;
      email_address?: string;
    };
    transaction_type: string;
    description?: string;
    created_at: string;
    tags?: string[];
  };
}
