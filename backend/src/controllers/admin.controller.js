import { AdminService } from '../services/admin.service.js';
import { ExamService } from '../services/exam.service.js';
import { QuestionService } from '../services/question.service.js';
import { ProctoringService } from '../services/proctoring.service.js';
import { TeacherService } from '../services/teacher.service.js';
import { prisma } from '../config/prisma.js';

export class AdminController {
  static async getOverview(req, res, next) {
    try {
      const data = await AdminService.getOverview();
      return res.status(200).json(data);
    } catch (err) {
      next(err);
    }
  }

  static async getStudents(req, res, next) {
    try {
      const students = await AdminService.getStudents();
      return res.status(200).json({ students });
    } catch (err) {
      next(err);
    }
  }

  static async getRegistrations(req, res, next) {
    try {
      const data = await AdminService.getRegistrations(req.query);
      return res.status(200).json(data);
    } catch (err) {
      next(err);
    }
  }

  static async getTransactions(req, res, next) {
    try {
      const data = await AdminService.getAllWalletTransactions(req.query);
      return res.status(200).json(data);
    } catch (err) {
      next(err);
    }
  }

  static async getExams(req, res, next) {
    try {
      const exams = await ExamService.getExams(req.query);
      return res.status(200).json({ exams });
    } catch (err) {
      next(err);
    }
  }

  static async createExam(req, res, next) {
    try {
      const exam = await ExamService.createExam(req.body);
      return res.status(201).json({ exam });
    } catch (err) {
      next(err);
    }
  }

  static async updateExam(req, res, next) {
    try {
      const exam = await ExamService.updateExam(req.params.id, req.body);
      return res.status(200).json({ exam });
    } catch (err) {
      next(err);
    }
  }

  static async deleteExam(req, res, next) {
    try {
      await ExamService.deleteExam(req.params.id);
      return res.status(200).json({ success: true });
    } catch (err) {
      next(err);
    }
  }

  static async getCourses(req, res, next) {
    try {
      const courses = await prisma.course.findMany({ orderBy: { displayOrder: 'asc' } });
      return res.status(200).json({ courses });
    } catch (err) {
      next(err);
    }
  }

  static async createCourse(req, res, next) {
    try {
      const course = await prisma.course.create({ data: req.body });
      return res.status(201).json({ course });
    } catch (err) {
      next(err);
    }
  }

  static async updateCourse(req, res, next) {
    try {
      const course = await prisma.course.update({ where: { id: req.params.id }, data: req.body });
      return res.status(200).json({ course });
    } catch (err) {
      next(err);
    }
  }

  static async deleteCourse(req, res, next) {
    try {
      await prisma.course.delete({ where: { id: req.params.id } });
      return res.status(200).json({ success: true });
    } catch (err) {
      next(err);
    }
  }

  static async getTickets(req, res, next) {
    try {
      const tickets = await AdminService.getSupportTickets();
      return res.status(200).json({ tickets });
    } catch (err) {
      next(err);
    }
  }

  static async updateTicket(req, res, next) {
    try {
      const ticket = await AdminService.updateTicket(req.params.id, req.body);
      return res.status(200).json({ ticket });
    } catch (err) {
      next(err);
    }
  }

  static async getResults(req, res, next) {
    try {
      const results = await AdminService.getResults();
      return res.status(200).json({ results });
    } catch (err) {
      next(err);
    }
  }

  static async getProctoringOverview(req, res, next) {
    try {
      const data = await ProctoringService.getSummary();
      return res.status(200).json(data);
    } catch (err) {
      next(err);
    }
  }

  static async getProctoringCandidates(req, res, next) {
    try {
      const candidates = await ProctoringService.getCandidatesStatus();
      return res.status(200).json({ candidates });
    } catch (err) {
      next(err);
    }
  }

  static async getProctoringEvents(req, res, next) {
    try {
      const events = await prisma.proctoringEvent.findMany({ take: 200, orderBy: { createdAt: 'desc' } });
      return res.status(200).json({ events });
    } catch (err) {
      next(err);
    }
  }

  static async getProctoringTimeline(req, res, next) {
    try {
      const data = await ProctoringService.getTimeline(req.params.id);
      return res.status(200).json(data);
    } catch (err) {
      next(err);
    }
  }

  static async approvePaper(req, res, next) {
    try {
      return res.status(200).json({ success: true, message: 'Paper approved for examination creation.' });
    } catch (err) {
      next(err);
    }
  }

  static async getQuestionBanks(req, res, next) {
    try {
      const data = await TeacherService.getQuestionBanks(req.user?.id || 'admin-1', req.user?.role || 'ADMIN');
      return res.status(200).json(data);
    } catch (err) {
      next(err);
    }
  }

  static async importQuestionBank(req, res, next) {
    try {
      const result = await TeacherService.importQuestionBank(req.user?.id || 'admin-1', req.body, req.user?.role || 'ADMIN');
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async approveQuestionBank(req, res, next) {
    try {
      const bankId = req.body.bankId || req.body.id || req.params.id;
      const result = await AdminService.approveQuestionBank(bankId, req.user?.id || 'admin-1');
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async rejectQuestionBank(req, res, next) {
    try {
      const bankId = req.body.bankId || req.body.id || req.params.id;
      const result = await AdminService.rejectQuestionBank(bankId, req.body.reason, req.user?.id || 'admin-1');
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async publishQuestionBank(req, res, next) {
    try {
      const bankId = req.body.bankId || req.body.id || req.params.id;
      const result = await AdminService.publishQuestionBank(bankId, req.user?.id || 'admin-1');
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async getPrizeDistributions(req, res, next) {
    try {
      return res.status(200).json({
        distributions: [
          { id: 'prz-1', examId: req.query.examId || 'jee-main-01', studentId: 'student-1', studentName: 'Aarav Sharma', rank: 1, amount: 15000, status: 'approved' },
          { id: 'prz-2', examId: req.query.examId || 'jee-main-01', studentId: 'student-2', studentName: 'Priya Patel', rank: 2, amount: 7000, status: 'approved' }
        ]
      });
    } catch (err) {
      next(err);
    }
  }

  static async getPrizeRankings(req, res, next) {
    try {
      return res.status(200).json({
        rankings: [
          { studentId: 'student-1', studentName: 'Aarav Sharma', rank: 1, score: 285, percentage: 95 },
          { studentId: 'student-2', studentName: 'Priya Patel', rank: 2, score: 270, percentage: 90 },
          { studentId: 'student-3', studentName: 'Rohan Deshmukh', rank: 3, score: 255, percentage: 85 }
        ]
      });
    } catch (err) {
      next(err);
    }
  }

  static async approvePrize(req, res, next) {
    try {
      return res.status(200).json({ success: true, message: `Prize distribution ${req.params.id} approved.` });
    } catch (err) {
      next(err);
    }
  }
}
