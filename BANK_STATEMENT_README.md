# Bank Statement Analysis Feature

## 🎯 Overview

The Bank Statement Analysis feature is a comprehensive financial document processing system that automatically extracts, categorizes, and analyzes transactions from uploaded bank statements. It supports multiple file formats and leverages AI to provide intelligent insights and transaction categorization.

## ✨ Features

### 📄 File Format Support
- **PDF**: Advanced OCR and text extraction for bank statement PDFs
- **CSV**: Direct parsing of CSV bank statement exports
- **Excel**: Support for `.xlsx` and `.xls` bank statement files

### 🤖 AI-Powered Analysis
- **Transaction Categorization**: Automatic categorization into predefined categories (Food & Dining, Transportation, Shopping, etc.)
- **Merchant Extraction**: Intelligent merchant name identification from transaction descriptions
- **Financial Insights**: Personalized financial advice and spending pattern analysis
- **Confidence Scoring**: AI confidence levels for categorization accuracy

### 📊 Comprehensive Analytics
- **Summary Statistics**: Total income, expenses, net cash flow, and transaction counts
- **Category Breakdown**: Spending distribution across different categories
- **Monthly Trends**: Month-over-month financial patterns
- **Top Merchants**: Highest spending destinations
- **Unusual Transaction Detection**: Identification of outlier transactions

## 🚀 Getting Started

### Prerequisites
- Node.js 16+ installed
- PostgreSQL database running
- OpenAI API key (for AI features)

### Environment Setup
```bash
# Copy environment template
cp .env.example .env

# Configure required variables
OPENAI_API_KEY=your_openai_api_key_here
DATABASE_URL=postgresql://username:password@localhost:5432/finance_tracker
```

### Installation
```bash
npm install
npm run dev
```

## 📡 API Endpoints

### Upload Bank Statement
```http
POST /v1/statements/upload
Content-Type: multipart/form-data

Body:
- statement: File (PDF/CSV/Excel)
- bankName: string (optional)
- accountNumber: string (optional)
```

**Response:**
```json
{
  "success": true,
  "message": "File uploaded successfully. Processing started.",
  "data": {
    "statementId": "uuid",
    "fileName": "statement.pdf",
    "status": "processing"
  }
}
```

### Check Processing Status
```http
GET /v1/statements/{statementId}/status
```

**Response:**
```json
{
  "success": true,
  "data": {
    "statementId": "uuid",
    "status": "completed|processing|failed",
    "processingTime": 15200
  }
}
```

### Get Analysis Results
```http
GET /v1/statements/{statementId}/analysis
```

**Response:**
```json
{
  "success": true,
  "data": {
    "statement": {
      "id": "uuid",
      "fileName": "statement.pdf",
      "processingTime": 15200,
      "statementPeriod": {
        "startDate": "2024-01-01",
        "endDate": "2024-01-31"
      }
    },
    "transactions": [...],
    "summary": {
      "totalTransactions": 422,
      "totalIncome": 150000,
      "totalExpenses": 89500,
      "netCashFlow": 60500,
      "categoryBreakdown": {
        "Food & Dining": 25000,
        "Transportation": 15000
      }
    },
    "analysis": {
      "insights": [
        "Your spending patterns show strong financial discipline...",
        "Consider setting up automated savings..."
      ],
      "categories": [...],
      "topMerchants": [...],
      "patterns": {
        "recurringPayments": [...],
        "unusualTransactions": [...],
        "spendingTrends": [...]
      }
    }
  }
}
```

### Delete Statement
```http
DELETE /v1/statements/{statementId}
```

## 🔧 Supported Bank Formats

### OPay Bank Statements
- ✅ PDF transaction history exports
- ✅ Transfer records with merchant details
- ✅ Automatic bank name detection

### Generic CSV Format
```csv
Transaction Date,Value Date,Narration,Debit,Credit,Balance,Reference
2024-01-01,2024-01-01,Transfer from John Doe,,5000.00,25000.00,TRF001
2024-01-02,2024-01-02,POS Payment - Shoprite,2500.00,,22500.00,POS001
```

### Excel Statements
- ✅ Standard bank export formats
- ✅ Multiple sheet support
- ✅ Date format normalization

## 🧠 AI Categories

The system automatically categorizes transactions into these categories:

- **Food & Dining**: Restaurants, cafes, food delivery
- **Transportation**: Uber, fuel, public transport
- **Shopping**: Retail stores, online purchases
- **Bills & Utilities**: Electricity, water, internet, phone
- **Banking & Finance**: ATM fees, transfers, bank charges
- **Healthcare**: Hospitals, pharmacies, medical services
- **Entertainment**: Movies, games, subscriptions
- **Education**: Schools, courses, books
- **Travel**: Hotels, flights, vacation expenses
- **Other**: Miscellaneous transactions

## 📈 Usage Examples

