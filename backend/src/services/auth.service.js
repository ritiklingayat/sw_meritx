import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';
import { BadRequestError, UnauthorizedError, ConflictError, NotFoundError } from '../utils/errors.js';
import { BrevoService } from './brevo.service.js';
import { OtpService } from './otp.service.js';
import { validatePasswordRequirements } from '../utils/password.js';

export class AuthService {
  static formatSafeUser(user) {
    if (!user) return null;
    const { passwordHash: _, ...safeUser } = user;
    if (safeUser.wallet) {
      const balancePaise = Number(safeUser.wallet.balancePaise || 0);
      safeUser.wallet = {
        ...safeUser.wallet,
        balancePaise,
        balance: balancePaise / 100
      };
    }
    return {
      ...safeUser,
      role: String(safeUser.role || 'student').toLowerCase()
    };
  }

  static generateTokens(user) {
    const payload = {
      userId: user.id,
      email: user.email,
      role: String(user.role).toUpperCase()
    };

    const token = jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN
    });

    const refreshToken = jwt.sign(payload, env.JWT_REFRESH_SECRET, {
      expiresIn: env.JWT_REFRESH_EXPIRES_IN
    });

    return { token, refreshToken };
  }

  static isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
  }

  static async register(payload = {}) {
    if (!payload?.verificationToken) {
      throw new BadRequestError(
        'Email OTP verification is required before creating a student account. Please verify your email address first.'
      );
    }
    return this.completeStudentRegistration({
      ...payload,
      confirmPassword: payload.confirmPassword ?? payload.password
    });
  }

  static async login(identifier, password, requiredRole = null) {
    const cleanId = String(identifier || '').trim();
    const cleanLower = cleanId.toLowerCase();
    const targetRole = requiredRole ? String(requiredRole).toLowerCase() : null;

    if (!cleanId) {
      throw new BadRequestError(targetRole === 'student' ? 'A valid email address is required.' : 'Credentials are required.');
    }
    if (!password) {
      throw new BadRequestError('Password is required.');
    }

    // Student authentication is strictly email + password based
    if (targetRole === 'student' && !this.isValidEmail(cleanLower)) {
      throw new BadRequestError('Please enter a valid student email address.');
    }

    const user = await prisma.user.findFirst({
      where:
        targetRole === 'student'
          ? { email: cleanLower }
          : {
              OR: [
                { email: cleanLower },
                { id: cleanId },
                { name: { equals: cleanId, mode: 'insensitive' } },
                { email: { startsWith: cleanLower + '@', mode: 'insensitive' } }
              ]
            },
      include: { profile: true, wallet: true }
    });

    if (!user) {
      throw new UnauthorizedError('Invalid credentials. Account not found.');
    }

    if (!user.isActive) {
      throw new UnauthorizedError('Account has been deactivated. Please contact support.');
    }

    // Role enforcement if requested
    if (requiredRole) {
      const userRole = String(user.role).toLowerCase();
      const targetRole = String(requiredRole).toLowerCase();
      if (targetRole === 'teacher' && userRole !== 'teacher') {
        throw new UnauthorizedError('Access denied: Only authorized teachers can log in through this portal.');
      }
      if (targetRole === 'admin' && userRole !== 'admin' && userRole !== 'superadmin') {
        throw new UnauthorizedError('Access denied: Only authorized administrators can log in through this portal.');
      }
      if (targetRole === 'student' && userRole !== 'student') {
        throw new UnauthorizedError('Access denied: Only students can log in through this portal.');
      }
    }

    // Demo accounts fallback if password hash missing
    if (user.passwordHash) {
      const isMatch = await bcrypt.compare(password, user.passwordHash);
      if (!isMatch) {
        throw new UnauthorizedError('Invalid credentials. Incorrect password.');
      }
    } else if (password !== 'Student@123' && password !== 'Admin@123' && password !== 'Teacher@123' && password !== 'Super@123') {
      throw new UnauthorizedError('Invalid credentials. Incorrect password.');
    }

    if (!user.wallet) {
      user.wallet = await prisma.wallet.create({
        data: {
          userId: user.id,
          balancePaise: BigInt(0),
          currency: 'INR'
        }
      }).catch(() => null);
    }

    const safeUser = this.formatSafeUser(user);
    const tokens = this.generateTokens(safeUser);

    // Save session in DB
    await prisma.userSession.create({
      data: {
        userId: user.id,
        token: tokens.refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }
    });

    return {
      user: safeUser,
      token: tokens.token,
      refreshToken: tokens.refreshToken
    };
  }

  static async googleLogin() {
    throw new BadRequestError('Google sign-in has been disabled. Please sign in using your student email and password.');
  }

  /**
   * Step 1 (Registration): Initiate email verification OTP via Brevo
   */
  static async initiateStudentRegistrationOtp({ name, email, target = 'JEE Main' }) {
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanName = String(name || '').trim();

    if (cleanName.length < 2) {
      throw new BadRequestError('Full name must be at least 2 characters long.');
    }
    if (!this.isValidEmail(cleanEmail)) {
      throw new BadRequestError('A valid email address is required.');
    }

    const existing = await prisma.user.findUnique({
      where: { email: cleanEmail }
    });

    if (existing) {
      throw new ConflictError('An account with this email address already exists. Please sign in instead.');
    }

    const otpSession = OtpService.createOtpSession({
      email: cleanEmail,
      purpose: 'registration',
      metadata: { name: cleanName, target }
    });

    try {
      await BrevoService.sendRegistrationOtpEmail({
        email: cleanEmail,
        name: cleanName,
        otp: otpSession.otp
      });
    } catch (err) {
      otpSession.rollback();
      throw err;
    }

    return {
      message: 'A 6-digit verification code has been sent to your email address.',
      email: cleanEmail,
      maskedEmail: otpSession.maskedEmail,
      cooldownSeconds: otpSession.cooldownSeconds,
      expiresInSeconds: otpSession.expiresInSeconds
    };
  }

  /**
   * Step 1 (Password Reset): Initiate password reset OTP via Brevo
   */
  static async initiateStudentPasswordResetOtp({ email }) {
    const cleanEmail = String(email || '').trim().toLowerCase();

    if (!this.isValidEmail(cleanEmail)) {
      throw new BadRequestError('A valid email address is required.');
    }

    const student = await prisma.user.findFirst({
      where: {
        email: cleanEmail,
        role: 'STUDENT'
      }
    });

    if (!student) {
      throw new NotFoundError('No registered student account was found with this email address.');
    }

    if (!student.isActive) {
      throw new BadRequestError('Account has been deactivated. Please contact support.');
    }

    const otpSession = OtpService.createOtpSession({
      email: cleanEmail,
      purpose: 'password_reset',
      metadata: { name: student.name }
    });

    try {
      await BrevoService.sendPasswordResetOtpEmail({
        email: cleanEmail,
        name: student.name,
        otp: otpSession.otp
      });
    } catch (err) {
      otpSession.rollback();
      throw err;
    }

    return {
      message: 'A 6-digit password reset code has been sent to your email address.',
      email: cleanEmail,
      maskedEmail: otpSession.maskedEmail,
      cooldownSeconds: otpSession.cooldownSeconds,
      expiresInSeconds: otpSession.expiresInSeconds
    };
  }

  /**
   * Step 2: Verify 6-digit OTP
   */
  static async verifyStudentOtp({ email, otp, purpose }) {
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanPurpose = String(purpose || 'registration').toLowerCase();

    if (!this.isValidEmail(cleanEmail)) {
      throw new BadRequestError('A valid email address is required.');
    }

    if (!['registration', 'password_reset'].includes(cleanPurpose)) {
      throw new BadRequestError('Invalid verification purpose.');
    }

    const result = OtpService.verifyOtp({
      email: cleanEmail,
      otp,
      purpose: cleanPurpose
    });

    return {
      success: true,
      message: 'Email address verified successfully.',
      verificationToken: result.verificationToken,
      email: cleanEmail,
      maskedEmail: result.maskedEmail
    };
  }

  /**
   * Resend OTP with 60-second cooldown
   */
  static async resendStudentOtp({ email, purpose }) {
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanPurpose = String(purpose || 'registration').toLowerCase();

    if (!this.isValidEmail(cleanEmail)) {
      throw new BadRequestError('A valid email address is required.');
    }

    if (!['registration', 'password_reset'].includes(cleanPurpose)) {
      throw new BadRequestError('Invalid verification purpose.');
    }

    if (cleanPurpose === 'registration') {
      const existing = await prisma.user.findUnique({
        where: { email: cleanEmail }
      });
      if (existing) {
        throw new ConflictError('An account with this email address already exists. Please sign in instead.');
      }
    } else {
      const student = await prisma.user.findFirst({
        where: { email: cleanEmail, role: 'STUDENT' }
      });
      if (!student) {
        throw new NotFoundError('No student account found with this email address.');
      }
    }

    const otpSession = OtpService.resendOtp({
      email: cleanEmail,
      purpose: cleanPurpose
    });

    const name = otpSession.metadata?.name || 'Candidate';

    try {
      if (cleanPurpose === 'registration') {
        await BrevoService.sendRegistrationOtpEmail({
          email: cleanEmail,
          name,
          otp: otpSession.otp
        });
      } else {
        await BrevoService.sendPasswordResetOtpEmail({
          email: cleanEmail,
          name,
          otp: otpSession.otp
        });
      }
    } catch (err) {
      otpSession.rollback();
      throw err;
    }

    return {
      success: true,
      message: 'A fresh 6-digit verification code has been sent to your email.',
      email: cleanEmail,
      maskedEmail: otpSession.maskedEmail,
      cooldownSeconds: otpSession.cooldownSeconds,
      expiresInSeconds: otpSession.expiresInSeconds
    };
  }

  /**
   * Step 3: Complete Student Registration after OTP verification
   */
  static async completeStudentRegistration({
    name,
    email,
    password,
    confirmPassword,
    verificationToken,
    target = 'JEE Main',
    city = 'Pune',
    year = '2027',
    phone = null
  }) {
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanName = String(name || '').trim();

    if (cleanName.length < 2) {
      throw new BadRequestError('Full name must be at least 2 characters long.');
    }

    if (!this.isValidEmail(cleanEmail)) {
      throw new BadRequestError('A valid email address is required.');
    }

    const passCheck = validatePasswordRequirements(password);
    if (!passCheck.isValid) {
      throw new BadRequestError(passCheck.message);
    }

    if (password !== confirmPassword) {
      throw new BadRequestError('Password and Confirm Password do not match.');
    }

    if (!verificationToken) {
      throw new BadRequestError('Verification token is required. Please verify your email first.');
    }

    // Check duplicate email before consuming the verification token
    const existing = await prisma.user.findUnique({
      where: { email: cleanEmail }
    });
    if (existing) {
      throw new ConflictError('An account with this email address already exists. Please sign in instead.');
    }

    OtpService.consumeVerificationToken({
      email: cleanEmail,
      token: verificationToken,
      purpose: 'registration'
    });

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const verifiedAt = new Date().toISOString();

    const result = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          name: cleanName,
          email: cleanEmail,
          passwordHash,
          role: 'STUDENT',
          target,
          city,
          academicYear: year,
          phone
        }
      });

      await tx.userProfile.create({
        data: {
          userId: newUser.id,
          city,
          targetExam: target,
          academicYear: year,
          phone
        }
      });

      await tx.wallet.create({
        data: {
          userId: newUser.id,
          balancePaise: BigInt(0),
          currency: 'INR'
        }
      });

      await tx.auditLog.create({
        data: {
          actorId: newUser.id,
          action: 'STUDENT_EMAIL_VERIFIED',
          detail: 'Student email address verified via Brevo OTP upon registration.',
          metadata: {
            email: cleanEmail,
            provider: 'brevo',
            verifiedAt
          }
        }
      });

      return newUser;
    });

    const safeUser = {
      ...this.formatSafeUser(result),
      emailVerified: true,
      emailVerifiedAt: verifiedAt
    };
    const tokens = this.generateTokens(safeUser);

    await prisma.userSession.create({
      data: {
        userId: result.id,
        token: tokens.refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }
    }).catch(() => null);

    return {
      user: safeUser,
      token: tokens.token,
      refreshToken: tokens.refreshToken
    };
  }

  /**
   * Reset Student Password using verified reset token
   */
  static async resetStudentPassword({ email, resetToken, newPassword, confirmPassword }) {
    const cleanEmail = String(email || '').trim().toLowerCase();

    if (!this.isValidEmail(cleanEmail)) {
      throw new BadRequestError('A valid email address is required.');
    }

    if (!resetToken) {
      throw new BadRequestError('Reset verification token is required.');
    }

    const passCheck = validatePasswordRequirements(newPassword);
    if (!passCheck.isValid) {
      throw new BadRequestError(passCheck.message);
    }

    if (newPassword !== confirmPassword) {
      throw new BadRequestError('New Password and Confirm Password do not match.');
    }

    const student = await prisma.user.findFirst({
      where: {
        email: cleanEmail,
        role: 'STUDENT'
      }
    });

    if (!student) {
      throw new NotFoundError('Student account not found.');
    }

    OtpService.consumeVerificationToken({
      email: cleanEmail,
      token: resetToken,
      purpose: 'password_reset'
    });

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    await prisma.user.update({
      where: { id: student.id },
      data: { passwordHash }
    });

    await prisma.userSession.updateMany({
      where: { userId: student.id },
      data: { isRevoked: true }
    }).catch(() => null);

    await prisma.auditLog.create({
      data: {
        actorId: student.id,
        action: 'STUDENT_PASSWORD_RESET',
        detail: 'Student password reset via Brevo email OTP verification.',
        metadata: {
          email: cleanEmail,
          resetAt: new Date().toISOString()
        }
      }
    }).catch(() => null);

    return {
      success: true,
      message: 'Password has been reset successfully. Please log in with your updated credentials.'
    };
  }

  static async refresh(refreshToken) {
    if (!refreshToken) {
      throw new UnauthorizedError('Refresh token required.');
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET);
    } catch {
      throw new UnauthorizedError('Invalid or expired refresh token.');
    }

    const session = await prisma.userSession.findUnique({
      where: { token: refreshToken }
    });

    if (!session || session.isRevoked || session.expiresAt < new Date()) {
      throw new UnauthorizedError('Session expired or revoked.');
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId }
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedError('User account not found or suspended.');
    }

    const safeUser = this.formatSafeUser(user);
    const tokens = this.generateTokens(safeUser);

    return {
      token: tokens.token,
      refreshToken: tokens.refreshToken
    };
  }

  static async logout(refreshToken) {
    if (refreshToken) {
      await prisma.userSession.updateMany({
        where: { token: refreshToken },
        data: { isRevoked: true }
      });
    }
    return { success: true, message: 'Logged out successfully.' };
  }

  static async getMe(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        wallet: true
      }
    });

    if (!user) {
      throw new NotFoundError('User not found.');
    }

    if (!user.wallet) {
      user.wallet = await prisma.wallet.create({
        data: {
          userId: user.id,
          balancePaise: BigInt(0),
          currency: 'INR'
        }
      }).catch(() => null);
    }

    return this.formatSafeUser(user);
  }
}
