const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const API_BASE_URL = 'http://localhost:3000/v1';

// Sample CSV content for testing
const sampleCSVContent = `Transaction Date,Value Date,Narration,Debit,Credit,Balance,Reference
2024-01-01,2024-01-01,Transfer from John Doe,,5000.00,25000.00,TRF001
2024-01-02,2024-01-02,POS Payment - Shoprite,2500.00,,22500.00,POS001
2024-01-03,2024-01-03,ATM Withdrawal,1000.00,,21500.00,ATM001
2024-01-04,2024-01-04,Salary Credit,,50000.00,71500.00,SAL001
2024-01-05,2024-01-05,Transfer to Jane Smith,10000.00,,61500.00,TRF002`;

/**
 * Test bank statement upload and analysis
 */
async function testBankStatementAnalysis() {
  try {
    console.log('🚀 Testing Bank Statement Analysis System...\n');

    // Create a temporary CSV file
    const tempFilePath = path.join(__dirname, '..', 'temp-statement.csv');
    fs.writeFileSync(tempFilePath, sampleCSVContent);

    // Step 1: Upload bank statement
    console.log('📤 Step 1: Uploading bank statement...');
    
    const formData = new FormData();
    formData.append('statement', fs.createReadStream(tempFilePath), {
      filename: 'test-statement.csv',
      contentType: 'text/csv'
    });
    // No userId required for now

    const uploadResponse = await axios.post(`${API_BASE_URL}/statements/upload`, formData, {
      headers: {
        ...formData.getHeaders(),
      },
    });

    console.log('✅ Upload successful!');
    console.log('Response:', JSON.stringify(uploadResponse.data, null, 2));
    
    const statementId = uploadResponse.data.data.statementId;

    // Step 2: Check processing status
    console.log('\n⏳ Step 2: Checking processing status...');
    
    let status = 'processing';
    let attempts = 0;
    const maxAttempts = 10;

    while (status === 'processing' && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
      
      const statusResponse = await axios.get(`${API_BASE_URL}/statements/${statementId}/status`);
      status = statusResponse.data.data.status;
      
      console.log(`Status check ${attempts + 1}: ${status}`);
      attempts++;
    }

    if (status === 'completed') {
      console.log('✅ Processing completed!');

      // Step 3: Get analysis results
      console.log('\n📊 Step 3: Retrieving analysis results...');
      
      const analysisResponse = await axios.get(`${API_BASE_URL}/statements/${statementId}/analysis`);
      
      console.log('✅ Analysis retrieved!');
      console.log('\n📈 Analysis Results:');
      console.log(JSON.stringify(analysisResponse.data, null, 2));

      // Skip user statements test for now (no user ID required)
      console.log('\n📋 Step 4: Skipping user statements list (no auth required)...');

    } else if (status === 'failed') {
      console.log('❌ Processing failed!');
      
      const statusResponse = await axios.get(`${API_BASE_URL}/statements/${statementId}/status`);
      console.log('Error details:', JSON.stringify(statusResponse.data, null, 2));
    } else {
      console.log('⚠️ Processing timed out');
    }

    // Cleanup
    console.log('\n🧹 Cleaning up...');
    try {
      fs.unlinkSync(tempFilePath);
      await axios.delete(`${API_BASE_URL}/statements/${statementId}`);
      console.log('✅ Cleanup completed!');
    } catch (error) {
      console.log('⚠️ Cleanup failed:', error.message);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

/**
 * Test basic endpoints
 */
async function testBasicEndpoints() {
  try {
    console.log('\n🔍 Testing basic endpoints...');

    // Test home endpoint
    const homeResponse = await axios.get(`${API_BASE_URL}/`);
    console.log('✅ Home endpoint working:', homeResponse.data);

    // Test AI suggestions endpoint
    const aiResponse = await axios.post(`${API_BASE_URL}/ai/suggestions`, {
      userId: 'test-user',
      timeframe: 'month'
    });
    console.log('✅ AI suggestions endpoint working:', aiResponse.data);

  } catch (error) {
    console.error('❌ Basic endpoint test failed:', error.message);
  }
}

// Run tests
async function runTests() {
  console.log('🎯 Finance Tracker Bank Statement Analysis Test Suite\n');
  console.log('Make sure the server is running on http://localhost:3000\n');

  await testBasicEndpoints();
  await testBankStatementAnalysis();

  console.log('\n🎉 Test suite completed!');
}

// Check if server is running first
axios.get(`${API_BASE_URL}/`)
  .then(() => {
    runTests();
  })
  .catch(() => {
    console.error('❌ Server is not running. Please start the server with "npm run dev" first.');
    process.exit(1);
  });
