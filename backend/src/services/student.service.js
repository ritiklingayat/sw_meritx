import { prisma } from '../config/prisma.js';
import { NotFoundError } from '../utils/errors.js';

export class StudentService {
  static async getDashboard(studentId) {
    const [registrations, attempts, allExams, wallet, user] = await Promise.all([
      prisma.examRegistration.findMany({
        where: { studentId },
        include: { exam: true },
        orderBy: { registeredAt: 'desc' }
      }),
      prisma.examAttempt.findMany({
        where: { studentId },
        include: { result: true, exam: true },
        orderBy: { startedAt: 'desc' }
      }),
      prisma.exam.findMany({
        where: { status: 'published' },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.wallet.findUnique({
        where: { userId: studentId }
      }),
      prisma.user.findUnique({
        where: { id: studentId }
      })
    ]);

    const registeredExamIds = new Set(registrations.map((r) => r.examId));
    const registeredExams = allExams
      .filter((e) => registeredExamIds.has(e.id))
      .map((e) => ({ ...e, fee: Math.round(Number(e.fee || 0) / 100) }));

    const availableExams = allExams
      .filter((e) => !registeredExamIds.has(e.id))
      .map((e) => ({ ...e, fee: Math.round(Number(e.fee || 0) / 100) }));

    const completedAttempts = attempts.filter((a) => ['submitted', 'TERMINATED', 'AUTO_SUBMITTED'].includes(a.status));
    const balanceRs = wallet ? Number(wallet.balancePaise) / 100 : 1500;

    return {
      stats: {
        registeredExams: registrations.length,
        completedExams: completedAttempts.length,
        walletBalance: balanceRs
      },
      registeredExams,
      courses: registeredExams,
      registrations: registrations.map((r) => ({
        ...r,
        amountPaid: Math.round(Number(r.amountPaid || 0) / 100)
      })),
      attempts,
      availableExams
    };
  }

  static async getProfile(studentId) {
    const user = await prisma.user.findUnique({
      where: { id: studentId },
      include: { profile: true }
    });

    if (!user) throw new NotFoundError('Student not found.');
    const { passwordHash: _, ...safeUser } = user;
    return safeUser;
  }

  static async updateProfile(studentId, updates) {
    const { name, target, city, academicYear, phone, avatarUrl, bio } = updates;

    const user = await prisma.user.update({
      where: { id: studentId },
      data: {
        ...(name && { name }),
        ...(target && { target }),
        ...(city && { city }),
        ...(academicYear && { academicYear }),
        ...(phone && { phone }),
        ...(avatarUrl && { avatarUrl }),
        profile: {
          upsert: {
            create: { targetExam: target, city, academicYear, phone, avatarUrl, bio },
            update: { targetExam: target, city, academicYear, phone, avatarUrl, bio }
          }
        }
      },
      include: { profile: true }
    });

    const { passwordHash: _, ...safeUser } = user;
    return safeUser;
  }

  static async getResults(studentId) {
    const attempts = await prisma.examAttempt.findMany({
      where: {
        studentId,
        status: { in: ['submitted', 'TERMINATED', 'AUTO_SUBMITTED'] }
      },
      include: {
        exam: true,
        result: true
      },
      orderBy: { submittedAt: 'desc' }
    });

    return attempts.map((a) => ({
      id: a.id,
      attemptId: a.id,
      examId: a.examId,
      examTitle: a.exam.title,
      score: a.result?.score ?? 0,
      maximumMarks: a.result?.maximumMarks ?? a.exam.marks,
      percentage: a.result?.percentage ?? 0,
      accuracy: a.result?.accuracy ?? 0,
      attempted: a.result?.attempted ?? 0,
      correct: a.result?.correct ?? 0,
      incorrect: a.result?.incorrect ?? 0,
      unattempted: a.result?.unattempted ?? 0,
      timeTaken: a.timeTaken,
      status: a.status,
      submittedAt: a.submittedAt,
      details: a.result?.details ?? []
    }));
  }
}
