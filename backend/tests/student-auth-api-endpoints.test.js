import test from 'node:test';
import assert from 'node:assert';
import app from '../src/app.js';
import { OtpService } from '../src/services/otp.service.js';

// Helper for testing Express app directly with node fetch
async function callApi(path, options = {}) {
  const server = app.listen(0);
  const port = server.address().port;
  const url = `http://127.0.0.1:${port}${path}`;
  try {
    const res = await fetch(url, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      },
      body: options.body ? JSON.stringify(options.body) : undefined
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, ok: res.ok, data };
  } finally {
    server.close();
  }
}

test('API Endpoint - Google Social Login is Permanently Disabled', async () => {
  const res = await callApi('/api/auth/google', {
    method: 'POST',
    body: { credential: 'dummy-token' }
  });

  assert.strictEqual(res.status, 400);
  assert(
    res.data.message.includes('disabled') || res.data.message.includes('Google sign-in has been disabled'),
    'Google login must be explicitly rejected'
  );
});

test('API Endpoint - Student Login Role Guard Rejection', async () => {
  // Attempting to log in as teacher with role: 'student'
  const res = await callApi('/api/auth/login', {
    method: 'POST',
    body: {
      email: 'teacher@meritx.demo',
      password: 'Teacher@123',
      role: 'student'
    }
  });

  assert.strictEqual(res.status, 401);
  assert(
    res.data.message.includes('Only students can log in through this portal'),
    'Must prevent teachers from logging into student portal'
  );
});

test('API Endpoint - Student Login Role Guard Allows Valid Student', async () => {
  const res = await callApi('/api/auth/login', {
    method: 'POST',
    body: {
      email: 'student@meritx.demo',
      password: 'Student@123',
      role: 'student'
    }
  });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.data.success, true);
  assert(res.data.token, 'Must return JWT access token');
  assert.strictEqual(res.data.user.role, 'student');
});

test('API Endpoint - Student OTP Verification & Token Issuance', async () => {
  const testEmail = 'api.verify.endpoint@meritx.test';
  const purpose = 'registration';

  const session = OtpService.createOtpSession({
    email: testEmail,
    purpose,
    metadata: { name: 'API Tester' }
  });

  const res = await callApi('/api/auth/student/verify-otp', {
    method: 'POST',
    body: {
      email: testEmail,
      otp: session.otp,
      purpose
    }
  });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.data.success, true);
  assert(res.data.verificationToken, 'Must receive verificationToken at root');
});

test('API Endpoint - Student Complete Registration Password & Token Validation', async () => {
  const testEmail1 = 'api.mismatch@meritx.test';
  const purpose = 'registration';

  // Session 1: test password mismatch
  const session1 = OtpService.createOtpSession({
    email: testEmail1,
    purpose,
    metadata: { name: 'Mismatch Tester' }
  });
  const verified1 = OtpService.verifyOtp({ email: testEmail1, otp: session1.otp, purpose });

  const mismatchRes = await callApi('/api/auth/student/complete-registration', {
    method: 'POST',
    body: {
      name: 'Mismatch Tester',
      email: testEmail1,
      password: 'SecurePassword@123',
      confirmPassword: 'DifferentPassword@123',
      verificationToken: verified1.verificationToken,
      target: 'JEE Main'
    }
  });

  assert.strictEqual(mismatchRes.status, 400);
  assert(mismatchRes.data.message.includes('do not match'));

  // Session 2: test weak password
  const testEmail2 = 'api.weak@meritx.test';
  const session2 = OtpService.createOtpSession({
    email: testEmail2,
    purpose,
    metadata: { name: 'Weak Tester' }
  });
  const verified2 = OtpService.verifyOtp({ email: testEmail2, otp: session2.otp, purpose });

  const weakRes = await callApi('/api/auth/student/complete-registration', {
    method: 'POST',
    body: {
      name: 'Weak Tester',
      email: testEmail2,
      password: 'weak',
      confirmPassword: 'weak',
      verificationToken: verified2.verificationToken,
      target: 'JEE Main'
    }
  });

  assert.strictEqual(weakRes.status, 400);
  assert(weakRes.data.message.includes('8 characters'));
});

test('API Endpoint - Student Login Rejects Admin and Non-Email Identifiers', async () => {
  const adminAsStudent = await callApi('/api/auth/login', {
    method: 'POST',
    body: {
      email: 'admin@meritx.demo',
      password: 'Admin@123',
      role: 'student'
    }
  });
  assert.strictEqual(adminAsStudent.status, 401);
  assert(adminAsStudent.data.message.includes('Only students can log in'));

  const nameAsEmail = await callApi('/api/auth/login', {
    method: 'POST',
    body: {
      email: 'Aarav Sharma',
      password: 'Student@123',
      role: 'student'
    }
  });
  assert.strictEqual(nameAsEmail.status, 400);
  assert(nameAsEmail.data.message.includes('valid student email'));
});

test('API Endpoint - Teacher & Admin Authentication Preserved', async () => {
  const teacherRes = await callApi('/api/auth/login', {
    method: 'POST',
    body: {
      email: 'teacher@meritx.demo',
      password: 'Teacher@123',
      role: 'teacher'
    }
  });
  assert.strictEqual(teacherRes.status, 200);
  assert.strictEqual(teacherRes.data.user.role, 'teacher');

  const adminRes = await callApi('/api/auth/login', {
    method: 'POST',
    body: {
      email: 'admin@meritx.demo',
      password: 'Admin@123',
      role: 'admin'
    }
  });
  assert.strictEqual(adminRes.status, 200);
  assert.strictEqual(adminRes.data.user.role, 'admin');
});

test('API Endpoint - Duplicate Student Registration Email Rejected', async () => {
  const res = await callApi('/api/auth/student/send-otp', {
    method: 'POST',
    body: {
      name: 'Duplicate Student',
      email: 'student@meritx.demo',
      target: 'JEE Main',
      purpose: 'registration'
    }
  });

  assert.strictEqual(res.status, 409);
  assert(res.data.message.includes('already exists'));
});

test('API Endpoint - Direct /api/auth/register Without OTP Token Rejected', async () => {
  const res = await callApi('/api/auth/register', {
    method: 'POST',
    body: {
      name: 'Bypass Attempt',
      email: 'bypass.attempt@meritx.test',
      password: 'Password@123'
    }
  });

  assert.strictEqual(res.status, 400);
  assert(res.data.message.includes('OTP verification is required'));
});
