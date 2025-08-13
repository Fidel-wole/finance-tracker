# Finance Tracker API

A comprehensive personal finance tracking application with AI-powered insights, multi-tenant webhook support, and advanced analytics. Built with Node.js, TypeScript, Express, and Prisma ORM.

## 🚀 Features

### Core Functionality
- **Transaction Management**: Create, read, update, and delete financial transactions
- **Category Management**: Organize transactions with customizable categories
- **Budget Tracking**: Set and monitor budgets with alerts and notifications
- **User Analytics**: Comprehensive financial analytics and reporting
- **AI-Powered Insights**: Intelligent spending analysis and recommendations using OpenAI

### Advanced Features
- **Multi-Tenant Webhook Support**: Integrate with fintech partners (Opay, Kuda, PalmPay)
- **Real-time Notifications**: WebSocket-based notifications for budget alerts and insights
- **Audit Logging**: Complete audit trail for all financial operations
- **Behavioral Scoring**: Track and analyze spending patterns and financial behavior
- **API Token Management**: Secure API access with scoped permissions
- **Caching Layer**: Redis-based analytics caching for improved performance

## 🏗️ Architecture

```
src/
├── configs/          # Application configuration
├── controllers/      # HTTP request handlers
├── interfaces/       # TypeScript interfaces
├── middleware/       # Express middleware
├── repositories/     # Data access layer
├── routes/          # API route definitions
├── services/        # Business logic layer
└── utils/           # Utility functions
```

## 🛠️ Tech Stack

- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL with Prisma ORM
- **AI Integration**: OpenAI GPT API
- **Caching**: Redis (via ioredis)
- **Authentication**: JWT tokens
- **Logging**: Winston
- **Security**: Helmet, CORS, Rate limiting
- **Development**: Nodemon, ts-node

## 📋 Prerequisites

- Node.js (v16 or higher)
- PostgreSQL database
- Redis instance (for caching)
- OpenAI API key (for AI features)

## 🚀 Getting Started

### 1. Installation

```bash
# Clone the repository
git clone <repository-url>
cd finance-tracker

# Install backend dependencies
npm install

```

### 2. Environment Setup

Create a `.env` file in the root directory (backend):

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Database
DATABASE_URL="postgresql://username:password@localhost:5432/finance_tracker"

# OpenAI API (for AI suggestions)
OPENAI_API_KEY=your_openai_api_key

# Webhook Secrets (for fintech partner integrations)
OPAY_WEBHOOK_SECRET=your_opay_secret
KUDA_WEBHOOK_SECRET=your_kuda_secret
PALMPAY_WEBHOOK_SECRET=your_palmpay_secret


### 3. Database Setup

```bash
# Generate Prisma client
npm run prisma:gen

# Run database migrations
npm run prisma:migrate

# (Optional) Open Prisma Studio
npm run prisma:studio
```

### 4. Start the Application

```bash
# Start the backend (from root directory)
npm run dev


```

The backend API will be available at `http://localhost:3000`

## 📚 API Documentation

### Base URL
```
http://localhost:3000/api/v1
```

### Core Endpoints

#### User Analytics
```http
GET /users/:id/transactions?type=expense&limit=10
GET /users/:id/summary
GET /users/:id/recipients
```

#### AI Suggestions
```http
GET /ai/suggestions/:userId?year=2024&month=12
```

#### Webhooks
```http
POST /webhook/:partner        # Partner-specific webhook endpoint
GET /webhook/health          # Health check
GET /webhook/partners        # List supported partners
GET /webhook/stats           # Webhook statistics
POST /webhook/replay/:id     # Replay failed webhook
```

### Example API Responses

#### User Summary
```json
{
  "status": "success",
  "message": "User summary retrieved successfully",
  "data": {
    "totalIncome": 150000,
    "totalExpenses": 95000,
    "netSavings": 55000,
    "transactionCount": 45,
    "topCategory": "Food & Dining",
    "monthYear": "12/2024"
  }
}
```

