import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { authRateLimiter } from '../middleware/rateLimiter.middleware.js';

const router = Router();

router.post('/register', authRateLimiter, AuthController.register);
router.post('/login', authRateLimiter, AuthController.login);
router.post('/google', authRateLimiter, AuthController.google);
router.get('/me', authenticate, AuthController.me);
router.post('/refresh', AuthController.refresh);
router.post('/logout', AuthController.logout);
router.post('/forgot-password', authRateLimiter, AuthController.forgotPassword);
router.post('/reset-password', authRateLimiter, AuthController.resetPassword);

// Dedicated Student Brevo OTP Authentication Routes
router.post('/student/send-otp', authRateLimiter, AuthController.studentSendOtp);
router.post('/student/verify-otp', authRateLimiter, AuthController.studentVerifyOtp);
router.post('/student/resend-otp', authRateLimiter, AuthController.studentResendOtp);
router.post('/student/complete-registration', authRateLimiter, AuthController.studentCompleteRegistration);
router.post('/student/reset-password', authRateLimiter, AuthController.studentResetPassword);

export default router;
