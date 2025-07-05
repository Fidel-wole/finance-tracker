# Multi-Tenant Webhook Handler for Fintech Platforms

This project provides a comprehensive, reusable webhook handler for fintech platforms like Opay, Kuda, and PalmPay. The system normalizes different webhook payload formats and securely processes them with HMAC-SHA256 signature verification.

## 🎯 Features

- **Multi-tenant Support**: Handle webhooks from multiple fintech partners
- **Secure Verification**: HMAC-SHA256 signature verification for each partner
- **Payload Normalization**: Convert partner-specific formats to unified structure
- **Database Integration**: Upsert users and create transactions using Prisma
- **Raw Body Parsing**: Preserve original webhook payload for signature verification
- **Comprehensive Logging**: Detailed logging for monitoring and debugging
- **Scalable Architecture**: Modular design for easy addition of new partners

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Fintech       │───▶│   Webhook        │───▶│   Database      │
│   Partners      │    │   Handler        │    │   (PostgreSQL)  │
│  (Opay, Kuda,   │    │                  │    │                 │
│   PalmPay)      │    │  ┌─────────────┐ │    │  ┌───────────┐  │
└─────────────────┘    │  │ Signature   │ │    │  │ Users     │  │
                       │  │ Verification│ │    │  │ Table     │  │
                       │  └─────────────┘ │    │  └───────────┘  │
                       │  ┌─────────────┐ │    │  ┌───────────┐  │
                       │  │ Payload     │ │    │  │Transaction│  │
                       │  │ Mapper      │ │    │  │ Table     │  │
                       │  └─────────────┘ │    │  └───────────┘  │
                       └──────────────────┘    └─────────────────┘
```

## 🚀 Quick Start

### 1. Environment Setup

Copy the example environment file and configure your webhook secrets:

```bash
cp .env.example .env
```

Add your fintech partner webhook secrets to `.env`:

```bash
# Webhook Secrets
OPAY_WEBHOOK_SECRET=your_opay_secret_here
KUDA_WEBHOOK_SECRET=your_kuda_secret_here
PALMPAY_WEBHOOK_SECRET=your_palmpay_secret_here
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Database Setup

```bash
npm run prisma:migrate
npm run prisma:gen
```

### 4. Start the Server

```bash
npm run dev
```

## 📡 Webhook Endpoints

### Main Webhook Endpoint
```
POST /api/v1/webhook/:partner
```

Where `:partner` can be:
- `opay`
- `kuda`
- `palmpay`

### Health Check
```
GET /api/v1/webhook/health
```

### Supported Partners
```
GET /api/v1/webhook/partners
```

### Statistics
```
GET /api/v1/webhook/stats
```

## 🔐 Security

### Signature Verification

Each partner uses HMAC-SHA256 signature verification with partner-specific headers:

- **Opay**: `x-opay-signature` header with `sha256=` prefix
- **Kuda**: `x-kuda-signature` header
- **PalmPay**: `x-palmpay-signature` header with `sha256=` prefix

### Raw Body Preservation

The system uses custom middleware to preserve the raw request body for signature verification while still parsing JSON for application use.

## 📥 Payload Examples

### Opay Webhook Payload
```json
{
  "event": "payment.successful",
  "data": {
    "reference": "REF123456",
    "amount": 1000,
    "currency": "NGN",
    "customer": {
      "id": "cust_123",
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "+2348123456789"
    },
    "status": "successful",
    "type": "payment",
    "created_at": "2025-01-15T10:30:00Z",
    "description": "Payment for services"
  }
}
```

### Kuda Webhook Payload
```json
{
  "eventType": "transaction.credit",
  "transactionData": {
    "transactionId": "TXN789",
    "amount": "1500.00",
    "currency": "NGN",
    "accountNumber": "1234567890",
    "accountName": "Jane Smith",
    "narration": "Transfer from mobile app",
    "transactionType": "credit",
    "timestamp": "2025-01-15T11:15:00Z",
    "phoneNumber": "+2348987654321",
    "email": "jane@example.com"
  }
}
```

