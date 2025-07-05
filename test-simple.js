#!/usr/bin/env node

const crypto = require('crypto');
const https = require('http');

// Test payload
const payload = {
  event: "payment.success",
  data: {
    reference: "ref_test_123",
    amount: 1500.00,
    currency: "NGN",
    customer: {
      id: "cust_test_001",
      name: "John Doe",
      email: "john.doe@example.com",
      phone: "+2348012345678"
    },
    status: "successful",
    type: "payment",
    created_at: "2025-07-05T12:00:00Z",
    description: "Test payment"
  }
};

// Generate signature
const secret = 'test_opay_secret_key';
const payloadString = JSON.stringify(payload);
const signature = 'sha256=' + crypto.createHmac('sha256', secret).update(payloadString).digest('hex');

console.log('🧪 Testing Opay webhook...');
console.log('📋 Payload:', JSON.stringify(payload, null, 2));
console.log('🔐 Signature:', signature);

// Prepare request
const postData = payloadString;
const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/v1/webhook/opay',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData),
    'x-opay-signature': signature,
    'User-Agent': 'opay-webhook-test/1.0'
  }
};

console.log('📤 Sending request to:', `http://${options.hostname}:${options.port}${options.path}`);

const req = https.request(options, (res) => {
  console.log('📨 Response status:', res.statusCode);
  console.log('📨 Response headers:', res.headers);
  
  let responseBody = '';
  res.on('data', (chunk) => {
    responseBody += chunk;
  });
  
  res.on('end', () => {
    console.log('📨 Response body:', responseBody);
    try {
      const parsed = JSON.parse(responseBody);
      console.log('📨 Parsed response:', JSON.stringify(parsed, null, 2));
      
      if (parsed.success) {
        console.log('✅ Webhook test PASSED!');
      } else {
        console.log('❌ Webhook test FAILED:', parsed.error);
      }
    } catch (e) {
      console.log('❌ Failed to parse response as JSON');
    }
  });
});

req.on('error', (e) => {
  console.error('❌ Request error:', e.message);
});

// Send the request
req.write(postData);
req.end();

console.log('⏳ Request sent, waiting for response...');
