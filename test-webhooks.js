#!/usr/bin/env node

/**
 * Webhook Testing Script
 * 
 * This script demonstrates how to test the webhook endpoints with proper
 * HMAC-SHA256 signature generation for different fintech partners.
 */

const crypto = require('crypto');
const https = require('https');
const http = require('http');

class WebhookTester {
  constructor(baseUrl = 'http://localhost:3000', secrets = {}) {
    this.baseUrl = baseUrl;
    this.secrets = secrets;
  }

  /**
   * Generate HMAC-SHA256 signature for webhook payload
   */
  generateSignature(payload, secret, prefix = '') {
    const signature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
    
    return prefix + signature;
  }

  /**
   * Send webhook request
   */
  async sendWebhook(partner, payload, secret, signatureHeader, signaturePrefix = '') {
    const payloadString = JSON.stringify(payload);
    const signature = this.generateSignature(payloadString, secret, signaturePrefix);
    
    const url = new URL(`/api/v1/webhook/${partner}`, this.baseUrl);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;
    
    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payloadString),
        [signatureHeader]: signature,
      },
    };

    return new Promise((resolve, reject) => {
      const req = client.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            resolve({
              statusCode: res.statusCode,
              headers: res.headers,
              body: response,
            });
          } catch (error) {
            resolve({
              statusCode: res.statusCode,
              headers: res.headers,
              body: data,
            });
          }
        });
      });
      
      req.on('error', reject);
      req.write(payloadString);
      req.end();
    });
  }

  /**
   * Test Opay webhook
   */
  async testOpay() {
    console.log('🔵 Testing Opay webhook...');
    
    const payload = {
      event: 'payment.successful',
      data: {
        reference: 'REF123456789',
        amount: 5000,
        currency: 'NGN',
        customer: {
          id: 'opay_cust_001',
          name: 'John Doe',
          email: 'john.doe@example.com',
          phone: '+2348123456789'
        },
        status: 'successful',
        type: 'payment',
        created_at: new Date().toISOString(),
        description: 'Test payment from webhook tester'
      }
    };

    try {
      const response = await this.sendWebhook(
        'opay',
        payload,
        this.secrets.opay || 'test_opay_secret_123',
        'x-opay-signature',
        'sha256='
      );
      
      console.log('✅ Opay Response:', response.statusCode, response.body);
      return response;
    } catch (error) {
      console.error('❌ Opay Error:', error.message);
      return null;
    }
  }

  /**
   * Test Kuda webhook
   */
  async testKuda() {
    console.log('🟢 Testing Kuda webhook...');
    
    const payload = {
      eventType: 'transaction.credit',
      transactionData: {
        transactionId: 'KUDA_TXN_456',
        amount: '3500.00',
        currency: 'NGN',
        accountNumber: '1234567890',
        accountName: 'Jane Smith',
        narration: 'Test credit transaction',
        transactionType: 'credit',
        timestamp: new Date().toISOString(),
        phoneNumber: '+2348987654321',
        email: 'jane.smith@example.com'
      }
    };

    try {
      const response = await this.sendWebhook(
        'kuda',
        payload,
        this.secrets.kuda || 'test_kuda_secret_456',
        'x-kuda-signature'
      );
      
      console.log('✅ Kuda Response:', response.statusCode, response.body);
      return response;
    } catch (error) {
      console.error('❌ Kuda Error:', error.message);
      return null;
    }
  }

  /**
   * Test PalmPay webhook
   */
  async testPalmPay() {
    console.log('🟡 Testing PalmPay webhook...');
    
    const payload = {
      event_type: 'payment_received',
      transaction: {
        id: 'palm_txn_789',
        amount: 2750,
        currency: 'NGN',
        user: {
          user_id: 'palm_user_999',
          full_name: 'Bob Johnson',
          phone_number: '+2348555666777',
          email_address: 'bob.johnson@example.com'
        },
        transaction_type: 'payment_received',
        description: 'Test PalmPay transaction',
        created_at: new Date().toISOString(),
        tags: ['test', 'webhook', 'palmpay']
      }
    };

    try {
      const response = await this.sendWebhook(
        'palmpay',
        payload,
        this.secrets.palmpay || 'test_palmpay_secret_789',
        'x-palmpay-signature',
        'sha256='
      );
      
      console.log('✅ PalmPay Response:', response.statusCode, response.body);
      return response;
    } catch (error) {
      console.error('❌ PalmPay Error:', error.message);
      return null;
    }
  }

  /**
   * Test webhook health endpoint
   */
  async testHealth() {
    console.log('🏥 Testing webhook health...');
    
    const url = new URL('/api/v1/webhook/health', this.baseUrl);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;
    
    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname,
      method: 'GET',
    };

    return new Promise((resolve, reject) => {
      const req = client.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            console.log('✅ Health Check:', response);
            resolve(response);
          } catch (error) {
            console.log('✅ Health Check (raw):', data);
            resolve(data);
          }
        });
      });
      
      req.on('error', reject);
      req.end();
    });
  }

  /**
   * Test with invalid signature
   */
  async testInvalidSignature() {
    console.log('🔴 Testing invalid signature...');
    
    const payload = {
      event: 'test.invalid',
      data: { message: 'This should fail signature verification' }
    };

    try {
      const response = await this.sendWebhook(
        'opay',
        payload,
        'wrong_secret',
        'x-opay-signature',
        'sha256='
      );
      
      console.log('✅ Invalid Signature Response:', response.statusCode, response.body);
      return response;
    } catch (error) {
      console.error('❌ Invalid Signature Error:', error.message);
      return null;
    }
  }

  /**
   * Run all tests
   */
  async runAllTests() {
    console.log('🚀 Starting webhook tests...\n');
    
    const results = {};
    
    // Test health endpoint first
    try {
      results.health = await this.testHealth();
    } catch (error) {
      console.error('Health check failed:', error.message);
    }
    
    console.log('');
    
    // Test all partner webhooks
    results.opay = await this.testOpay();
    console.log('');
    
    results.kuda = await this.testKuda();
    console.log('');
    
    results.palmpay = await this.testPalmPay();
    console.log('');
    
    // Test invalid signature
    results.invalidSignature = await this.testInvalidSignature();
    console.log('');
    
    // Summary
    console.log('📊 Test Summary:');
    console.log('================');
    Object.entries(results).forEach(([test, result]) => {
      if (result && result.statusCode) {
        const status = result.statusCode < 400 ? '✅' : '❌';
        console.log(`${status} ${test}: ${result.statusCode}`);
      } else {
        console.log(`❌ ${test}: Failed to execute`);
      }
    });
    
    return results;
  }
}

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);
  const baseUrl = args[0] || 'http://localhost:3000';
  
  // You can provide secrets as environment variables or use defaults for testing
  const secrets = {
    opay: process.env.OPAY_WEBHOOK_SECRET || 'test_opay_secret_123',
    kuda: process.env.KUDA_WEBHOOK_SECRET || 'test_kuda_secret_456',
    palmpay: process.env.PALMPAY_WEBHOOK_SECRET || 'test_palmpay_secret_789',
  };
  
  const tester = new WebhookTester(baseUrl, secrets);
  
  if (args.includes('--health')) {
    tester.testHealth();
  } else if (args.includes('--opay')) {
    tester.testOpay();
  } else if (args.includes('--kuda')) {
    tester.testKuda();
  } else if (args.includes('--palmpay')) {
    tester.testPalmPay();
  } else if (args.includes('--invalid')) {
    tester.testInvalidSignature();
  } else {
    tester.runAllTests();
  }
}

module.exports = WebhookTester;
