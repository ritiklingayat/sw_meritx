import { prisma } from '../config/prisma.js';
import { NotFoundError } from '../utils/errors.js';

export class AdminService {
  static async getOverview() {
    const [users, students, exams, registrations, attempts, audit] = await Promise.all([
      prisma.user.findMany(),
      prisma.user.findMany({ where: { role: 'STUDENT' } }),
      prisma.exam.findMany(),
      prisma.examRegistration.findMany(),
      prisma.examAttempt.findMany({ where: { status: { in: ['submitted', 'TERMINATED', 'AUTO_SUBMITTED'] } } }),
      prisma.auditLog.findMany({ take: 20, orderBy: { createdAt: 'desc' } })
    ]);

    return {
      students: students.length,
      users: users.map(({ passwordHash: _, ...u }) => u),
      registrations: registrations.length,
      attempts: attempts.length,
      exams: exams.map((e) => ({ ...e, fee: Math.round(Number(e.fee || 0) / 100) })),
      papers: [
        { id: 'p-1', title: 'Grand Mock Physics 2026', subject: 'Physics', questions: 25, status: 'approved' },
        { id: 'p-2', title: 'Inorganic Chemistry Sprint', subject: 'Chemistry', questions: 25, status: 'approved' },
        { id: 'p-3', title: 'Calculus Mastery Test', subject: 'Mathematics', questions: 25, status: 'approved' }
      ],
      audit
    };
  }

  static async getStudents() {
    const students = await prisma.user.findMany({
      where: { role: 'STUDENT' },
      include: {
        registrations: true,
        attempts: true,
        wallet: true
      }
    });

    return students.map(({ passwordHash: _, ...s }) => {
      const balance = s.wallet ? Number(s.wallet.balancePaise) / 100 : 1500;
      return {
        ...s,
        registeredExamsCount: s.registrations.length,
        completedExamsCount: s.attempts.filter((a) => ['submitted', 'TERMINATED', 'AUTO_SUBMITTED'].includes(a.status)).length,
        walletBalance: balance,
        status: s.isActive ? 'active' : 'inactive'
      };
    });
  }

  static async getRegistrations({ examId = '' } = {}) {
    const where = {};
    if (examId && examId !== 'all') {
      where.examId = examId;
    }

    const [registrations, exams] = await Promise.all([
      prisma.examRegistration.findMany({
        where,
        include: {
          student: true,
          exam: true
        },
        orderBy: { registeredAt: 'desc' }
      }),
      prisma.exam.findMany()
    ]);

    const studentIds = registrations.map((r) => r.studentId);
    const attempts = await prisma.examAttempt.findMany({
      where: {
        studentId: { in: studentIds }
      },
      include: { result: true }
    });

    const items = registrations.map((r) => {
      const att = attempts.find((a) => a.studentId === r.studentId && a.examId === r.examId);
      let participationStatus = 'NOT_STARTED';
      if (att) {
        if (att.status === 'submitted') participationStatus = 'COMPLETED';
        else if (att.status === 'TERMINATED') participationStatus = 'TERMINATED';
        else if (att.status === 'in_progress') participationStatus = 'IN_PROGRESS';
      }

      return {
        id: r.id,
        registrationId: r.id,
        studentId: r.studentId,
        studentName: r.student?.name || 'Candidate',
        studentEmail: r.student?.email || 'student@meritx.demo',
        examId: r.examId,
        examTitle: r.exam?.title || 'Competitive Exam',
        registrationDate: r.registeredAt,
        amountPaid: Math.round(Number(r.amountPaid || 0) / 100),
        paymentStatus: r.paymentStatus,
        participationStatus,
        score: att?.result?.score ?? null,
        totalMarks: r.exam?.marks || 300,
        attemptId: att?.id || null
      };
    });

    const totalRevenue = items.reduce((sum, item) => sum + (item.paymentStatus === 'successful' ? item.amountPaid : 0), 0);
    const startedCount = items.filter((i) => ['IN_PROGRESS', 'COMPLETED', 'TERMINATED'].includes(i.participationStatus)).length;
    const completedCount = items.filter((i) => ['COMPLETED', 'TERMINATED'].includes(i.participationStatus)).length;
    const notAttemptedCount = items.filter((i) => i.participationStatus === 'NOT_STARTED').length;

    return {
      registrations: items,
      totalRegistrations: items.length,
      totalRevenue,
      startedCount,
      completedCount,
      notAttemptedCount,
      exams: exams.map((e) => ({ ...e, fee: Math.round(Number(e.fee || 0) / 100) }))
    };
  }

