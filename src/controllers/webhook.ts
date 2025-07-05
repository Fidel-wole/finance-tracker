import { Request, Response } from 'express';
import WebhookService from '../services/webhook';
import PartnerService from '../services/partner';
import { WebhookRequest } from '../interfaces/webhook';

export default class WebhookController {
  private webhookService: WebhookService;

  constructor() {
    this.webhookService = new WebhookService();
  }

  /**
   * Handle webhook from fintech partners
   * Route: POST /webhook/:partner
   */
  async handleWebhook(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    const { partner } = req.params;
    const clientIP = req.ip || req.connection.remoteAddress;

    console.log(`[Webhook Controller] Received ${req.method} request for partner: ${partner}`);
    console.log(`[Webhook Controller] Headers:`, req.headers);
    console.log(`[Webhook Controller] Raw body length:`, req.rawBody?.length || 0);

    try {
      // Validate partner parameter
      if (!partner) {
        console.log(`[Webhook Controller] Missing partner parameter`);
        res.status(400).json({
          success: false,
          error: 'Partner parameter is required',
        });
        return;
      }

      // Check if raw body is available
      if (!req.rawBody) {
        console.log(`[Webhook Controller] Raw body not available`);
        res.status(400).json({
          success: false,
          error: 'Raw body not available. Ensure raw body parser middleware is applied.',
        });
        return;
      }

      // Create webhook request object
      const webhookRequest: WebhookRequest = {
        body: req.body,
        headers: req.headers as { [key: string]: string },
        rawBody: req.rawBody,
      };

      console.log(`Webhook received from ${partner}:`, {
        ip: clientIP,
        headers: req.headers,
        bodySize: req.rawBody.length,
        timestamp: new Date().toISOString(),
      });

      const result = await this.webhookService.processWebhook(partner, webhookRequest);

      const processingTime = Date.now() - startTime;

      console.log(`Webhook processing completed for ${partner}:`, {
        success: result.success,
        processingTime: `${processingTime}ms`,
        message: result.message,
      });

      // Send response
      if (result.success) {
        res.status(200).json({
          success: true,
          message: result.message,
          processingTime: `${processingTime}ms`,
          data: result.data,
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.message,
          processingTime: `${processingTime}ms`,
        });
      }

    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      console.error(`Webhook error for ${partner}:`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        ip: clientIP,
        processingTime: `${processingTime}ms`,
      });

      res.status(500).json({
        success: false,
        error: 'Internal server error',
        processingTime: `${processingTime}ms`,
      });
    }
  }

  async getSupportedPartners(req: Request, res: Response): Promise<void> {
    try {
      const partners = PartnerService.getSupportedPartners();
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      
      const partnerInfo = partners.map(partner => ({
        name: partner,
        webhookUrl: PartnerService.getPartnerWebhookUrl(partner, baseUrl),
        supported: true,
      }));

      res.status(200).json({
        success: true,
        partners: partnerInfo,
        total: partners.length,
      });

    } catch (error) {
      console.error('Error getting supported partners:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get supported partners',
      });
    }
  }


  async healthCheck(req: Request, res: Response): Promise<void> {
    try {
      const partners = PartnerService.getSupportedPartners();
      
      res.status(200).json({
        success: true,
        message: 'Webhook service is healthy',
        timestamp: new Date().toISOString(),
        supportedPartners: partners,
        version: '1.0.0',
      });

    } catch (error) {
      console.error('Webhook health check error:', error);
      res.status(500).json({
        success: false,
        error: 'Webhook service is unhealthy',
        timestamp: new Date().toISOString(),
      });
    }
  }

  async getWebhookStats(req: Request, res: Response): Promise<void> {
    try {
      const { partner } = req.query as { partner?: string };
      const stats = await this.webhookService.getWebhookStats(partner);

      res.status(200).json({
        success: true,
        stats,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      console.error('Error getting webhook stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get webhook statistics',
      });
    }
  }

  async replayWebhook(req: Request, res: Response): Promise<void> {
    try {
      const { webhookId } = req.params;
      
      if (!webhookId) {
        res.status(400).json({
          success: false,
          error: 'Webhook ID is required',
        });
        return;
      }

      const result = await this.webhookService.replayWebhook(webhookId);

      res.status(result.success ? 200 : 400).json(result);

    } catch (error) {
      console.error('Error replaying webhook:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to replay webhook',
      });
    }
  }
}
