import { storageService, STORAGE_KEYS } from './storageService';

class AdminService {
  async getOverview() {
    const users = storageService.getCollection(STORAGE_KEYS.USERS);
    const students = users.filter((u) => u.role === 'student');
    const exams = storageService.getCollection(STORAGE_KEYS.EXAMS);
    const registrations = storageService.getCollection(STORAGE_KEYS.REGISTRATIONS);
    const attempts = storageService.getCollection(STORAGE_KEYS.ATTEMPTS);
    const audit = storageService.getCollection(STORAGE_KEYS.AUDIT);

    return {
      students: students.length,
      users: users.map(({ password, ...u }) => u),
      registrations: registrations.length,
      papers: [
        { id: 'p-1', title: 'Grand Mock Physics 2026', subject: 'Physics', questions: 25, status: 'approved' },
        { id: 'p-2', title: 'Inorganic Chemistry Sprint', subject: 'Chemistry', questions: 25, status: 'approved' },
        { id: 'p-3', title: 'Calculus Mastery Test', subject: 'Mathematics', questions: 25, status: 'approved' }
      ],
      attempts: attempts.filter((a) => a.status === 'submitted' || a.status === 'TERMINATED').length,
      exams,
      audit
    };
  }

  async getStudents() {
    const users = storageService.getCollection(STORAGE_KEYS.USERS);
    const registrations = storageService.getCollection(STORAGE_KEYS.REGISTRATIONS);
    const attempts = storageService.getCollection(STORAGE_KEYS.ATTEMPTS);
    const wallets = storageService.getCollection(STORAGE_KEYS.WALLETS);

    return users
      .filter((u) => u.role === 'student')
      .map(({ password, ...student }) => {
        const studentRegistrations = registrations.filter((r) => r.studentId === student.id);
        const studentAttempts = attempts.filter((a) => a.studentId === student.id);
        const wallet = wallets.find((w) => w.studentId === student.id) || { balance: 1500 };
        return {
          ...student,
          registeredExamsCount: studentRegistrations.length || 2,
          completedExamsCount: studentAttempts.filter((a) => a.status === 'submitted' || a.status === 'TERMINATED').length,
          walletBalance: wallet.balance,
          status: 'active'
        };
      });
  }

  async getRegistrations({ examId = '' } = {}) {
    let registrations = storageService.getCollection(STORAGE_KEYS.REGISTRATIONS);
    const users = storageService.getCollection(STORAGE_KEYS.USERS);
    const exams = storageService.getCollection(STORAGE_KEYS.EXAMS);
    const attempts = storageService.getCollection(STORAGE_KEYS.ATTEMPTS);

    if (examId && examId !== 'all') {
      registrations = registrations.filter((r) => r.examId === examId);
    }

    const items = registrations.map((r) => {
      const student = users.find((u) => u.id === r.studentId) || { name: r.studentName || 'Candidate', email: 'student@meritx.demo' };
      const exam = exams.find((e) => e.id === r.examId) || { title: r.examTitle || r.examId, fee: r.amountPaid || 0, marks: 300 };
      const studentAttempt = attempts.find((a) => a.studentId === r.studentId && a.examId === r.examId);

      let participationStatus = 'NOT_STARTED';
      if (studentAttempt) {
        if (studentAttempt.status === 'submitted') participationStatus = 'COMPLETED';
        else if (studentAttempt.status === 'TERMINATED') participationStatus = 'TERMINATED';
        else if (studentAttempt.status === 'in_progress') participationStatus = 'IN_PROGRESS';
      }

      return {
        id: r.id || r.registrationId,
        registrationId: r.registrationId || r.id,
        studentId: r.studentId,
        studentName: student.name,
        studentEmail: student.email,
        examId: r.examId,
        examTitle: exam.title,
        registrationDate: r.registrationDate || r.registeredAt,
        amountPaid: Number(r.amountPaid ?? exam.fee ?? 0),
        paymentStatus: r.paymentStatus || 'successful',
        participationStatus,
        score: studentAttempt?.result?.score ?? null,
        totalMarks: exam.marks || 300,
        attemptId: studentAttempt?.id || null
      };
    });

    const totalRevenue = items.reduce((sum, item) => sum + (item.paymentStatus === 'successful' ? item.amountPaid : 0), 0);
    const startedCount = items.filter((i) => i.participationStatus === 'IN_PROGRESS' || i.participationStatus === 'COMPLETED' || i.participationStatus === 'TERMINATED').length;
    const completedCount = items.filter((i) => i.participationStatus === 'COMPLETED' || i.participationStatus === 'TERMINATED').length;
    const notAttemptedCount = items.filter((i) => i.participationStatus === 'NOT_STARTED').length;

    return {
      registrations: items,
      totalRegistrations: items.length,
      totalRevenue,
      startedCount,
      completedCount,
      notAttemptedCount,
      exams
    };
  }

