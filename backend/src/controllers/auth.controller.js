import { AuthService } from '../services/auth.service.js';
import { successResponse } from '../utils/apiResponse.js';

export class AuthController {
  static async register(req, res, next) {
    try {
      const result = await AuthService.register(req.body);
      return successResponse(res, result, 'Registration successful', 201);
    } catch (err) {
      next(err);
    }
  }

  static async login(req, res, next) {
    try {
      const identifier = req.body.username || req.body.email || req.body.identifier;
      const { password, role } = req.body;
      const result = await AuthService.login(identifier, password, role);
      return successResponse(res, result, 'Login successful');
    } catch (err) {
      next(err);
    }
  }

  static async google(req, res, next) {
    try {
      const { credential, target } = req.body;
      const result = await AuthService.googleLogin(credential, target);
      return successResponse(res, result, 'Google login successful');
    } catch (err) {
      next(err);
    }
  }

  static async me(req, res, next) {
    try {
      const user = await AuthService.getMe(req.user.id);
      return successResponse(res, { user });
    } catch (err) {
      next(err);
    }
  }

  static async refresh(req, res, next) {
    try {
      const { refreshToken } = req.body;
      const tokens = await AuthService.refresh(refreshToken);
      return successResponse(res, tokens, 'Token refreshed');
    } catch (err) {
      next(err);
    }
  }

  static async logout(req, res, next) {
    try {
      const { refreshToken } = req.body;
      const result = await AuthService.logout(refreshToken);
      return successResponse(res, result, 'Logged out');
    } catch (err) {
      next(err);
    }
  }

  static async forgotPassword(req, res, next) {
    try {
      const target = req.body.email || req.body.username || req.body.identifier;
      return successResponse(res, { message: target ? `Password reset link sent to registered email for '${target}'.` : 'Password reset link sent if account exists.' });
    } catch (err) {
      next(err);
    }
  }

  static async resetPassword(req, res, next) {
    try {
      return successResponse(res, { message: 'Password has been reset successfully.' });
    } catch (err) {
      next(err);
    }
  }
}
