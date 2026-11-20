import { prisma } from '../config/prisma.js';
import { NotFoundError, BadRequestError, ConflictError } from '../utils/errors.js';
import { ScoringService } from './scoring.service.js';

export function formatExam(e) {
  if (!e) return null;
  const cfg = (e.configuration && typeof e.configuration === 'object') ? e.configuration : {};
  return {
    ...e,
    questions: e.questionsCount ?? e.questions ?? 30,
    fee: Math.round(Number(e.fee || 0) / 100),
    negativeMarkValue: cfg.negativeMarkValue ?? (e.negativeMarking ? 1 : 0),
    cameraRequired: cfg.cameraRequired ?? (e.proctoringRequired ?? true),
    micRequired: cfg.micRequired ?? (e.proctoringRequired ?? true),
    showResultsImmediate: cfg.showResultsImmediate ?? true,
    enableLeaderboard: cfg.enableLeaderboard ?? true
  };
}

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

    return exams.map(formatExam);
  }

  static async getExamById(id) {
    if (!id) {
      const first = await prisma.exam.findFirst();
      if (!first) throw new NotFoundError('No examinations found.');
      return formatExam(first);
    }

    // 1. Exact match
    let exam = await prisma.exam.findUnique({
      where: { id }
    });

    if (exam) return formatExam(exam);

    // 2. Course ID match
    exam = await prisma.exam.findFirst({
      where: { courseId: id }
    });
    if (exam) return formatExam(exam);

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

    if (exam) return formatExam(exam);

    // Safe fallback: return first exam
    const fallback = await prisma.exam.findFirst();
    return fallback ? formatExam(fallback) : null;
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
            balancePaise: BigInt(0), // ₹0 default
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

    let configuration = examData.configuration;
    if (configuration && typeof configuration === 'object') {
      configuration = {
        ...configuration,
        ...(examData.negativeMarkValue !== undefined && { negativeMarkValue: Number(examData.negativeMarkValue) }),
        ...(examData.cameraRequired !== undefined && { cameraRequired: Boolean(examData.cameraRequired) }),
        ...(examData.micRequired !== undefined && { micRequired: Boolean(examData.micRequired) }),
        ...(examData.showResultsImmediate !== undefined && { showResultsImmediate: Boolean(examData.showResultsImmediate) }),
        ...(examData.enableLeaderboard !== undefined && { enableLeaderboard: Boolean(examData.enableLeaderboard) })
      };
    } else if (
      examData.negativeMarkValue !== undefined ||
      examData.cameraRequired !== undefined ||
      examData.micRequired !== undefined ||
      examData.showResultsImmediate !== undefined ||
      examData.enableLeaderboard !== undefined
    ) {
      configuration = {
        ...(examData.negativeMarkValue !== undefined && { negativeMarkValue: Number(examData.negativeMarkValue) }),
        ...(examData.cameraRequired !== undefined && { cameraRequired: Boolean(examData.cameraRequired) }),
        ...(examData.micRequired !== undefined && { micRequired: Boolean(examData.micRequired) }),
        ...(examData.showResultsImmediate !== undefined && { showResultsImmediate: Boolean(examData.showResultsImmediate) }),
        ...(examData.enableLeaderboard !== undefined && { enableLeaderboard: Boolean(examData.enableLeaderboard) })
      };
    }

    const created = await prisma.exam.create({
      data: {
        id: examData.id || `exam-${Date.now()}`,
        patternId: examData.patternId || null,
        courseId: examData.courseId || null,
        bankId: examData.bankId || null,
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
        imageUrl: examData.imageUrl || null,
        bannerImageUrl: examData.bannerImageUrl || null,
        schedule: examData.schedule || null,
        configuration: configuration || null
      }
    });

    return formatExam(created);
  }

  static async updateExam(id, updates) {
    const existing = await prisma.exam.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Examination not found.');

    const data = {};

    // String fields
    if (updates.title !== undefined) data.title = String(updates.title);
    if (updates.description !== undefined) data.description = updates.description !== null ? String(updates.description) : null;
    if (updates.category !== undefined) data.category = String(updates.category);
    if (updates.type !== undefined) data.type = String(updates.type);
    if (updates.subject !== undefined) data.subject = String(updates.subject);
    if (updates.date !== undefined) data.date = updates.date !== null ? String(updates.date) : null;
    if (updates.time !== undefined) data.time = updates.time !== null ? String(updates.time) : null;
    if (updates.tag !== undefined) data.tag = updates.tag !== null ? String(updates.tag) : null;
    if (updates.syllabus !== undefined) data.syllabus = updates.syllabus !== null ? String(updates.syllabus) : null;
    if (updates.status !== undefined) data.status = String(updates.status);
    if (updates.imageUrl !== undefined) data.imageUrl = updates.imageUrl !== null ? String(updates.imageUrl) : null;
    if (updates.bannerImageUrl !== undefined) data.bannerImageUrl = updates.bannerImageUrl !== null ? String(updates.bannerImageUrl) : null;
    if (updates.patternId !== undefined) data.patternId = updates.patternId || null;
    if (updates.courseId !== undefined) data.courseId = updates.courseId || null;
    if (updates.bankId !== undefined) data.bankId = updates.bankId || null;

    // Number fields
    if (updates.duration !== undefined) data.duration = Number(updates.duration);
    if (updates.marks !== undefined) data.marks = Number(updates.marks);
    if (updates.passingMarks !== undefined) data.passingMarks = Number(updates.passingMarks);
    if (updates.maxAttempts !== undefined) data.maxAttempts = Number(updates.maxAttempts);
    if (updates.registeredCount !== undefined) data.registeredCount = Number(updates.registeredCount);

    // Questions count mapping (accepts either questionsCount or questions)
    if (updates.questionsCount !== undefined) {
      data.questionsCount = Number(updates.questionsCount);
    } else if (updates.questions !== undefined) {
      data.questionsCount = Number(updates.questions);
    }

    // Fee (convert INR to paise)
    if (updates.fee !== undefined) {
      data.fee = Math.round(Number(updates.fee) * 100);
    }

    // Boolean fields
    if (updates.negativeMarking !== undefined) data.negativeMarking = Boolean(updates.negativeMarking);
    if (updates.proctoringRequired !== undefined) data.proctoringRequired = Boolean(updates.proctoringRequired);
    if (updates.registrationOpen !== undefined) data.registrationOpen = Boolean(updates.registrationOpen);

    // JSON fields
    if (updates.schedule !== undefined) data.schedule = updates.schedule;

    // Configuration JSON with extra settings preserved inside configuration
    const baseConfig = (updates.configuration && typeof updates.configuration === 'object')
      ? updates.configuration
      : ((existing.configuration && typeof existing.configuration === 'object') ? existing.configuration : {});

    const hasExtraConfig =
      updates.configuration !== undefined ||
      updates.negativeMarkValue !== undefined ||
      updates.cameraRequired !== undefined ||
      updates.micRequired !== undefined ||
      updates.showResultsImmediate !== undefined ||
      updates.enableLeaderboard !== undefined;

    if (hasExtraConfig) {
      data.configuration = {
        ...baseConfig,
        ...(updates.negativeMarkValue !== undefined && { negativeMarkValue: Number(updates.negativeMarkValue) }),
        ...(updates.cameraRequired !== undefined && { cameraRequired: Boolean(updates.cameraRequired) }),
        ...(updates.micRequired !== undefined && { micRequired: Boolean(updates.micRequired) }),
        ...(updates.showResultsImmediate !== undefined && { showResultsImmediate: Boolean(updates.showResultsImmediate) }),
        ...(updates.enableLeaderboard !== undefined && { enableLeaderboard: Boolean(updates.enableLeaderboard) })
      };
    }

    const updated = await prisma.exam.update({
      where: { id },
      data
    });
    return formatExam(updated);
  }

  static async deleteExam(id) {
    await prisma.exam.delete({
      where: { id }
    });
    return { success: true };
  }
}
