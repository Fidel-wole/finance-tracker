const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api/v1';

async function testEndpoints() {
  console.log('Testing User Analytics Endpoints...\n');

  // Test data - you should replace with actual user IDs from your database
  const testUserId = 'test-user-id';

  try {
    // Test 1: GET /users/:id/transactions
    console.log('1. Testing GET /users/:id/transactions');
    try {
      const transactionsResponse = await axios.get(`${BASE_URL}/users/${testUserId}/transactions?type=expense&limit=5`);
      console.log('✅ Transactions endpoint working');
      console.log('Status:', transactionsResponse.status);
      console.log('Response structure:', Object.keys(transactionsResponse.data));
    } catch (error) {
      console.log('❌ Transactions endpoint error:', error.response?.status, error.response?.data?.message);
    }

    console.log('\n2. Testing GET /users/:id/summary');
    try {
      const summaryResponse = await axios.get(`${BASE_URL}/users/${testUserId}/summary`);
      console.log('✅ Summary endpoint working');
      console.log('Status:', summaryResponse.status);
      console.log('Response structure:', Object.keys(summaryResponse.data));
    } catch (error) {
      console.log('❌ Summary endpoint error:', error.response?.status, error.response?.data?.message);
    }

    console.log('\n3. Testing GET /users/:id/recipients');
    try {
      const recipientsResponse = await axios.get(`${BASE_URL}/users/${testUserId}/recipients`);
      console.log('✅ Recipients endpoint working');
      console.log('Status:', recipientsResponse.status);
      console.log('Response structure:', Object.keys(recipientsResponse.data));
    } catch (error) {
      console.log('❌ Recipients endpoint error:', error.response?.status, error.response?.data?.message);
    }

    // Test 4: Test with non-existent user to verify error handling
    console.log('\n4. Testing with non-existent user');
    try {
      const response = await axios.get(`${BASE_URL}/users/non-existent-user/transactions`);
      console.log('Unexpected success:', response.status);
    } catch (error) {
      if (error.response?.status === 404) {
        console.log('✅ Error handling working correctly - 404 for non-existent user');
      } else {
        console.log('❌ Unexpected error:', error.response?.status, error.response?.data?.message);
      }
    }

  } catch (error) {
    console.error('General error:', error.message);
  }
}

// Test basic server health first
async function testServerHealth() {
  try {
    const response = await axios.get(`${BASE_URL}/`);
    console.log('✅ Server is running');
    console.log('Health check response:', response.data);
    return true;
  } catch (error) {
    console.log('❌ Server not reachable:', error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Starting endpoint tests...\n');
  
  const serverHealthy = await testServerHealth();
  if (serverHealthy) {
    console.log('\n' + '='.repeat(50));
    await testEndpoints();
  }
}

main().catch(console.error);
