import { NormalizedWebhookPayload, WebhookRequest } from '../interfaces/webhook';
import { WebhookVerifier } from '../utils/webhook-verifier';
import { PayloadMapper } from '../utils/payload-mapper';
import PartnerService from './partner';
import UserService from './user';
import TransactionService from './transaction';

export default class WebhookService {
  private userService: UserService;
  private transactionService: TransactionService;

  constructor() {
    this.userService = new UserService();
    this.transactionService = new TransactionService();
  }

  /**
   * Process webhook from a specific partner
   * @param partnerName - Name of the fintech partner
   * @param request - Webhook request object
   * @returns Processing result
   */
  async processWebhook(partnerName: string, request: WebhookRequest): Promise<{
    success: boolean;
    message: string;
    data?: any;
  }> {
    try {
      // Validate partner support
      if (!PartnerService.isPartnerSupported(partnerName)) {
        return {
          success: false,
          message: `Unsupported partner: ${partnerName}`,
        };
      }

      // Get partner configuration
      const partnerConfig = PartnerService.getPartnerConfig(partnerName);
      if (!partnerConfig) {
        return {
          success: false,
          message: `Partner configuration not found: ${partnerName}`,
        };
      }

      // Verify webhook signature
      const isSignatureValid = WebhookVerifier.verifySignature(request, partnerConfig);
      if (!isSignatureValid) {
        return {
          success: false,
          message: 'Invalid webhook signature',
        };
      }

      // Map payload to normalized format
      const normalizedPayload = PayloadMapper.mapPayload(partnerName, request.body);
      
      // Validate normalized payload
      PayloadMapper.validateNormalizedPayload(normalizedPayload);

      // Process the webhook data
      const result = await this.processNormalizedWebhook(normalizedPayload, partnerName);

      return {
        success: true,
        message: 'Webhook processed successfully',
        data: result,
      };

    } catch (error) {
      console.error(`Webhook processing error for ${partnerName}:`, error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Process normalized webhook payload
   * @param payload - Normalized webhook payload
   * @param partnerName - Name of the partner
   * @returns Processing result with user and transaction data
   */
  private async processNormalizedWebhook(
    payload: NormalizedWebhookPayload, 
    partnerName: string
  ): Promise<{
    user: any;
    transaction: any;
  }> {
    const { user: webhookUser, transaction: webhookTransaction } = payload;

    // Upsert user
    const user = await this.upsertUser(webhookUser, partnerName);
    
    // Create transaction
    const transaction = await this.createTransaction(webhookTransaction, user.id, partnerName);

    return { user, transaction };
  }

  /**
   * Upsert user based on webhook data
   * @param webhookUser - User data from webhook
   * @param partnerName - Name of the partner
   * @returns Created or updated user
   */
  private async upsertUser(webhookUser: any, partnerName: string): Promise<any> {
    // Split name into first and last name
    const nameParts = webhookUser.name.trim().split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    // Create user input with external ID as a tag or in notes
    const userInput = {
      firstName,
      lastName,
      email: webhookUser.email || `${webhookUser.externalId}@${partnerName}.external`,
      phoneNumber: webhookUser.phone || '',
    };

    // Try to find existing user by email or phone
    const existingUser = await this.findExistingUser(userInput);
    
    if (existingUser) {
      // Update existing user if needed
      return await this.userService.updateUser(existingUser.id, userInput);
    } else {
      // Create new user
      return await this.userService.createUser(userInput);
    }
  }

  /**
   * Find existing user by email or phone number
   * @param userInput - User input data
   * @returns Existing user or null
   */
  private async findExistingUser(userInput: any): Promise<any | null> {
    try {
      // This would depend on your user service implementation
      // For now, we'll assume the user service has a findByEmailOrPhone method
      return await this.userService.findByEmailOrPhone(userInput.email, userInput.phoneNumber);
    } catch (error) {
      // If user doesn't exist or method doesn't exist, return null
      return null;
    }
  }

  /**
   * Create transaction from webhook data
   * @param webhookTransaction - Transaction data from webhook
   * @param userId - ID of the associated user
   * @param partnerName - Name of the partner
   * @returns Created transaction
   */
  private async createTransaction(webhookTransaction: any, userId: string, partnerName: string): Promise<any> {
    const transactionInput = {
      amount: webhookTransaction.amount,
      type: webhookTransaction.type,
      description: webhookTransaction.description || `${partnerName} transaction`,
      date: webhookTransaction.timestamp,
      userId,
      tags: [...webhookTransaction.tags, partnerName],
      recipient: webhookTransaction.recipient || null,
      // Add partner-specific metadata
      notes: JSON.stringify({
        partner: partnerName,
        currency: webhookTransaction.currency,
        originalTimestamp: webhookTransaction.timestamp.toISOString(),
      }),
    };

    return await this.transactionService.createTransaction(transactionInput);
  }

  /**
   * Get webhook processing statistics
   * @param partnerName - Optional partner name to filter by
   * @returns Processing statistics
   */
  async getWebhookStats(partnerName?: string): Promise<{
    totalProcessed: number;
    successfulProcessed: number;
    failedProcessed: number;
    partnerBreakdown: { [partner: string]: number };
  }> {
    // This would typically query a webhook logs table
    // For now, return placeholder data
    return {
      totalProcessed: 0,
      successfulProcessed: 0,
      failedProcessed: 0,
      partnerBreakdown: {},
    };
  }

  /**
   * Replay failed webhook
   * @param webhookId - ID of the failed webhook
   * @returns Replay result
   */
  async replayWebhook(webhookId: string): Promise<{ success: boolean; message: string }> {
    // Implementation for replaying failed webhooks
    // This would typically fetch the webhook from a logs table and reprocess it
    return {
      success: false,
      message: 'Webhook replay not implemented yet',
    };
  }
}