### PalmPay Webhook Payload
```json
{
  "event_type": "payment_received",
  "transaction": {
    "id": "palm_abc123",
    "amount": 750,
    "currency": "NGN",
    "user": {
      "user_id": "user_456",
      "full_name": "Bob Johnson",
      "phone_number": "+2348555666777",
      "email_address": "bob@example.com"
    },
    "transaction_type": "payment_received",
    "description": "Bill payment",
    "created_at": "2025-01-15T09:45:00Z",
    "tags": ["bill", "utilities"]
  }
}
```

## 🔄 Normalized Format

All payloads are normalized to this common structure:

```typescript
interface NormalizedWebhookPayload {
  user: {
    externalId: string;
    name: string;
    phone?: string;
    email?: string;
  };
  transaction: {
    amount: number;
    currency: string;
    type: 'income' | 'expense' | 'transfer';
    tags: string[];
    description?: string;
    timestamp: Date;
  };
}
```

## 🛠️ Adding New Partners

To add support for a new fintech partner:

1. **Add Partner Interface** in `src/interfaces/webhook.ts`:
```typescript
export interface NewPartnerWebhookPayload {
  // Define the partner's payload structure
}
```

2. **Add Mapping Function** in `src/utils/payload-mapper.ts`:
```typescript
private static mapNewPartnerPayload(payload: NewPartnerWebhookPayload): NormalizedWebhookPayload {
  // Implementation
}
```

3. **Update Partner Service** in `src/services/partner.ts`:
```typescript
// Add partner configuration
newpartner: {
  signatureHeader: 'x-newpartner-signature',
  signaturePrefix: 'sha256=', // if needed
},
```

4. **Add Environment Variable**:
```bash
NEWPARTNER_WEBHOOK_SECRET=your_secret_here
```

## 📊 Database Schema

The system uses these main tables:

### Users Table
- `id` (UUID, Primary Key)
- `email` (String, Unique)
- `phoneNumber` (String, Unique)
- `firstName` (String)
- `lastName` (String)
- `isActive` (Boolean)
- `createdAt` (DateTime)
- `updatedAt` (DateTime)

### Transactions Table
- `id` (UUID, Primary Key)
- `amount` (Decimal)
- `type` (String: income/expense/transfer)
- `description` (String, Optional)
- `notes` (String, Optional)
- `date` (DateTime)
- `userId` (String, Foreign Key)
- `tags` (String Array)
- `createdAt` (DateTime)
- `updatedAt` (DateTime)

## 🔍 Monitoring and Debugging

### Logs
The system provides comprehensive logging:
- Incoming webhook details
- Signature verification results
- Processing times
- Error details with stack traces

### Health Checks
Monitor webhook service health:
```bash
curl http://localhost:3000/api/v1/webhook/health
```

### Statistics
Get processing statistics:
```bash
curl http://localhost:3000/api/v1/webhook/stats
```

## 🧪 Testing

### Manual Testing
You can test webhooks using curl:

```bash
# Test Opay webhook
curl -X POST http://localhost:3000/api/v1/webhook/opay \
  -H "Content-Type: application/json" \
  -H "x-opay-signature: sha256=your_calculated_signature" \
  -d @opay_payload.json
```

### Signature Generation
Generate test signatures using:
```bash
echo -n 'your_payload' | openssl dgst -sha256 -hmac 'your_secret'
```

## 🚀 Production Deployment

### Environment Variables
Ensure all required environment variables are set:
- Database connection
- Webhook secrets for all partners
- Proper logging configuration

### Security Considerations
- Use strong, unique webhook secrets
- Enable HTTPS in production
- Implement rate limiting
- Monitor webhook processing times
- Set up proper logging and alerting

### Scaling
- Consider using Redis for webhook deduplication
- Implement webhook retry mechanisms
- Add database connection pooling
- Monitor memory usage for large payloads

## 📄 API Reference

### Webhook Processing Response
```json
{
  "success": true,
  "message": "Webhook processed successfully",
  "processingTime": "45ms",
  "data": {
    "user": { ... },
    "transaction": { ... }
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": "Invalid webhook signature",
  "processingTime": "12ms"
}
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Submit a pull request

## 📝 License

This project is licensed under the MIT License.