  async getAllWalletTransactions({ search = '', type = '' } = {}) {
    const { walletService } = await import('./walletService');
    let list = await walletService.getTransactions();

    if (type && type !== 'all') {
      list = list.filter((tx) => tx.transactionType === type || tx.type === type);
    }

    if (search) {
      const q = search.toLowerCase();
      list = list.filter((tx) =>
        (tx.studentName && tx.studentName.toLowerCase().includes(q)) ||
        (tx.memo && tx.memo.toLowerCase().includes(q)) ||
        (tx.examTitle && tx.examTitle.toLowerCase().includes(q)) ||
        (tx.id && tx.id.toLowerCase().includes(q))
      );
    }

    const totalDebits = list
      .filter((tx) => tx.transactionType === 'debit' || tx.type === 'debit')
      .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

    const totalCredits = list
      .filter((tx) => tx.transactionType === 'credit' || tx.type === 'credit')
      .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

    return {
      transactions: list,
      totalTransactions: list.length,
      totalDebits,
      totalCredits,
      volume: totalDebits + totalCredits
    };
  }

  async getAuditLogs() {
    return storageService.getCollection(STORAGE_KEYS.AUDIT);
  }

  async getSupportTickets() {
    return storageService.getCollection(STORAGE_KEYS.TICKETS);
  }

  async createTicket(ticketData) {
    return storageService.insert(STORAGE_KEYS.TICKETS, {
      ...ticketData,
      status: 'open',
      createdAt: new Date().toISOString()
    });
  }

  async getPrizeDistributions(examId) {
    return [
      { id: 'prz-1', examId: examId || 'jee-main-01', studentId: 'student-1', studentName: 'Aarav Sharma', rank: 1, amount: 15000, status: 'approved' },
      { id: 'prz-2', examId: examId || 'jee-main-01', studentId: 'student-2', studentName: 'Priya Patel', rank: 2, amount: 7000, status: 'approved' },
      { id: 'prz-3', examId: examId || 'jee-main-01', studentId: 'student-3', studentName: 'Rohan Deshmukh', rank: 3, amount: 3000, status: 'pending' }
    ];
  }

  async approvePrize(id) {
    return { success: true, message: `Prize distribution ${id} approved.` };
  }

  async getProctoringOverview() {
    const attempts = storageService.getCollection(STORAGE_KEYS.ATTEMPTS);
    return {
      activeExams: 3,
      liveCandidates: attempts.filter((a) => a.status === 'in_progress').length,
      flaggedViolations: attempts.filter((a) => a.isFlagged || a.warningCount > 0).length,
      terminatedExams: attempts.filter((a) => a.status === 'TERMINATED').length
    };
  }

  async getProctoringCandidates() {
    const attempts = storageService.getCollection(STORAGE_KEYS.ATTEMPTS);
    const users = storageService.getCollection(STORAGE_KEYS.USERS);
    const exams = storageService.getCollection(STORAGE_KEYS.EXAMS);

    return attempts.map((a) => {
      const u = users.find((user) => user.id === a.studentId) || { name: 'Demo Candidate' };
      const e = exams.find((exam) => exam.id === a.examId) || { title: 'Online Assessment' };
      return {
        attemptId: a.id,
        studentId: a.studentId,
        candidateName: u.name,
        examTitle: e.title,
        status: a.status,
        warningCount: a.warningCount || 0,
        isFlagged: a.isFlagged || false,
        cameraStatus: a.proctoringStatus === 'monitored' ? 'active' : 'unmonitored',
        startedAt: a.startedAt
      };
    });
  }

  resetDemoData() {
    return storageService.resetAll();
  }
}

export const adminService = new AdminService();