#### AI Suggestions
```json
{
  "status": "success",
  "data": {
    "suggestions": [
      "You spent ₦45,000 on restaurants this month. Consider cooking at home more often to save money.",
      "Your utility bills increased by 20% compared to last month. Check for energy efficiency improvements."
    ],
    "totalAnalyzed": 23,
    "monthYear": "12/2024"
  }
}
```

## 🗄️ Database Schema

### Key Models

- **Users**: Store user profiles and authentication data
- **Transactions**: Financial transactions with categorization
- **Categories**: Customizable transaction categories
- **Budgets**: Budget management with alerts
- **AiInsights**: AI-generated financial insights
- **Notifications**: Real-time user notifications
- **AuditLogs**: Complete audit trail
- **UserBehaviorScore**: Behavioral analytics

### Relationships
- Users have many Transactions, Categories, Budgets
- Transactions belong to Users and Categories
- Budgets can be category-specific or global
- AI Insights are generated per user

## 🔌 Webhook Integration

The system supports webhooks from multiple fintech partners:

### Supported Partners
- **Opay**: Nigerian fintech platform
- **Kuda**: Digital banking platform
- **PalmPay**: Mobile payment solution

### Webhook Features
- HMAC-SHA256 signature verification
- Payload normalization across partners
- Automatic user and transaction creation
- Failed webhook replay mechanism
- Comprehensive logging and monitoring

### Webhook Payload Example
```json
{
  "partner": "opay",
  "user": {
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "phoneNumber": "+234XXXXXXXXXX"
  },
  "transaction": {
    "amount": 5000,
    "type": "expense",
    "description": "Payment to merchant",
    "recipient": {
      "name": "Chicken Republic",
      "account_number": "1234567890"
    }
  }
}
```

## 🤖 AI Features

### Intelligent Spending Analysis
- Categorizes recipients (restaurants, organizations, individuals)
- Identifies spending patterns and trends
- Provides personalized saving recommendations
- Behavioral coaching based on financial habits

### AI Suggestions Engine
- Monthly spending analysis
- Budget optimization recommendations
- Expense reduction strategies
- Financial goal achievement tips

## 🔒 Security Features

- **HMAC Signature Verification**: For webhook security
- **Rate Limiting**: Prevent API abuse
- **Helmet**: Security headers
- **Input Validation**: Joi schema validation
- **Audit Logging**: Track all system changes
- **API Token Management**: Scoped access control

## 📊 Analytics & Monitoring

### Built-in Analytics
- Monthly financial summaries
- Top recipients analysis
- Category-wise spending breakdown
- Budget adherence tracking
- Behavioral scoring (0-100)

### Caching Strategy
- Redis-based analytics caching
- Configurable cache expiration
- Cache invalidation on data changes

### Logging
- Structured logging with Winston
- Request/response logging
- Error tracking and monitoring
- Webhook processing logs

## 🧪 Testing

```bash
# Run webhook tests
npm test

# Test API endpoints
node test-endpoints.js

# Test simple functionality
node test-simple.js
```

## 📈 Performance Optimization

- **Database Indexing**: Optimized queries with proper indexes
- **Connection Pooling**: Efficient database connections
- **Caching Layer**: Redis for frequently accessed data
- **Pagination**: Large dataset handling
- **Background Processing**: Async webhook processing

## 🚀 Deployment

### Environment Variables (Production)
```env
NODE_ENV=production
DATABASE_URL=your_production_database_url
REDIS_URL=your_redis_url
OPENAI_API_KEY=your_openai_key
```

### Database Migration (Production)
```bash
npm run prisma:migrate-prod
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the ISC License.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Check the [Webhook Documentation](./WEBHOOK_DOCUMENTATION.md) for webhook-specific help

## 🔮 Roadmap

- [ ] Mobile app integration
- [ ] Advanced ML models for financial predictions
- [ ] Multi-currency support
- [ ] Investment tracking
- [ ] Goal-based savings
- [ ] Social features (spending comparisons)
- [ ] Advanced reporting dashboard
- [ ] Third-party integrations (banks, crypto exchanges)

---

Built with ❤️ for better financial management and insights.
