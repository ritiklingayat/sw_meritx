import crypto from 'crypto';
import { env } from '../config/env.js';
import { BadRequestError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

// OTP validity: 5 minutes in milliseconds
const OTP_TTL_MS = 5 * 60 * 1000;
// Resend cooldown: 60 seconds
const RESEND_COOLDOWN_MS = 60 * 1000;
// Resend window rate limit: max 5 OTP sends per 15 minutes per email + purpose
const RESEND_WINDOW_MS = 15 * 60 * 1000;
const MAX_SENDS_PER_WINDOW = 5;
// Maximum incorrect attempts before OTP invalidation
const MAX_ATTEMPTS = 5;
// Verification token validity: 15 minutes
const VERIFY_TOKEN_TTL_MS = 15 * 60 * 1000;

export class OtpService {
  // In-memory state store for active OTPs & verification tokens
  static store = new Map();
  // Separate rate-limit history so cooldown & send caps persist even if an OTP is invalidated by failed attempts
  static rateLimitStore = new Map();

  /**
   * Compute an HMAC-SHA256 hash of the OTP using the server secret.
   */
  static hashOtp(otp, salt = '') {
    const secret = env.JWT_SECRET || 'meritx_otp_secret_key_2026';
    return crypto
      .createHmac('sha256', secret)
      .update(`${otp}:${salt}`)
      .digest('hex');
  }

  /**
   * Mask an email address for safe UI display (e.g., "ad***a@gmail.com").
   */
  static maskEmail(email) {
    if (!email || !email.includes('@')) return email || '';
    const [local, domain] = email.split('@');
    if (local.length <= 2) {
      return `${local[0]}***@${domain}`;
    }
    const visibleStart = local.slice(0, 2);
    const visibleEnd = local.slice(-1);
    return `${visibleStart}***${visibleEnd}@${domain}`;
  }

  /**
   * Generate a cryptographically secure 6-digit numeric OTP (100000 to 999999).
   */
  static generateNumericOtp() {
    return crypto.randomInt(100000, 1000000).toString();
  }

  /**
   * Key generator for OTP and rate-limit stores.
   */
  static getStoreKey(email, purpose) {
    return `${String(purpose || 'registration').toLowerCase()}:${String(email || '').trim().toLowerCase()}`;
  }

  /**
   * Enforce 60s resend cooldown and per-window send rate limits.
   */
  static assertCanSendOtp(key, now = Date.now()) {
    const rl = this.rateLimitStore.get(key);
    if (rl) {
      if (rl.lastSentAt && now - rl.lastSentAt < RESEND_COOLDOWN_MS) {
        const waitSeconds = Math.ceil((RESEND_COOLDOWN_MS - (now - rl.lastSentAt)) / 1000);
        throw new BadRequestError(`Please wait ${waitSeconds} seconds before requesting a new verification code.`);
      }
      const recentSends = (rl.sendTimestamps || []).filter((ts) => now - ts < RESEND_WINDOW_MS);
      if (recentSends.length >= MAX_SENDS_PER_WINDOW) {
        const oldest = recentSends[0];
        const waitMinutes = Math.max(1, Math.ceil((RESEND_WINDOW_MS - (now - oldest)) / 60000));
        throw new BadRequestError(
          `Too many verification code requests. Please try again in ${waitMinutes} minute${waitMinutes === 1 ? '' : 's'}.`
        );
      }
    }

    const existing = this.store.get(key);
    if (existing && existing.lastSentAt && now - existing.lastSentAt < RESEND_COOLDOWN_MS) {
      const waitSeconds = Math.ceil((RESEND_COOLDOWN_MS - (now - existing.lastSentAt)) / 1000);
      throw new BadRequestError(`Please wait ${waitSeconds} seconds before requesting a new verification code.`);
    }
  }

  /**
   * Record a successful OTP send in the rate-limit window.
   */
  static recordSend(key, now = Date.now()) {
    const prev = this.rateLimitStore.get(key);
    const recentSends = (prev?.sendTimestamps || []).filter((ts) => now - ts < RESEND_WINDOW_MS);
    recentSends.push(now);
    this.rateLimitStore.set(key, {
      lastSentAt: now,
      sendTimestamps: recentSends
    });
  }

  /**
   * Create and record a new OTP session.
   * Returns a rollback() function so callers can revert state if Brevo delivery fails.
   */
  static createOtpSession({ email, purpose, metadata = {} }) {
    const cleanEmail = String(email || '').trim().toLowerCase();
    const key = this.getStoreKey(cleanEmail, purpose);
    const now = Date.now();

    this.assertCanSendOtp(key, now);

    const previousRecord = this.store.get(key) || null;
    const previousRateLimit = this.rateLimitStore.get(key)
      ? {
          lastSentAt: this.rateLimitStore.get(key).lastSentAt,
          sendTimestamps: [...this.rateLimitStore.get(key).sendTimestamps]
        }
      : null;

    const otp = this.generateNumericOtp();
    const salt = crypto.randomBytes(16).toString('hex');
    const otpHash = this.hashOtp(otp, salt);

    const record = {
      email: cleanEmail,
      purpose,
      otpHash,
      salt,
      attempts: 0,
      maxAttempts: MAX_ATTEMPTS,
      expiresAt: now + OTP_TTL_MS,
      lastSentAt: now,
      metadata: { ...metadata },
      verified: false,
      verificationToken: null,
      tokenExpiresAt: null
    };

    this.store.set(key, record);
    this.recordSend(key, now);

    logger.info(`[OtpService] Generated new OTP for ${this.maskEmail(cleanEmail)} (Purpose: ${purpose}, Expires in 5m)`);

    const rollback = () => {
      if (previousRecord) {
        this.store.set(key, previousRecord);
      } else {
        this.store.delete(key);
      }
      if (previousRateLimit) {
        this.rateLimitStore.set(key, previousRateLimit);
      } else {
        this.rateLimitStore.delete(key);
      }
    };

    return {
      otp, // strictly for delivery via Brevo email only
      maskedEmail: this.maskEmail(cleanEmail),
      expiresInSeconds: Math.floor(OTP_TTL_MS / 1000),
      cooldownSeconds: Math.floor(RESEND_COOLDOWN_MS / 1000),
      metadata: record.metadata,
      rollback
    };
  }

  /**
   * Verify entered 6-digit OTP against the stored hashed OTP.
   */
  static verifyOtp({ email, otp, purpose }) {
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanOtp = String(otp || '').trim();
    const key = this.getStoreKey(cleanEmail, purpose);
    const record = this.store.get(key);

    if (!cleanOtp || cleanOtp.length !== 6 || !/^\d{6}$/.test(cleanOtp)) {
      throw new BadRequestError('A valid 6-digit verification code is required.');
    }

    if (!record) {
      throw new BadRequestError('No active verification session found. Please request a new code.');
    }

    if (record.verified || !record.otpHash) {
      throw new BadRequestError('This verification code has already been used. Please request a new code if needed.');
    }

    const now = Date.now();

    if (now > record.expiresAt) {
      this.store.delete(key);
      throw new BadRequestError('Verification code has expired (5-minute limit). Please request a new code.');
    }

    if (record.attempts >= record.maxAttempts) {
      this.store.delete(key);
      throw new BadRequestError('Maximum verification attempts exceeded. Please request a new code.');
    }

    const computedHash = this.hashOtp(cleanOtp, record.salt);
    const computedBuf = Buffer.from(computedHash, 'utf8');
    const storedBuf = Buffer.from(record.otpHash, 'utf8');
    const isMatch = computedBuf.length === storedBuf.length && crypto.timingSafeEqual(computedBuf, storedBuf);

    if (!isMatch) {
      record.attempts += 1;
      const remaining = record.maxAttempts - record.attempts;
      if (remaining <= 0) {
        this.store.delete(key);
        throw new BadRequestError('Incorrect verification code. Maximum attempts exceeded. Please request a new code.');
      }
      throw new BadRequestError(`Incorrect verification code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`);
    }

    // OTP verified successfully: generate single-use verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    record.verified = true;
    record.verificationToken = verificationToken;
    record.tokenExpiresAt = now + VERIFY_TOKEN_TTL_MS;

    // Erase OTP hash immediately to prevent any OTP reuse
    record.otpHash = null;

    logger.info(`[OtpService] Successfully verified OTP for ${this.maskEmail(cleanEmail)} (Purpose: ${purpose})`);

    return {
      success: true,
      email: cleanEmail,
      maskedEmail: this.maskEmail(cleanEmail),
      verificationToken,
      tokenExpiresInSeconds: Math.floor(VERIFY_TOKEN_TTL_MS / 1000)
    };
  }

  /**
   * Validate and consume the single-use verification token.
   */
  static consumeVerificationToken({ email, token, purpose }) {
    const cleanEmail = String(email || '').trim().toLowerCase();
    const key = this.getStoreKey(cleanEmail, purpose);
    const record = this.store.get(key);

    if (!record || !record.verified || !record.verificationToken) {
      throw new BadRequestError('Email address has not been verified with a valid OTP. Please complete verification first.');
    }

    if (Date.now() > record.tokenExpiresAt) {
      this.store.delete(key);
      throw new BadRequestError('Verification session has expired. Please verify your email again.');
    }

    const tokenBuf = Buffer.from(String(token || ''), 'utf8');
    const storedBuf = Buffer.from(record.verificationToken, 'utf8');
    if (tokenBuf.length !== storedBuf.length || !crypto.timingSafeEqual(tokenBuf, storedBuf)) {
      throw new BadRequestError('Invalid verification token. Security check failed.');
    }

    // Consume the token (single use)
    this.store.delete(key);
    return true;
  }

  /**
   * Resend OTP for an existing session with cooldown & window rate-limit enforcement.
   */
  static resendOtp({ email, purpose }) {
    const cleanEmail = String(email || '').trim().toLowerCase();
    const key = this.getStoreKey(cleanEmail, purpose);
    const existing = this.store.get(key);
    const metadata = existing?.metadata || {};
    return this.createOtpSession({ email: cleanEmail, purpose, metadata });
  }

  /**
   * Clear expired OTP and rate-limit records.
   */
  static cleanup() {
    const now = Date.now();
    for (const [key, record] of this.store.entries()) {
      const maxExpiry = Math.max(record.expiresAt || 0, record.tokenExpiresAt || 0);
      if (now > maxExpiry + 60000) {
        this.store.delete(key);
      }
    }
    for (const [key, rl] of this.rateLimitStore.entries()) {
      const recent = (rl.sendTimestamps || []).filter((ts) => now - ts < RESEND_WINDOW_MS);
      if (recent.length === 0 && now - (rl.lastSentAt || 0) > RESEND_COOLDOWN_MS) {
        this.rateLimitStore.delete(key);
      } else {
        rl.sendTimestamps = recent;
      }
    }
  }
}

// Lazy cleanup interval every 10 minutes
setInterval(() => OtpService.cleanup(), 10 * 60 * 1000).unref();
