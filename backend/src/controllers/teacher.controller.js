import { TeacherService } from '../services/teacher.service.js';

export class TeacherController {
  static async getDashboard(req, res, next) {
    try {
      const data = await TeacherService.getDashboard(req.user.id);
      return res.status(200).json(data);
    } catch (err) {
      next(err);
    }
  }

  static async getProfile(req, res, next) {
    try {
      const data = await TeacherService.getProfile(req.user.id);
      return res.status(200).json(data);
    } catch (err) {
      next(err);
    }
  }

  static async updateProfile(req, res, next) {
    try {
      const data = await TeacherService.updateProfile(req.user.id, req.body);
      return res.status(200).json(data);
    } catch (err) {
      next(err);
    }
  }

  static async getPapers(req, res, next) {
    try {
      return res.status(200).json({
        papers: [
          { id: 'p-1', title: 'Grand Mock Physics 2026', subject: 'Physics', questions: 25, status: 'approved', date: '2026-10-20' },
          { id: 'p-2', title: 'Inorganic Chemistry Sprint', subject: 'Chemistry', questions: 25, status: 'approved', date: '2026-10-22' }
        ]
      });
    } catch (err) {
      next(err);
    }
  }

  static async createPaper(req, res, next) {
    try {
      return res.status(200).json({
        success: true,
        paper: { id: `pap-${Date.now()}`, ...req.body, status: 'approved' }
      });
    } catch (err) {
      next(err);
    }
  }

  static async getQuestionBanks(req, res, next) {
    try {
      const data = await TeacherService.getQuestionBanks(req.user.id);
      return res.status(200).json(data);
    } catch (err) {
      next(err);
    }
  }

  static async getQuestionBankById(req, res, next) {
    try {
      const data = await TeacherService.getQuestionBankById(req.params.id);
      return res.status(200).json(data);
    } catch (err) {
      next(err);
    }
  }

  static async importQuestionBank(req, res, next) {
    try {
      const result = await TeacherService.importQuestionBank(req.user.id, req.body);
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async submitQuestionBank(req, res, next) {
    try {
      const result = await TeacherService.submitQuestionBank(req.body.id || req.params.id);
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async updateQuestionBank(req, res, next) {
    try {
      return res.status(200).json({
        success: true,
        bank: {
          id: req.params.id,
          title: req.body.title || 'Updated Question Bank',
          subject: req.body.subject || 'Physics',
          status: 'draft'
        }
      });
    } catch (err) {
      next(err);
    }
  }
}
