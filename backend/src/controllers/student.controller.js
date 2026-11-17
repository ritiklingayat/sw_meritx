import { StudentService } from '../services/student.service.js';
import { WalletService } from '../services/wallet.service.js';
import { ExamService } from '../services/exam.service.js';
import { prisma } from '../config/prisma.js';
import { successResponse } from '../utils/apiResponse.js';

export class StudentController {
  static async getDashboard(req, res, next) {
    try {
      const data = await StudentService.getDashboard(req.user.id);
      return res.status(200).json(data);
    } catch (err) {
      next(err);
    }
  }

  static async getProfile(req, res, next) {
    try {
      const user = await StudentService.getProfile(req.user.id);
      return successResponse(res, { user });
    } catch (err) {
      next(err);
    }
  }

  static async updateProfile(req, res, next) {
    try {
      const user = await StudentService.updateProfile(req.user.id, req.body);
      return successResponse(res, { user });
    } catch (err) {
      next(err);
    }
  }

  static async getCourses(req, res, next) {
    try {
      const enrollments = await prisma.courseEnrollment.findMany({
        where: { studentId: req.user.id },
        include: { course: true }
      });
      return successResponse(res, { courses: enrollments.map((e) => e.course) });
    } catch (err) {
      next(err);
    }
  }

  static async enrollCourse(req, res, next) {
    try {
      const courseId = req.body.courseId || req.params.id;
      const enrollment = await prisma.courseEnrollment.upsert({
        where: {
          studentId_courseId: {
            studentId: req.user.id,
            courseId
          }
        },
        update: {},
        create: {
          studentId: req.user.id,
          courseId,
          feePaid: 0,
          status: 'active'
        }
      });
      return successResponse(res, { enrollment }, 'Enrolled successfully');
    } catch (err) {
      next(err);
    }
  }

  static async getExams(req, res, next) {
    try {
      const registrations = await prisma.examRegistration.findMany({
        where: { studentId: req.user.id },
        include: { exam: true }
      });
      return successResponse(res, { exams: registrations.map((r) => r.exam) });
    } catch (err) {
      next(err);
    }
  }

  static async getRegistrations(req, res, next) {
    try {
      const registrations = await prisma.examRegistration.findMany({
        where: { studentId: req.user.id },
        include: { exam: true },
        orderBy: { registeredAt: 'desc' }
      });
      return successResponse(res, { registrations });
    } catch (err) {
      next(err);
    }
  }

  static async getResults(req, res, next) {
    try {
      const results = await StudentService.getResults(req.user.id);
      return successResponse(res, { results });
    } catch (err) {
      next(err);
    }
  }

  static async getWallet(req, res, next) {
    try {
      const wallet = await WalletService.getWallet(req.user.id);
      return res.status(200).json(wallet);
    } catch (err) {
      next(err);
    }
  }

  static async getWalletTransactions(req, res, next) {
    try {
      const transactions = await WalletService.getTransactions(req.user.id);
      return successResponse(res, { transactions });
    } catch (err) {
      next(err);
    }
  }

  static async depositOrder(req, res, next) {
    try {
      const order = await WalletService.depositOrder({
        userId: req.user.id,
        amount: req.body.amount
      });
      return res.status(200).json(order);
    } catch (err) {
      next(err);
    }
  }

  static async depositVerify(req, res, next) {
    try {
      const result = await WalletService.addMoney({
        userId: req.user.id,
        amount: req.body.amount,
        method: req.body.method
      });
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async withdraw(req, res, next) {
    try {
      const result = await WalletService.withdrawMoney({
        userId: req.user.id,
        amount: req.body.amount,
        payoutMethod: req.body.payoutMethod,
        destinationDetails: req.body.destinationDetails
      });
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async getWithdrawals(req, res, next) {
    try {
      const withdrawals = await WalletService.getWithdrawals(req.user.id);
      return res.status(200).json({ withdrawals });
    } catch (err) {
      next(err);
    }
  }
}
