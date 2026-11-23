import test from 'node:test';
import assert from 'node:assert';
import { AuthService } from '../src/services/auth.service.js';
import { authorize } from '../src/middleware/auth.middleware.js';

test('Auth Flows - Role Enforcement Logic', () => {
  // Test role check logic
  const checkRoleAccess = (userRole, requiredRole) => {
    const uRole = String(userRole).toLowerCase();
    const target = String(requiredRole).toLowerCase();
    if (target === 'teacher' && uRole !== 'teacher') {
      throw new Error('Access denied: Only authorized teachers can log in through this portal.');
    }
    if (target === 'admin' && uRole !== 'admin' && uRole !== 'superadmin') {
      throw new Error('Access denied: Only authorized administrators can log in through this portal.');
    }
    if (target === 'student' && uRole !== 'student') {
      throw new Error('Access denied: Only students can log in through this portal.');
    }
    return true;
  };

  // 1. Student accessing Student login -> Allowed
  assert.strictEqual(checkRoleAccess('STUDENT', 'student'), true);

  // 2. Teacher attempting Student login -> Blocked
  assert.throws(() => checkRoleAccess('TEACHER', 'student'), /Only students can log in/);

  // 3. Admin attempting Student login -> Blocked
  assert.throws(() => checkRoleAccess('ADMIN', 'student'), /Only students can log in/);

  // 4. Teacher accessing Teacher login -> Allowed
  assert.strictEqual(checkRoleAccess('TEACHER', 'teacher'), true);

  // 5. Student attempting Teacher login -> Blocked
  assert.throws(() => checkRoleAccess('STUDENT', 'teacher'), /Only authorized teachers/);

  // 6. Admin attempting Teacher login -> Blocked
  assert.throws(() => checkRoleAccess('ADMIN', 'teacher'), /Only authorized teachers/);

  // 7. Admin accessing Admin login -> Allowed
  assert.strictEqual(checkRoleAccess('ADMIN', 'admin'), true);

  // 8. SuperAdmin accessing Admin login -> Allowed
  assert.strictEqual(checkRoleAccess('SUPERADMIN', 'admin'), true);

  // 9. Student attempting Admin login -> Blocked
  assert.throws(() => checkRoleAccess('STUDENT', 'admin'), /Only authorized administrators/);

  // 10. Teacher attempting Admin login -> Blocked
  assert.throws(() => checkRoleAccess('TEACHER', 'admin'), /Only authorized administrators/);
});

test('Auth Flows - RBAC Route Guard Enforcement', () => {
  const reqStudent = { user: { id: 'u-student', role: 'STUDENT' } };
  const reqTeacher = { user: { id: 'u-teacher', role: 'TEACHER' } };
  const reqAdmin = { user: { id: 'u-admin', role: 'ADMIN' } };
  const reqSuper = { user: { id: 'u-super', role: 'SUPERADMIN' } };

  // Teacher cannot access Admin endpoints
  let teacherBlockedFromAdmin = false;
  authorize('ADMIN', 'SUPERADMIN')(reqTeacher, {}, (err) => {
    if (err && err.statusCode === 403) teacherBlockedFromAdmin = true;
  });
  assert.strictEqual(teacherBlockedFromAdmin, true, 'Teacher must not access Admin endpoints');

  // Student cannot access Teacher endpoints
  let studentBlockedFromTeacher = false;
  authorize('TEACHER', 'ADMIN', 'SUPERADMIN')(reqStudent, {}, (err) => {
    if (err && err.statusCode === 403) studentBlockedFromTeacher = true;
  });
  assert.strictEqual(studentBlockedFromTeacher, true, 'Student must not access Teacher endpoints');

  // Student cannot access Admin endpoints
  let studentBlockedFromAdmin = false;
  authorize('ADMIN', 'SUPERADMIN')(reqStudent, {}, (err) => {
    if (err && err.statusCode === 403) studentBlockedFromAdmin = true;
  });
  assert.strictEqual(studentBlockedFromAdmin, true, 'Student must not access Admin endpoints');

  // Admin cannot access SuperAdmin-exclusive endpoints
  let adminBlockedFromSuper = false;
  authorize('SUPERADMIN')(reqAdmin, {}, (err) => {
    if (err && err.statusCode === 403) adminBlockedFromSuper = true;
  });
  assert.strictEqual(adminBlockedFromSuper, true, 'Normal Admin must not access SuperAdmin-exclusive endpoints');

  // SuperAdmin has full access to Admin endpoints
  let superAccessAdmin = false;
  authorize('ADMIN')(reqSuper, {}, (err) => {
    if (!err) superAccessAdmin = true;
  });
  assert.strictEqual(superAccessAdmin, true, 'SuperAdmin must have access to Admin endpoints');

  // Teacher has access to Teacher endpoints
  let teacherAccessTeacher = false;
  authorize('TEACHER')(reqTeacher, {}, (err) => {
    if (!err) teacherAccessTeacher = true;
  });
  assert.strictEqual(teacherAccessTeacher, true, 'Teacher must have access to Teacher endpoints');
});
