import test from 'node:test';
import assert from 'node:assert';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AuthService } from '../src/services/auth.service.js';
import { authorize } from '../src/middleware/auth.middleware.js';
import { env } from '../src/config/env.js';

test('Auth - Password Hashing & Verification', async () => {
  const plainPassword = 'Student@123';
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(plainPassword, salt);

  assert.notStrictEqual(plainPassword, hash, 'Password hash must not equal plain text');
  const valid = await bcrypt.compare(plainPassword, hash);
  assert.strictEqual(valid, true, 'bcrypt.compare should return true for valid password');

  const invalid = await bcrypt.compare('WrongPassword', hash);
  assert.strictEqual(invalid, false, 'bcrypt.compare should return false for wrong password');
});

test('Auth - JWT Token Signing and Verification', () => {
  const mockUser = {
    id: 'user-test-1',
    email: 'test@meritx.demo',
    role: 'STUDENT'
  };

  const tokens = AuthService.generateTokens(mockUser);
  assert(tokens.token, 'Must return signed access token');
  assert(tokens.refreshToken, 'Must return signed refresh token');

  const decoded = jwt.verify(tokens.token, env.JWT_SECRET);
  assert.strictEqual(decoded.userId, mockUser.id);
  assert.strictEqual(decoded.role, 'STUDENT');
  assert.strictEqual(decoded.email, mockUser.email);
});

test('Auth - Role Permissions and Hierarchy Middleware', () => {
  // 1. Student accessing Student endpoint -> Allowed
  const reqStudent = { user: { id: 'u1', role: 'STUDENT' } };
  let passedStudent = false;
  authorize('STUDENT')(reqStudent, {}, (err) => {
    if (!err) passedStudent = true;
  });
  assert.strictEqual(passedStudent, true, 'Student should access student role');

  // 2. Student accessing Admin endpoint -> Forbidden
  let deniedStudent = false;
  authorize('ADMIN')(reqStudent, {}, (err) => {
    if (err && err.statusCode === 403) deniedStudent = true;
  });
  assert.strictEqual(deniedStudent, true, 'Student should be forbidden from admin endpoints');

  // 3. SuperAdmin accessing Admin endpoint -> Allowed (SuperAdmin has all Admin permissions)
  const reqSuper = { user: { id: 'u2', role: 'SUPERADMIN' } };
  let passedSuperAdmin = false;
  authorize('ADMIN')(reqSuper, {}, (err) => {
    if (!err) passedSuperAdmin = true;
  });
  assert.strictEqual(passedSuperAdmin, true, 'SuperAdmin should inherit Admin permissions');

  // 4. Admin accessing SuperAdmin-only endpoint -> Forbidden
  const reqAdmin = { user: { id: 'u3', role: 'ADMIN' } };
  let deniedAdmin = false;
  authorize('SUPERADMIN')(reqAdmin, {}, (err) => {
    if (err && err.statusCode === 403) deniedAdmin = true;
  });
  assert.strictEqual(deniedAdmin, true, 'Normal Admin must not perform SuperAdmin operations');
});
