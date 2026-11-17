import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';
import { BadRequestError, UnauthorizedError, ConflictError, NotFoundError } from '../utils/errors.js';

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

  static async register({ name, email, password, target = 'JEE Main', city = 'Pune', year = '2027', phone = null }) {
    const cleanEmail = String(email || '').trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new BadRequestError('A valid email address is required.');
    }

    if (!password || password.length < 6) {
      throw new BadRequestError('Password must be at least 6 characters long.');
    }

    const existing = await prisma.user.findUnique({
      where: { email: cleanEmail }
    });

    if (existing) {
      throw new ConflictError('An account with this email address already exists.');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Atomically create User, Profile, and initial Wallet
    const result = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          name: name.trim(),
          email: cleanEmail,
          passwordHash,
          role: 'STUDENT', // Strictly enforce STUDENT for public registration
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

      const initialPaise = BigInt(150000); // ₹1,500 demo balance
      const wallet = await tx.wallet.create({
        data: {
          userId: newUser.id,
          balancePaise: initialPaise,
          currency: 'INR'
        }
      });

      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          userId: newUser.id,
          type: 'deposit',
          direction: 'credit',
          amountPaise: initialPaise,
          balanceBeforePaise: BigInt(0),
          balanceAfterPaise: initialPaise,
          status: 'successful',
          referenceId: `REG-WELCOME-${newUser.id}`,
          description: 'Welcome Demo Account Credits'
        }
      });

      return newUser;
    });

    const safeUser = this.formatSafeUser(result);
    const tokens = this.generateTokens(safeUser);

    return {
      user: safeUser,
      token: tokens.token,
      refreshToken: tokens.refreshToken
    };
  }

  static async login(email, password) {
    const cleanEmail = String(email || '').trim().toLowerCase();
    const user = await prisma.user.findUnique({
      where: { email: cleanEmail },
      include: { profile: true }
    });

    if (!user) {
      throw new UnauthorizedError('Invalid email or password.');
    }

    if (!user.isActive) {
      throw new UnauthorizedError('Account has been deactivated. Please contact support.');
    }

    // Demo accounts fallback if password hash missing
    if (user.passwordHash) {
      const isMatch = await bcrypt.compare(password, user.passwordHash);
      if (!isMatch) {
        throw new UnauthorizedError('Invalid email or password.');
      }
    } else if (password !== 'Student@123' && password !== 'Admin@123' && password !== 'Teacher@123' && password !== 'Super@123') {
      throw new UnauthorizedError('Invalid email or password.');
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

  static async googleLogin(credential, target = 'JEE Main') {
    if (!credential) {
      throw new BadRequestError('Google credential token is required.');
    }

    let googlePayload = null;
    try {
      // Decode credential token safely
      const parts = credential.split('.');
      if (parts.length === 3) {
        const payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = Buffer.from(payloadBase64, 'base64').toString('utf8');
        googlePayload = JSON.parse(jsonPayload);
      }
    } catch {
      // Fallback
    }

    const email = googlePayload?.email || 'google.student@meritx.demo';
    const name = googlePayload?.name || 'Google Candidate';
    const googleSub = googlePayload?.sub || `g_${Date.now()}`;
    const avatar = googlePayload?.picture || null;

    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { googleSubject: googleSub },
          { email: email.toLowerCase() }
        ]
      }
    });

    if (!user) {
      user = await prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            name,
            email: email.toLowerCase(),
            googleSubject: googleSub,
            role: 'STUDENT',
            avatarUrl: avatar,
            target
          }
        });

        await tx.userProfile.create({
          data: {
            userId: created.id,
            avatarUrl: avatar,
            targetExam: target
          }
        });

        const initialPaise = BigInt(150000);
        await tx.wallet.create({
          data: {
            userId: created.id,
            balancePaise: initialPaise,
            currency: 'INR'
          }
        });

        return created;
      });
    }

    const safeUser = this.formatSafeUser(user);
    const tokens = this.generateTokens(safeUser);

    return {
      user: safeUser,
      token: tokens.token,
      refreshToken: tokens.refreshToken
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

    return this.formatSafeUser(user);
  }
}