  static async getAllWalletTransactions({ search = '', type = '' } = {}) {
    const where = {};
    if (type && type !== 'all') {
      where.type = type;
    }

    const txs = await prisma.walletTransaction.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });

    const userIds = [...new Set(txs.map((t) => t.userId))];
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } }
    });
    const userMap = new Map(users.map((u) => [u.id, u.name]));

    let list = txs.map((t) => {
      const studentName = userMap.get(t.userId) || 'Candidate';
      return {
        id: t.id,
        transactionId: t.id,
        userId: t.userId,
        studentId: t.userId,
        studentName,
        type: t.type,
        transactionType: t.type,
        direction: t.direction,
        amount: Number(t.amountPaise) / 100,
        balanceBefore: Number(t.balanceBeforePaise) / 100,
        balanceAfter: Number(t.balanceAfterPaise) / 100,
        status: t.status,
        referenceId: t.referenceId,
        description: t.description,
        memo: t.description,
        createdAt: t.createdAt,
        timestamp: t.createdAt
      };
    });

    if (search) {
      const q = search.toLowerCase();
      list = list.filter((t) =>
        t.studentName.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        (t.referenceId && t.referenceId.toLowerCase().includes(q))
      );
    }

    const totalDebits = list
      .filter((t) => t.direction === 'debit')
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);

    const totalCredits = list
      .filter((t) => t.direction === 'credit')
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);

    return {
      transactions: list,
      totalTransactions: list.length,
      totalDebits,
      totalCredits,
      volume: totalDebits + totalCredits
    };
  }

  static async getResults() {
    const attempts = await prisma.examAttempt.findMany({
      where: { status: { in: ['submitted', 'TERMINATED', 'AUTO_SUBMITTED'] } },
      include: {
        student: true,
        exam: true,
        result: true
      },
      orderBy: { submittedAt: 'desc' }
    });

    return attempts.map((a) => {
      const res = a.result || {};
      return {
        id: a.id,
        attemptId: a.id,
        studentId: a.studentId,
        studentName: a.student?.name || 'Candidate',
        studentEmail: a.student?.email || 'student@meritx.demo',
        studentCity: a.student?.city || 'Pune',
        examId: a.examId,
        examTitle: a.exam?.title || 'Online Assessment',
        status: a.status,
        score: Number(res.score ?? 0),
        maximumMarks: Number(res.maximumMarks ?? (a.exam?.marks || 300)),
        percentage: Number(res.percentage ?? 0),
        accuracy: Number(res.accuracy ?? 0),
        attempted: Number(res.attempted ?? 0),
        correct: Number(res.correct ?? 0),
        incorrect: Number(res.incorrect ?? 0),
        timeTaken: Number(a.timeTaken ?? 3600),
        warningCount: Number(a.warningCount ?? 0),
        isFlagged: Boolean(a.isFlagged || a.warningCount >= 2),
        submittedAt: a.submittedAt || a.startedAt
      };
    });
  }

  static async approveQuestionBank(bankId, adminId) {
    const bank = await prisma.questionBank.update({
      where: { id: bankId },
      data: {
        status: 'approved',
        approvedById: adminId,
        approvedAt: new Date()
      }
    });

    await prisma.questionBankAuditEvent.create({
      data: {
        bankId,
        actorId: adminId,
        eventType: 'APPROVED',
        detail: { message: 'Question bank approved for examination generation.' }
      }
    });

    return { success: true, message: 'Question bank approved and validated for publication.', bank };
  }

  static async rejectQuestionBank(bankId, reason, adminId) {
    const bank = await prisma.questionBank.update({
      where: { id: bankId },
      data: {
        status: 'rejected',
        rejectionReason: reason || 'Revision required by academic review.'
      }
    });

    await prisma.questionBankAuditEvent.create({
      data: {
        bankId,
        actorId: adminId,
        eventType: 'REJECTED',
        detail: { reason }
      }
    });

    return { success: true, message: 'Question bank returned with revision feedback.', bank };
  }

  static async publishQuestionBank(bankId, adminId) {
    const bank = await prisma.questionBank.findUnique({
      where: { id: bankId },
      include: { questions: true }
    });

    if (!bank) throw new NotFoundError('Question bank not found.');

    const examId = `pub-exam-${Date.now().toString().slice(-6)}`;
    const exam = await prisma.exam.create({
      data: {
        id: examId,
        bankId: bank.id,
        title: bank.title,
        type: 'Published Exam',
        category: 'Official Practice',
        subject: bank.subject,
        duration: 180,
        questionsCount: bank.questions.length,
        marks: bank.questions.length * 4,
        status: 'published'
      }
    });

    await prisma.questionBank.update({
      where: { id: bankId },
      data: {
        status: 'published',
        publishedAt: new Date(),
        assignedExamId: exam.id
      }
    });

    await prisma.questionBankAuditEvent.create({
      data: {
        bankId,
        actorId: adminId,
        eventType: 'PUBLISHED',
        detail: { examId: exam.id }
      }
    });

    return {
      success: true,
      examId: exam.id,
      message: 'Examination successfully published to student catalog.'
    };
  }

  static async getSupportTickets() {
    return prisma.supportTicket.findMany({
      orderBy: { createdAt: 'desc' }
    });
  }

  static async createTicket({ userId, userName, subject, message }) {
    return prisma.supportTicket.create({
      data: {
        userId,
        userName,
        subject,
        message,
        status: 'open'
      }
    });
  }

  static async updateTicket(id, updates) {
    return prisma.supportTicket.update({
      where: { id },
      data: updates
    });
  }
}