### 1. Basic Upload and Analysis
```javascript
const FormData = require('form-data');
const fs = require('fs');

// Upload statement
const formData = new FormData();
formData.append('statement', fs.createReadStream('bank-statement.pdf'));

const uploadResponse = await axios.post('http://localhost:3000/v1/statements/upload', formData, {
  headers: formData.getHeaders()
});

const statementId = uploadResponse.data.data.statementId;

// Check status until complete
let status = 'processing';
while (status === 'processing') {
  await new Promise(resolve => setTimeout(resolve, 2000));
  const statusResponse = await axios.get(`http://localhost:3000/v1/statements/${statementId}/status`);
  status = statusResponse.data.data.status;
}

// Get results
const analysisResponse = await axios.get(`http://localhost:3000/v1/statements/${statementId}/analysis`);
console.log(analysisResponse.data);
```

### 2. Testing with Sample Data
```bash
# Run the included test suite
node test-bank-statements.js
```

## 🛡️ Error Handling

### Common Errors
- **Unsupported file format**: Only PDF, CSV, and Excel files are supported
- **No transactions found**: The uploaded file doesn't contain recognizable transaction data
- **Processing timeout**: Large files may take longer to process
- **AI service timeout**: Fallback categorization is used when AI services are unavailable

### Error Response Format
```json
{
  "success": false,
  "message": "Error description",
  "error": "DETAILED_ERROR_CODE"
}
```

## ⚡ Performance

### Processing Times
- **Small statements** (1-50 transactions): 5-10 seconds
- **Medium statements** (50-200 transactions): 10-30 seconds  
- **Large statements** (200+ transactions): 30-60 seconds

### Optimization Features
- **Batch AI processing**: Reduces API calls
- **Timeout protection**: Prevents hanging requests
- **Fallback mechanisms**: Ensures processing completes even when AI fails
- **Efficient database operations**: Batch inserts for large transaction sets

## 🔒 Security

- **File validation**: Strict file type and size checking
- **Temporary storage**: Uploaded files are cleaned up after processing
- **No persistent file storage**: Files are deleted after analysis
- **Input sanitization**: All transaction data is properly sanitized

## 🧪 Testing

### Automated Tests
```bash
# Run the complete test suite
node test-bank-statements.js

# Test specific endpoints
node test-endpoints.js
```

### Manual Testing with Postman
1. Import the included Postman collection: `Finance_Tracker_Postman_Collection.json`
2. Set the base URL to `http://localhost:3000/v1`
3. Upload a bank statement using the "Upload Bank Statement" request
4. Monitor processing with "Check Statement Status"
5. Retrieve results with "Get Statement Analysis"

## 🎛️ Configuration

### AI Service Settings
```typescript
// Timeout configurations (src/services/ai.ts)
const CATEGORIZATION_TIMEOUT = 8000; // 8 seconds
const MERCHANT_EXTRACTION_TIMEOUT = 8000; // 8 seconds  
const INSIGHTS_GENERATION_TIMEOUT = 10000; // 10 seconds
```

### File Upload Limits
```typescript
// File size limits (src/middleware/file-upload.ts)
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_EXTENSIONS = ['.pdf', '.csv', '.xlsx', '.xls'];
```

## 🐛 Troubleshooting

### Common Issues

**1. "OpenAI API key not configured"**
- Ensure `OPENAI_API_KEY` is set in your `.env` file
- Verify the API key is valid and has sufficient credits

**2. "No transactions found in the uploaded file"**
- Check if the file format matches expected bank statement structure
- Verify the file isn't corrupted or password-protected

**3. "Processing failed" status**
- Check server logs for detailed error information
- Ensure database connection is stable
- Verify sufficient disk space for temporary files

**4. Slow processing times**
- Large files with many transactions will take longer
- AI categorization adds processing time but provides better insights
- Consider upgrading OpenAI API tier for faster responses

### Debug Mode
Enable detailed logging by setting:
```bash
NODE_ENV=development
```

## 🚧 Roadmap

### Planned Features
- [ ] **Multi-bank support**: Enhanced parsing for more bank formats
- [ ] **Real-time processing**: WebSocket updates for processing status
- [ ] **Export functionality**: PDF/Excel reports of analysis results
- [ ] **Batch processing**: Upload multiple statements simultaneously
- [ ] **Custom categories**: User-defined transaction categories
- [ ] **Spending alerts**: Automated notifications for unusual spending
- [ ] **Budget integration**: Automatic budget vs. actual comparisons

### Performance Improvements
- [ ] **Caching layer**: Redis integration for faster repeat processing
- [ ] **Background jobs**: Queue-based processing for large files
- [ ] **OCR optimization**: Enhanced PDF text extraction accuracy
- [ ] **ML model training**: Custom models for better categorization

## 📄 License

This feature is part of the Finance Tracker application. See the main project LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📞 Support

For issues and questions:
- Create an issue in the GitHub repository
- Check the troubleshooting section above
- Review the test files for usage examples

---

**Built with ❤️ using Node.js, TypeScript, Prisma, and OpenAI**
