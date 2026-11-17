import { FinanceService } from '../services/finance.service.js';

export class FinanceController {
  static async getOverview(req, res, next) {
    try {
      const data = await FinanceService.getOverview();
      return res.status(200).json(data);
    } catch (err) {
      next(err);
    }
  }

  static async getMasterWallet(req, res, next) {
    try {
      const data = await FinanceService.getMasterWallet();
      return res.status(200).json(data);
    } catch (err) {
      next(err);
    }
  }

  static async withdrawMasterWallet(req, res, next) {
    try {
      const data = await FinanceService.withdrawMasterWallet(req.body.amount);
      return res.status(200).json(data);
    } catch (err) {
      next(err);
    }
  }

  static async getTeachers(req, res, next) {
    try {
      const data = await FinanceService.getTeachersFinance();
      return res.status(200).json(data);
    } catch (err) {
      next(err);
    }
  }

  static async getPayments(req, res, next) {
    try {
      const data = await FinanceService.getPayments();
      return res.status(200).json(data);
    } catch (err) {
      next(err);
    }
  }

  static async getRefunds(req, res, next) {
    try {
      const data = await FinanceService.getRefunds();
      return res.status(200).json(data);
    } catch (err) {
      next(err);
    }
  }

  static async getWallets(req, res, next) {
    try {
      const data = await FinanceService.getAllStudentWallets();
      return res.status(200).json(data);
    } catch (err) {
      next(err);
    }
  }

  static async getWalletById(req, res, next) {
    try {
      const data = await FinanceService.getStudentWalletDetails(req.params.id);
      return res.status(200).json(data);
    } catch (err) {
      next(err);
    }
  }

  static async getWithdrawals(req, res, next) {
    try {
      const data = await FinanceService.getWithdrawals();
      return res.status(200).json(data);
    } catch (err) {
      next(err);
    }
  }

  static async reviewWithdrawal(req, res, next) {
    try {
      const data = await FinanceService.reviewWithdrawal(req.params.id);
      return res.status(200).json(data);
    } catch (err) {
      next(err);
    }
  }

  static async getReports(req, res, next) {
    try {
      const data = await FinanceService.getReports();
      return res.status(200).json(data);
    } catch (err) {
      next(err);
    }
  }
}
