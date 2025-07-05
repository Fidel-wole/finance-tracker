import { Router } from 'express';
import WebhookController from '../controllers/webhook';
import { webhookBodyParser } from '../middleware/raw-body-parser';

const webhookRoutes = Router();
const webhookController = new WebhookController();

// Apply webhook body parser to all webhook routes
webhookRoutes.use(webhookBodyParser);

// Main webhook endpoint for partner-specific webhooks
webhookRoutes.post(
  '/:partner',
  webhookController.handleWebhook.bind(webhookController)
);

// Get supported partners
webhookRoutes.get(
  '/partners',
  webhookController.getSupportedPartners.bind(webhookController)
);

// Health check
webhookRoutes.get(
  '/health',
  webhookController.healthCheck.bind(webhookController)
);

// Get webhook statistics
webhookRoutes.get(
  '/stats',
  webhookController.getWebhookStats.bind(webhookController)
);

// Replay failed webhook
webhookRoutes.post(
  '/replay/:webhookId',
  webhookController.replayWebhook.bind(webhookController)
);

export default webhookRoutes;
