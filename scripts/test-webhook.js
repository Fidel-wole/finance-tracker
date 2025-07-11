const crypto = require("crypto");
const axios = require("axios");

// Configuration
const BASE_URL = "http://localhost:3000/v1";
const WEBHOOK_SECRETS = {
  opay: "test_opay_secret_key",
  kuda: "test_kuda_secret_key",
  palmpay: "test_palmpay_secret_key",
};

// Sample payloads for different partners
const SAMPLE_PAYLOADS = {
  opay: {
    event: "payment.success",
    data: {
      reference: "ref_opay_003",
      amount: 3500.0,
      currency: "NGN",
      customer: {
        id: "cust_opay_003",
        name: "Daniel James",
        email: "daniel@example.com",
        phone: "+2347012345678",
      },
      status: "successful",
      type: "payment",
      created_at: "2025-07-05T14:30:00Z",
      description: "Ride payment",
      recipient: {
        name: "Bolt NG",
        account_number: "1234432112",
        bank_code: "023",
        is_internal: false,
      },
    },
  },

  kuda: {
    eventType: "transaction.debit",
    transactionData: {
      transactionId: "txn_kuda_334455",
      amount: "15000.00",
      currency: "NGN",
      accountNumber: "1234567890",
      accountName: "Fola Akintunde",
      narration: "Transfer to Michael Adebayo",
      transactionType: "debit",
      timestamp: "2025-07-05T15:00:00Z",
      phoneNumber: "+2348133344556",
      email: "fola.akintunde@example.com",
      recipient: {
        name: "Michael Adebayo",
        account_number: "7788990011",
        bank_code: "057",
        is_internal: false,
      },
    },
  },

  palmpay: {
event_type: "payment_sent",
    transaction: {
      id: "pp_palmpay_567890",
      amount: 7000.0,
      currency: "NGN",
      user: {
        user_id: "user_palmpay_456",
        full_name: "Angela Umeh",
        phone_number: "+2347019988776",
        email_address: "angela.umeh@example.com",
      },
      transaction_type: "payment_sent",
      description: "Electricity bill",
      created_at: "2025-07-05T15:45:00Z",
      tags: ["utilities", "electricity"],
      recipient: {
        name: "Ikeja Electric",
        account_number: "9900112233",
        bank_code: "063",
        is_internal: false,
      },
    },
  },
};

/**
 * Generate HMAC-SHA256 signature for webhook verification
 */
function generateSignature(payload, secret, prefix = "") {
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(JSON.stringify(payload));
  const signature = hmac.digest("hex");
  return prefix ? `${prefix}${signature}` : signature;
}

/**
 * Get signature header name for each partner
 */
function getSignatureHeader(partner) {
  const headers = {
    opay: "x-opay-signature",
    kuda: "x-kuda-signature",
    palmpay: "x-palmpay-signature",
  };
  return headers[partner] || "x-signature";
}

/**
 * Get signature prefix for partners that use it
 */
function getSignaturePrefix(partner) {
  const prefixes = {
    opay: "sha256=",
    palmpay: "sha256=",
  };
  return prefixes[partner] || "";
}

/**
 * Test webhook endpoint for a specific partner
 */
async function testWebhook(partner) {
  console.log(`\n🧪 Testing ${partner.toUpperCase()} webhook...`);

  try {
    const payload = SAMPLE_PAYLOADS[partner];
    const secret = WEBHOOK_SECRETS[partner];
    const signatureHeader = getSignatureHeader(partner);
    const signaturePrefix = getSignaturePrefix(partner);

    if (!payload || !secret) {
      throw new Error(`Missing payload or secret for ${partner}`);
    }

    // Generate signature
    const signature = generateSignature(payload, secret, signaturePrefix);

    // Prepare headers
    const headers = {
      "Content-Type": "application/json",
      [signatureHeader]: signature,
      "User-Agent": `${partner}-webhook/1.0`,
    };

    console.log(`📤 Sending webhook to: ${BASE_URL}/webhook/${partner}`);
    console.log(`🔐 Signature: ${signature}`);
    console.log(`📋 Payload size: ${JSON.stringify(payload).length} bytes`);

    // Send webhook request
    const startTime = Date.now();
    const response = await axios.post(
      `${BASE_URL}/webhook/${partner}`,
      payload,
      { headers }
    );
    const endTime = Date.now();

    console.log(`✅ Success! Status: ${response.status}`);
    console.log(`⏱️  Response time: ${endTime - startTime}ms`);
    console.log(`📨 Response:`, JSON.stringify(response.data, null, 2));

    return { success: true, data: response.data };
  } catch (error) {
    console.log(`❌ Failed!`);
    if (error.response) {
      console.log(`📛 Status: ${error.response.status}`);
      console.log(`📛 Error:`, JSON.stringify(error.response.data, null, 2));
    } else {
      console.log(`📛 Error:`, error.message);
    }
    return { success: false, error: error.message };
  }
}

/**
 * Test webhook with invalid signature
 */
