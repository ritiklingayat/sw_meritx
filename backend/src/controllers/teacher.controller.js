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
      const { title, subject, questions } = req.body;
      const count = Number(questions) || 30;
      const bank = await prisma.questionBank.create({
        data: {
          title: title || 'Submitted Examination Paper',
          subject: subject || 'Physics',
          status: 'submitted',
          createdById: req.user?.id || 'teacher-1',
          sourceFilename: 'manual-paper-builder',
          sourceType: 'manual',
          submittedAt: new Date()
        }
      });
      const placeholderQuestions = Array.from({ length: count }, (_, i) => ({
        bankId: bank.id,
        position: i + 1,
        subject: subject || 'General',
        difficulty: 'Medium',
        questionType: 'single_correct',
        text: `${subject || 'Paper'} Question ${i + 1}`,
        options: ['Option A', 'Option B', 'Option C', 'Option D'],
        answer: 0,
        correctOption: 0,
        correctOptions: [0],
        explanation: 'Standard curriculum assessment question.'
      }));
      await prisma.question.createMany({ data: placeholderQuestions });

      return res.status(200).json({
        success: true,
        paper: { id: bank.id, title: bank.title, subject: bank.subject, questions: count, status: 'submitted' },
        message: 'Paper submitted successfully for administrator approval.'
      });
    } catch (err) {
      next(err);
    }
  }

  static async getQuestionBanks(req, res, next) {
    try {
      const data = await TeacherService.getQuestionBanks(req.user.id, req.user.role);
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
      const result = await TeacherService.importQuestionBank(req.user.id, req.body, req.user.role);
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async submitQuestionBank(req, res, next) {
    try {
      const result = await TeacherService.submitQuestionBank(req.body.id || req.params.id, req.user.id, req.user.role);
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async updateQuestionBank(req, res, next) {
    try {
      const result = await TeacherService.updateQuestionBank(req.params.id, req.body);
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
}
