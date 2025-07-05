import { config } from "dotenv";
config();

export const {
  PORT,
  NODE_ENV,
  DATABASE_URL,
  // Webhook secrets for fintech partners
  OPAY_WEBHOOK_SECRET,
  KUDA_WEBHOOK_SECRET,
  PALMPAY_WEBHOOK_SECRET,
} = process.env;
