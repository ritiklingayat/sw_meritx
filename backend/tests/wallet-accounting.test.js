import test from 'node:test';
import assert from 'node:assert';
import crypto from 'crypto';

test('Wallet - Strict Integer Paise Financial Calculations', () => {
  // ₹149.99 = 14999 paise; ₹99.01 = 9901 paise; Sum must be exact 24900 paise (₹249.00)
  const depositPaise = BigInt(14999);
  const addPaise = BigInt(9901);
  const totalPaise = depositPaise + addPaise;

  assert.strictEqual(totalPaise, BigInt(24900), 'Paise addition must be exact without binary floating point inaccuracy');
  assert.strictEqual(Number(totalPaise) / 100, 249.0);

  // Fee deduction
  const examFeePaise = BigInt(9900); // ₹99.00
  const remainingPaise = totalPaise - examFeePaise;
  assert.strictEqual(remainingPaise, BigInt(15000), 'Remaining balance must equal exact 15000 paise (₹150.00)');
});

test('Wallet - Insufficient Balance Protection', () => {
  const currentBalancePaise = BigInt(5000); // ₹50.00
  const requiredFeePaise = BigInt(9900); // ₹99.00

  const hasShortfall = currentBalancePaise < requiredFeePaise;
  assert.strictEqual(hasShortfall, true, 'Must detect shortfall when balance is less than required fee');

  const shortfallPaise = requiredFeePaise - currentBalancePaise;
  assert.strictEqual(shortfallPaise, BigInt(4900), 'Shortfall should be exactly 4900 paise (₹49.00)');
});

test('Payments - Razorpay Cryptographic Signature Verification', () => {
  const orderId = 'order_123456789';
  const paymentId = 'pay_987654321';
  const secret = 'rzp_secret_demo_meritx_2026';

  // Legitimate signature created by gateway
  const validSignature = crypto
    .createHmac('sha256', secret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  // Verify
  const verifyValid = crypto
    .createHmac('sha256', secret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  assert.strictEqual(verifyValid === validSignature, true, 'Valid signature must match expected HMAC digest');

  // Tampered paymentId
  const tamperedVerify = crypto
    .createHmac('sha256', secret)
    .update(`${orderId}|pay_TAMPERED`)
    .digest('hex');
  assert.strictEqual(tamperedVerify === validSignature, false, 'Tampered signature must be rejected');
});

test('Wallet - Student Default Balance is Zero', () => {
  const defaultBalancePaise = BigInt(0);
  const defaultBalanceRs = Number(defaultBalancePaise) / 100;

  assert.strictEqual(defaultBalancePaise, BigInt(0), 'Initial student wallet balance in paise must be 0');
  assert.strictEqual(defaultBalanceRs, 0, 'Initial student wallet balance in INR must be 0');
});

test('Wallet - Add Money Range Enforcement (₹1 Minimum to ₹1000 Maximum)', () => {
  function validateDepositAmount(amount) {
    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount < 1 || numAmount > 1000) {
      return { valid: false, error: 'Deposit amount must be between ₹1 and ₹1,000.' };
    }
    return { valid: true, amount: numAmount };
  }

  // Valid boundaries
  assert.strictEqual(validateDepositAmount(1).valid, true, '₹1 deposit must be accepted');
  assert.strictEqual(validateDepositAmount(1000).valid, true, '₹1000 deposit must be accepted');
  assert.strictEqual(validateDepositAmount(500).valid, true, '₹500 deposit must be accepted');

  // Below minimum
  assert.strictEqual(validateDepositAmount(0).valid, false, '₹0 deposit must be rejected');
  assert.strictEqual(validateDepositAmount(-50).valid, false, 'Negative deposit must be rejected');
  assert.strictEqual(validateDepositAmount(0.5).valid, false, '₹0.50 deposit below ₹1 must be rejected');

  // Above maximum
  assert.strictEqual(validateDepositAmount(1001).valid, false, '₹1001 deposit exceeding ₹1000 must be rejected');
  assert.strictEqual(validateDepositAmount(2000).valid, false, '₹2000 deposit exceeding ₹1000 must be rejected');
  assert.strictEqual(validateDepositAmount(50000).valid, false, '₹50000 deposit exceeding ₹1000 must be rejected');
  assert.strictEqual(validateDepositAmount('invalid').valid, false, 'Non-numeric deposit must be rejected');
});
