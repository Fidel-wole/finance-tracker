# Multi-Tenant Webhook Handler Documentation

## Overview

This is a comprehensive multi-tenant webhook handler system designed for fintech platforms like Opay, Kuda, and PalmPay. The system accepts webhook notifications, verifies their authenticity, normalizes payloads from different providers, and processes user and transaction data.

## Architecture

### Components

1. **WebhookController** - Handles HTTP requests and responses
2. **WebhookService** - Core business logic for processing webhooks
3. **PartnerService** - Manages partner configurations and secrets
4. **PayloadMapper** - Normalizes different partner payload formats
5. **WebhookVerifier** - Verifies HMAC-SHA256 signatures
6. **RawBodyParser** - Middleware for capturing raw request bodies

### Security Features

- HMAC-SHA256 signature verification
- Raw body parsing to prevent payload tampering
- Partner-specific secret keys
- Request logging and monitoring
- Input validation and sanitization

## API Endpoints

### Main Webhook Endpoint
```
POST /api/v1/webhook/:partner
```
- `:partner` - Name of the fintech partner (opay, kuda, palmpay)
- Requires valid HMAC signature in headers
- Processes user and transaction data

### Health Check
```
GET /api/v1/webhook/health
```
Returns webhook service status and supported partners.

### Supported Partners
```
GET /api/v1/webhook/partners
```
Lists all supported partners and their webhook URLs.

### Statistics
```
GET /api/v1/webhook/stats?partner=optional
```
Returns webhook processing statistics.

### Replay Failed Webhook
```
POST /api/v1/webhook/replay/:webhookId
```
Replays a previously failed webhook (feature for future implementation).

## Supported Partners

### 1. Opay
- **Signature Header**: `x-opay-signature`
- **Signature Format**: `sha256=<hash>`
- **Environment Variable**: `OPAY_WEBHOOK_SECRET`

**Sample Payload**:
```json
{
  "event": "payment.success",
  "data": {
    "reference": "ref_123456",
    "amount": 1000.00,
    "currency": "NGN",
    "customer": {
      "id": "cust_789",
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "+2348012345678"
    },
    "status": "successful",
    "type": "payment",
    "created_at": "2025-01-01T12:00:00Z",
    "description": "Payment for services"
  }
}
```

### 2. Kuda
- **Signature Header**: `x-kuda-signature`
- **Environment Variable**: `KUDA_WEBHOOK_SECRET`

**Sample Payload**:
```json
{
  "eventType": "transaction.credit",
  "transactionData": {
    "transactionId": "txn_456789",
    "amount": "500.00",
    "currency": "NGN",
    "accountNumber": "1234567890",
    "accountName": "Jane Smith",
    "narration": "Transfer from savings",
    "transactionType": "credit",
    "timestamp": "2025-01-01T12:00:00Z",
    "phoneNumber": "+2348087654321",
    "email": "jane@example.com"
  }
}
```

### 3. PalmPay
- **Signature Header**: `x-palmpay-signature`
- **Signature Format**: `sha256=<hash>`
- **Environment Variable**: `PALMPAY_WEBHOOK_SECRET`

**Sample Payload**:
```json
{
  "event_type": "payment_received",
  "transaction": {
    "id": "pp_987654",
    "amount": 750.00,
    "currency": "NGN",
    "user": {
      "user_id": "user_321",
      "full_name": "Bob Johnson",
      "phone_number": "+2348098765432",
      "email_address": "bob@example.com"
    },
    "transaction_type": "payment_received",
    "description": "Mobile top-up",
    "created_at": "2025-01-01T12:00:00Z",
    "tags": ["mobile", "topup"]
  }
}
```

## Normalized Data Format

All partner payloads are normalized to this common format:

```typescript
interface NormalizedWebhookPayload {
  user: {
    externalId: string;    // Partner's user ID
    name: string;          // Full name
    phone?: string;        // Phone number
    email?: string;        // Email address
  };
  transaction: {
    amount: number;        // Transaction amount
    currency: string;      // Currency code (NGN, USD, etc.)
    type: 'income' | 'expense' | 'transfer';
    tags: string[];        // Tags including partner name
    description?: string;  // Transaction description
    timestamp: Date;       // Transaction timestamp
  };
}
```

## Setup Instructions

### 1. Environment Variables

Copy `.env.example` to `.env` and set your webhook secrets:

```bash
cp .env.example .env
```

Update the webhook secrets:
```bash
OPAY_WEBHOOK_SECRET=your_actual_opay_secret
KUDA_WEBHOOK_SECRET=your_actual_kuda_secret
PALMPAY_WEBHOOK_SECRET=your_actual_palmpay_secret
```

### 2. Database Setup

Ensure your Prisma database is set up:
```bash
npm run prisma:migrate
npm run prisma:gen
```

### 3. Start the Server

```bash
npm run dev
```

## Usage Examples

### Setting Up Webhooks with Partners

1. **Get your webhook URLs**:
   ```
   GET /api/v1/webhook/partners
   ```

2. **Configure webhook URLs with partners**:
   - Opay: `https://yourdomain.com/api/v1/webhook/opay`
   - Kuda: `https://yourdomain.com/api/v1/webhook/kuda`
   - PalmPay: `https://yourdomain.com/api/v1/webhook/palmpay`

### Testing Webhooks

Use the provided test script:
```bash
node scripts/test-webhook.js
```

## Adding New Partners

1. **Add partner configuration** in `PartnerService`:
   ```typescript
   const partnerConfigs = {
     newpartner: {
       signatureHeader: 'x-newpartner-signature',
       signaturePrefix: 'sha256=', // optional
     }
   };
   ```

2. **Add payload mapping** in `PayloadMapper`:
   ```typescript
   private static mapNewPartnerPayload(payload: NewPartnerPayload): NormalizedWebhookPayload {
     // Implement mapping logic
   }
   ```

3. **Set environment variable**:
   ```bash
   NEWPARTNER_WEBHOOK_SECRET=your_secret
   ```

## Monitoring and Logging

- All webhook requests are logged with timestamps
- Processing times are tracked
- Failed webhooks are logged with error details
- Health check endpoint for monitoring

## Security Considerations

1. **Always verify signatures** - The system automatically verifies HMAC signatures
2. **Use HTTPS** - Deploy with SSL/TLS certificates
3. **Rate limiting** - Consider implementing rate limiting for webhook endpoints
4. **IP whitelisting** - Restrict webhook access to partner IP ranges
5. **Secret rotation** - Regularly rotate webhook secrets

## Error Handling

The system provides detailed error responses:

```json
{
  "success": false,
  "error": "Invalid webhook signature",
  "processingTime": "15ms"
}
```

Common error scenarios:
- Invalid or missing signature
- Unsupported partner
- Malformed payload
- Database connection issues

## Performance

- Raw body parsing is optimized for webhook payloads
- Database operations use efficient upsert patterns
- Async processing for better throughput
- Processing time tracking for monitoring
