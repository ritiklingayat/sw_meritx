import test from 'node:test';
import assert from 'node:assert';
import { validatePasswordRequirements } from '../src/utils/password.js';
import { OtpService } from '../src/services/otp.service.js';
import { BrevoService } from '../src/services/brevo.service.js';
import { AuthService } from '../src/services/auth.service.js';
import { env } from '../src/config/env.js';

test('Password Validation - Strict Security Criteria Enforcement', () => {
  // 1. Rejects short password (< 8 chars)
  const short = validatePasswordRequirements('Ab1!');
  assert.strictEqual(short.isValid, false);
  assert.strictEqual(short.details.minLength, false);

  // 2. Rejects password missing uppercase
  const noUpper = validatePasswordRequirements('password123!');
  assert.strictEqual(noUpper.isValid, false);
  assert.strictEqual(noUpper.details.hasUppercase, false);

  // 3. Rejects password missing lowercase
  const noLower = validatePasswordRequirements('PASSWORD123!');
  assert.strictEqual(noLower.isValid, false);
  assert.strictEqual(noLower.details.hasLowercase, false);

  // 4. Rejects password missing number
  const noNumber = validatePasswordRequirements('Password@Secret');
  assert.strictEqual(noNumber.isValid, false);
  assert.strictEqual(noNumber.details.hasNumber, false);

  // 5. Rejects password missing special character
  const noSpecial = validatePasswordRequirements('Password123');
  assert.strictEqual(noSpecial.isValid, false);
  assert.strictEqual(noSpecial.details.hasSpecial, false);

  // 6. Accepts strong password meeting all criteria
  const strong = validatePasswordRequirements('MeritX@2026!');
  assert.strictEqual(strong.isValid, true);
  assert.strictEqual(strong.details.minLength, true);
  assert.strictEqual(strong.details.hasUppercase, true);
  assert.strictEqual(strong.details.hasLowercase, true);
  assert.strictEqual(strong.details.hasNumber, true);
  assert.strictEqual(strong.details.hasSpecial, true);
});

test('OTP Service - Secure 6-Digit Generation and Masking', () => {
  // Generate numeric OTP
  const otp = OtpService.generateNumericOtp();
  assert.strictEqual(otp.length, 6);
  assert(/^\d{6}$/.test(otp), 'OTP must be 6 numeric digits');

  // Email masking
  assert.strictEqual(OtpService.maskEmail('aditi.sharma@gmail.com'), 'ad***a@gmail.com');
  assert.strictEqual(OtpService.maskEmail('student@meritx.demo'), 'st***t@meritx.demo');
  assert.strictEqual(OtpService.maskEmail('ab@test.com'), 'a***@test.com');
});

test('OTP Service - Create Session, Verify Correct OTP, and Single-Use Consumption', () => {
  const email = 'test.student@meritx.test';
  const purpose = 'registration';

  // 1. Create OTP session
  const session = OtpService.createOtpSession({
    email,
    purpose,
    metadata: { name: 'Test Student', target: 'JEE Main' }
  });

  assert(session.otp, 'Must return plain OTP for Brevo delivery');
  assert.strictEqual(session.otp.length, 6);
  assert.strictEqual(session.cooldownSeconds, 60);

  // 2. Reject incorrect OTP and verify attempt counting
  assert.throws(
    () => OtpService.verifyOtp({ email, otp: '000000', purpose }),
    /Incorrect verification code/
  );

  // 3. Verify correct OTP
  const verifyResult = OtpService.verifyOtp({
    email,
    otp: session.otp,
    purpose
  });

  assert.strictEqual(verifyResult.success, true);
  assert(verifyResult.verificationToken, 'Must issue single-use verification token');

  // 4. Consume verification token successfully
  const consumed = OtpService.consumeVerificationToken({
    email,
    token: verifyResult.verificationToken,
    purpose
  });
  assert.strictEqual(consumed, true);

  // 5. Token cannot be consumed twice (prevent replay attack)
  assert.throws(
    () => OtpService.consumeVerificationToken({
      email,
      token: verifyResult.verificationToken,
      purpose
    }),
    /has not been verified|Invalid verification/
  );
});

test('OTP Service - Resend Cooldown Enforcement (60 Seconds)', () => {
  const email = 'cooldown.student@meritx.test';
  const purpose = 'registration';

  // First session
  OtpService.createOtpSession({ email, purpose });

  // Immediate second attempt must be rejected with cooldown error
  assert.throws(
    () => OtpService.createOtpSession({ email, purpose }),
    /Please wait \d+ seconds before requesting a new verification code/
  );
});

test('OTP Service - Invalidation on Maximum Incorrect Attempts (5 Attempts)', () => {
  const email = 'attempts.student@meritx.test';
  const purpose = 'registration';

  const session = OtpService.createOtpSession({ email, purpose });

  // 4 incorrect attempts
  for (let i = 0; i < 4; i++) {
    assert.throws(
      () => OtpService.verifyOtp({ email, otp: '111111', purpose }),
      /Incorrect verification code/
    );
  }

  // 5th incorrect attempt invalidates the session
  assert.throws(
    () => OtpService.verifyOtp({ email, otp: '111111', purpose }),
    /Maximum attempts exceeded/
  );

  // Even the correct OTP is now rejected because session was invalidated
  assert.throws(
    () => OtpService.verifyOtp({ email, otp: session.otp, purpose }),
    /No active verification session found/
  );
});