async function testInvalidSignature(partner) {
  console.log(
    `\n🔒 Testing ${partner.toUpperCase()} webhook with invalid signature...`
  );

  try {
    const payload = SAMPLE_PAYLOADS[partner];
    const signatureHeader = getSignatureHeader(partner);

    // Use wrong signature
    const headers = {
      "Content-Type": "application/json",
      [signatureHeader]: "invalid_signature_12345",
      "User-Agent": `${partner}-webhook/1.0`,
    };

    const response = await axios.post(
      `${BASE_URL}/webhook/${partner}`,
      payload,
      { headers }
    );

    console.log(`❌ This should have failed! Status: ${response.status}`);
    return { success: false, error: "Should have been rejected" };
  } catch (error) {
    if (error.response && error.response.status === 400) {
      console.log(`✅ Correctly rejected invalid signature`);
      console.log(`📨 Response:`, JSON.stringify(error.response.data, null, 2));
      return { success: true };
    } else {
      console.log(`❌ Unexpected error:`, error.message);
      return { success: false, error: error.message };
    }
  }
}

/**
 * Test unsupported partner
 */
async function testUnsupportedPartner() {
  console.log(`\n🚫 Testing unsupported partner...`);

  try {
    const payload = { test: "data" };
    const headers = {
      "Content-Type": "application/json",
      "x-signature": "some_signature",
    };

    const response = await axios.post(
      `${BASE_URL}/webhook/unsupported`,
      payload,
      { headers }
    );

    console.log(`❌ This should have failed! Status: ${response.status}`);
    return { success: false };
  } catch (error) {
    if (error.response && error.response.status === 400) {
      console.log(`✅ Correctly rejected unsupported partner`);
      console.log(`📨 Response:`, JSON.stringify(error.response.data, null, 2));
      return { success: true };
    } else {
      console.log(`❌ Unexpected error:`, error.message);
      return { success: false };
    }
  }
}

/**
 * Test health check endpoint
 */
async function testHealthCheck() {
  console.log(`\n🏥 Testing health check...`);

  try {
    const response = await axios.get(`${BASE_URL}/webhook/health`);
    console.log(`✅ Health check passed! Status: ${response.status}`);
    console.log(`📨 Response:`, JSON.stringify(response.data, null, 2));
    return { success: true, data: response.data };
  } catch (error) {
    console.log(`❌ Health check failed:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Test supported partners endpoint
 */
async function testSupportedPartners() {
  console.log(`\n👥 Testing supported partners...`);

  try {
    const response = await axios.get(`${BASE_URL}/webhook/partners`);
    console.log(`✅ Got supported partners! Status: ${response.status}`);
    console.log(`📨 Response:`, JSON.stringify(response.data, null, 2));
    return { success: true, data: response.data };
  } catch (error) {
    console.log(`❌ Failed to get partners:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Main test runner
 */
async function runTests() {
  console.log("🚀 Starting Webhook System Tests");
  console.log("================================");

  const results = {
    total: 0,
    passed: 0,
    failed: 0,
  };

  const tests = [
    // Health and info tests
    { name: "Health Check", fn: testHealthCheck },
    { name: "Supported Partners", fn: testSupportedPartners },

    // Valid webhook tests
    { name: "Opay Webhook", fn: () => testWebhook("opay") },
    { name: "Kuda Webhook", fn: () => testWebhook("kuda") },
    { name: "PalmPay Webhook", fn: () => testWebhook("palmpay") },

    // Security tests
    {
      name: "Invalid Signature (Opay)",
      fn: () => testInvalidSignature("opay"),
    },
    { name: "Unsupported Partner", fn: testUnsupportedPartner },
  ];

  for (const test of tests) {
    results.total++;
    console.log(`\n📋 Running: ${test.name}`);

    try {
      const result = await test.fn();
      if (result && result.success !== false) {
        results.passed++;
        console.log(`✅ ${test.name}: PASSED`);
      } else {
        results.failed++;
        console.log(`❌ ${test.name}: FAILED`);
      }
    } catch (error) {
      results.failed++;
      console.log(`❌ ${test.name}: ERROR -`, error.message);
    }

    // Wait between tests
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  // Print summary
  console.log("\n📊 Test Summary");
  console.log("===============");
  console.log(`Total Tests: ${results.total}`);
  console.log(`Passed: ${results.passed}`);
  console.log(`Failed: ${results.failed}`);
  console.log(
    `Success Rate: ${((results.passed / results.total) * 100).toFixed(1)}%`
  );

  if (results.failed === 0) {
    console.log("\n🎉 All tests passed! Webhook system is working correctly.");
  } else {
    console.log("\n⚠️  Some tests failed. Please check the logs above.");
  }
}

// Handle command line arguments
if (process.argv.length > 2) {
  const partner = process.argv[2].toLowerCase();
  if (SAMPLE_PAYLOADS[partner]) {
    testWebhook(partner);
  } else {
    console.log(`❌ Unsupported partner: ${partner}`);
    console.log(
      `Supported partners: ${Object.keys(SAMPLE_PAYLOADS).join(", ")}`
    );
  }
} else {
  runTests();
}

module.exports = {
  testWebhook,
  testInvalidSignature,
  generateSignature,
  runTests,
};
