import { prisma } from '../config/prisma.js';
import { NotFoundError, BadRequestError, ConflictError } from '../utils/errors.js';
import { ScoringService } from './scoring.service.js';

export class ExamService {
  static async getExams({ search = '', type = '', status = '', courseId = '' } = {}) {
    const where = {};

    if (status) {
      where.status = status;
    } else {
      where.status = { not: 'archived' };
    }

    if (courseId) {
      where.courseId = courseId;
    }

    if (type) {
      where.type = { contains: type, mode: 'insensitive' };
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { subject: { contains: search, mode: 'insensitive' } },
        { type: { contains: search, mode: 'insensitive' } }
      ];
    }

    const exams = await prisma.exam.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });

    return exams.map((e) => ({
      ...e,
      fee: Math.round(Number(e.fee || 0) / 100) // return fee in ₹ to match frontend format
    }));
  }

  static async getExamById(id) {
    if (!id) {
      const first = await prisma.exam.findFirst();
      if (!first) throw new NotFoundError('No examinations found.');
      return { ...first, fee: Math.round(Number(first.fee || 0) / 100) };
    }

    // 1. Exact match
    let exam = await prisma.exam.findUnique({
      where: { id }
    });

    if (exam) return { ...exam, fee: Math.round(Number(exam.fee || 0) / 100) };

    // 2. Course ID match
    exam = await prisma.exam.findFirst({
      where: { courseId: id }
    });
    if (exam) return { ...exam, fee: Math.round(Number(exam.fee || 0) / 100) };

    // 3. Match type or title keywords
    const clean = String(id).toLowerCase();
    exam = await prisma.exam.findFirst({
      where: {
        OR: [
          { id: { contains: clean, mode: 'insensitive' } },
          { title: { contains: clean, mode: 'insensitive' } },
          { type: { contains: clean, mode: 'insensitive' } }
        ]
      }
    });

    if (exam) return { ...exam, fee: Math.round(Number(exam.fee || 0) / 100) };

    // Safe fallback: return first exam
    const fallback = await prisma.exam.findFirst();
    return fallback ? { ...fallback, fee: Math.round(Number(fallback.fee || 0) / 100) } : null;
  }

  static async registerExam(studentId, examId) {
    const exam = await prisma.exam.findUnique({ where: { id: examId } });
    if (!exam) throw new NotFoundError('Examination not found.');

    // 1. Duplicate check
    const existingReg = await prisma.examRegistration.findUnique({
      where: {
        studentId_examId: {
          studentId,
          examId
        }
      }
    });

    if (existingReg) {
      return {
        success: false,
        error: 'ALREADY_REGISTERED',
        message: 'You have already registered for this examination.',
        registration: existingReg
      };
    }

    // 2. Schedule window check
    if (exam.schedule) {
      const schedule = exam.schedule;
      const now = new Date();
      if (schedule.registrationOpensAt && new Date(schedule.registrationOpensAt) > now) {
        throw new BadRequestError(`Registration opens on ${new Date(schedule.registrationOpensAt).toLocaleString('en-IN')}.`);
      }
      if (schedule.registrationClosesAt && new Date(schedule.registrationClosesAt) < now) {
        throw new BadRequestError('Registration for this examination has closed.');
      }
    }

    // 3. Wallet deduction in integer paise
    const feePaise = BigInt(exam.fee || 0);

    const result = await prisma.$transaction(async (tx) => {
      let wallet = await tx.wallet.findUnique({ where: { userId: studentId } });
      if (!wallet) {
        wallet = await tx.wallet.create({
          data: {
            userId: studentId,
            balancePaise: BigInt(150000), // ₹1,500
            currency: 'INR'
          }
        });
      }

      if (wallet.balancePaise < feePaise) {
        const balanceRs = Number(wallet.balancePaise) / 100;
        const feeRs = Number(feePaise) / 100;
        throw new BadRequestError(`Insufficient wallet balance. You have ₹${balanceRs}, but ₹${feeRs} is required.`);
      }

      const balanceBefore = wallet.balancePaise;
      const balanceAfter = balanceBefore - feePaise;

      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balancePaise: balanceAfter }
      });

      const txRef = `TX-REG-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const walletTx = await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          userId: studentId,
          type: 'debit',
          direction: 'debit',
          amountPaise: feePaise,
          balanceBeforePaise: balanceBefore,
          balanceAfterPaise: balanceAfter,
          status: 'successful',
          referenceId: txRef,
          description: `Registration Fee: ${exam.title}`
        }
      });

      await tx.walletLedgerEntry.create({
        data: {
          walletId: wallet.id,
          transactionKey: `LEDGER-${txRef}`,
          entryType: 'DEBIT',
          category: 'EXAM_REGISTRATION',
          amountPaise: feePaise,
          balanceAfterPaise: balanceAfter,
          memo: `Exam Registration: ${exam.title}`
        }
      });

      const registration = await tx.examRegistration.create({
        data: {
          studentId,
          examId,
          amountPaid: Number(feePaise),
          paymentStatus: 'successful',
          status: 'confirmed'
        }
      });

      await tx.exam.update({
        where: { id: examId },
        data: { registeredCount: { increment: 1 } }
      });

      return {
        registration,
        transaction: walletTx,
        newBalance: Number(balanceAfter) / 100
      };
    });

    return {
      success: true,
      message: 'Registration confirmed and fee deducted successfully.',
      ...result
    };
  }

  static async getExamPatterns() {
    return prisma.examPattern.findMany({
      where: { status: 'active' },
      orderBy: { officialYear: 'desc' }
    });
  }

  static async createExam(examData) {
    const feePaise = Number(examData.fee || 0) * 100;
    const created = await prisma.exam.create({
      data: {
        id: examData.id || `exam-${Date.now()}`,
        patternId: examData.patternId || null,
        courseId: examData.courseId || null,
        title: examData.title,
        type: examData.type || 'Mock Exam',
        category: examData.category || 'General',
        subject: examData.subject || 'All Subjects',
        date: examData.date || null,
        time: examData.time || null,
        duration: Number(examData.duration || 180),
        questionsCount: Number(examData.questions || examData.questionsCount || 30),
        marks: Number(examData.marks || 300),
        passingMarks: Number(examData.passingMarks || 120),
        negativeMarking: examData.negativeMarking ?? true,
        maxAttempts: Number(examData.maxAttempts || 1),
        proctoringRequired: examData.proctoringRequired ?? true,
        fee: feePaise,
        tag: examData.tag || null,
        description: examData.description || null,
        syllabus: examData.syllabus || null,
        status: examData.status || 'published',
        registrationOpen: examData.registrationOpen ?? true,
        bannerImageUrl: examData.bannerImageUrl || null,
        schedule: examData.schedule || null,
        configuration: examData.configuration || null
      }
    });

    return {
      ...created,
      fee: Math.round(Number(created.fee || 0) / 100)
    };
  }

  static async updateExam(id, updates) {
    const data = { ...updates };
    if (data.fee !== undefined) {
      data.fee = Number(data.fee) * 100;
    }
    const updated = await prisma.exam.update({
      where: { id },
      data
    });
    return {
      ...updated,
      fee: Math.round(Number(updated.fee || 0) / 100)
    };
  }

  static async deleteExam(id) {
    await prisma.exam.delete({
      where: { id }
    });
    return { success: true };
  }
}