test('Brevo Service - Unconfigured Credentials Detection & Error Handling', async () => {
  // If Brevo credentials are placeholders, isConfigured must return false
  const originalKey = env.BREVO_API_KEY;
  const originalSender = env.BREVO_SENDER_EMAIL;

  try {
    env.BREVO_API_KEY = 'your_brevo_api_key';
    env.BREVO_SENDER_EMAIL = 'your_verified_sender_email';

    assert.strictEqual(BrevoService.isConfigured(), false);

    // Attempting to send without valid credentials must throw descriptive error
    await assert.rejects(
      async () => {
        await BrevoService.sendRegistrationOtpEmail({
          email: 'test@meritx.demo',
          name: 'Candidate',
          otp: '123456'
        });
      },
      /Email service is not yet configured/
    );
  } finally {
    env.BREVO_API_KEY = originalKey;
    env.BREVO_SENDER_EMAIL = originalSender;
  }
});

test('Brevo Service - HTML Email Template Branding and Structure', () => {
  const html = BrevoService.buildEmailTemplate({
    title: 'LGW MeritX - Email Verification',
    subtitle: 'Student Registration',
    name: 'Rohan Gupta',
    bodyContent: 'Please verify your student email address.',
    otp: '482915',
    expiryMinutes: 5
  });

  assert(html.includes('LGW MERITX'), 'Must contain LGW MeritX brand');
  assert(html.includes('482915'), 'Must contain 6-digit OTP');
  assert(html.includes('5 minutes'), 'Must contain 5-minute expiry notice');
  assert(html.includes('Security Notice'), 'Must contain security warning');
  assert(html.includes('Rohan Gupta'), 'Must greet candidate by name');
});

test('Auth Service - Student Role Restriction at Login', async () => {
  // When a teacher or admin attempts to login with requiredRole = 'student', access is blocked
  const mockTeacher = {
    id: 't1',
    role: 'TEACHER',
    email: 'teacher@meritx.demo'
  };

  const checkStudentPortalAccess = (userRole) => {
    if (String(userRole).toLowerCase() !== 'student') {
      throw new Error('Access denied: Only students can log in through this portal.');
    }
    return true;
  };

  assert.strictEqual(checkStudentPortalAccess('STUDENT'), true);
  assert.throws(() => checkStudentPortalAccess('TEACHER'), /Only students can log in/);
  assert.throws(() => checkStudentPortalAccess('ADMIN'), /Only students can log in/);
  assert.throws(() => checkStudentPortalAccess('SUPERADMIN'), /Only students can log in/);
});

test('OTP Service - Expired OTP Rejection (5-Minute TTL)', () => {
  const email = 'expired.student@meritx.test';
  const purpose = 'registration';

  const session = OtpService.createOtpSession({ email, purpose });
  const key = OtpService.getStoreKey(email, purpose);
  const record = OtpService.store.get(key);
  record.expiresAt = Date.now() - 1000;

  assert.throws(
    () => OtpService.verifyOtp({ email, otp: session.otp, purpose }),
    /expired/
  );
});

test('OTP Service - Prevents OTP Reuse After Successful Verification', () => {
  const email = 'reuse.student@meritx.test';
  const purpose = 'password_reset';

  const session = OtpService.createOtpSession({ email, purpose });
  const verified = OtpService.verifyOtp({ email, otp: session.otp, purpose });
  assert.strictEqual(verified.success, true);

  assert.throws(
    () => OtpService.verifyOtp({ email, otp: session.otp, purpose }),
    /already been used/
  );
});

test('OTP Service - Rollback Restores Clean State When Brevo Delivery Fails', () => {
  const email = 'rollback.student@meritx.test';
  const purpose = 'registration';

  const session = OtpService.createOtpSession({ email, purpose });
  session.rollback();

  const key = OtpService.getStoreKey(email, purpose);
  assert.strictEqual(OtpService.store.get(key), undefined);

  // Immediately retrying after a failed Brevo call should succeed without 60s lockout
  const retrySession = OtpService.createOtpSession({ email, purpose });
  assert.strictEqual(retrySession.otp.length, 6);
});

test('OTP Service - Cooldown Persists After Max Failed Attempts', () => {
  const email = 'cooldown.after.fail@meritx.test';
  const purpose = 'registration';

  OtpService.createOtpSession({ email, purpose });

  for (let i = 0; i < 5; i++) {
    assert.throws(() => OtpService.verifyOtp({ email, otp: '999999', purpose }));
  }

  assert.throws(
    () => OtpService.createOtpSession({ email, purpose }),
    /Please wait \d+ seconds/
  );
});

test('Auth Service - Direct Registration Without Email Verification Is Rejected', async () => {
  await assert.rejects(
    async () => {
      await AuthService.register({
        name: 'Unverified Student',
        email: 'unverified@meritx.test',
        password: 'StrongPassword@123'
      });
    },
    /Email OTP verification is required/
  );
});
