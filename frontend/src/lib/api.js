import {
  authService,
  courseService,
  examService,
  questionService,
  resultService,
  adminService,
  userService,
  storageService,
  leaderboardService,
  proctoringService,
  STORAGE_KEYS
} from '../services/index.js';

export const money = (number) => `₹${Number(number || 0).toLocaleString('en-IN')}`;

export const friendlyDate = (date) => {
  if (!date) return '';
  const d = new Date(date);
  return isNaN(d.getTime()) ? String(date) : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

// Base URL configuration from Vite environment
const BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api').replace(/\/+$/, '');

/**
 * Execute real HTTP REST requests to the Node.js Express backend.
 * Automatically handles JWT authentication headers, query parameters, and JSON parsing.
 * Includes graceful local fallback if the backend server is unreachable.
 */
export async function api(path, { method = 'GET', body, token, headers = {} } = {}) {
  const authToken = token || sessionStorage.getItem('meritx_token') || '';

  // Clean path formatting
  let cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (!cleanPath.startsWith('/api') && !BASE_URL.endsWith('/api')) {
    cleanPath = `/api${cleanPath}`;
  } else if (cleanPath.startsWith('/api') && BASE_URL.endsWith('/api')) {
    cleanPath = cleanPath.substring(4);
  }

  const targetUrl = `${BASE_URL}${cleanPath}`;
  const isFormData = body instanceof FormData;

  const reqHeaders = {
    ...(!isFormData && { 'Content-Type': 'application/json' }),
    ...(authToken && { Authorization: `Bearer ${authToken}` }),
    ...headers
  };

  try {
    const res = await fetch(targetUrl, {
      method: method.toUpperCase(),
      headers: reqHeaders,
      body: isFormData ? body : (body !== undefined ? JSON.stringify(body) : undefined)
    });

    // Handle 401 Unauthorized
    if (res.status === 401) {
      if (cleanPath.includes('/auth/me')) {
        sessionStorage.removeItem('meritx_token');
        sessionStorage.removeItem('meritx_user');
      }
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || 'Unauthenticated. Please log in.');
    }

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const errorMsg = data.message || data.error || `HTTP ${res.status}: ${res.statusText}`;
      throw new Error(errorMsg);
    }

    return data;
  } catch (err) {
    // If backend is unreachable (Failed to fetch) and offline fallback is permitted, delegate locally
    const isNetworkError = err.name === 'TypeError' && err.message.includes('fetch');
    if (isNetworkError) {
      console.warn(`[API] Backend unreachable at ${targetUrl}. Engaging client-side service fallback.`);
      return localFallbackRouter(path, { method, body, token: authToken });
    }
    throw err;
  }
}

/**
 * Local fallback router ensuring zero UI interruption during standalone testing
 */
async function localFallbackRouter(path, { method = 'GET', body, token } = {}) {
  await new Promise((resolve) => setTimeout(resolve, 30));

  const cleanPath = path.split('?')[0];
  const queryStr = path.includes('?') ? path.split('?')[1] : '';
  const query = new URLSearchParams(queryStr);
  const m = method.toUpperCase();

  function getRequestUser() {
    const current = authService.getCurrentUser();
    if (current) return current;
    const users = storageService.getCollection(STORAGE_KEYS.USERS);
    if (token && token.includes('student')) return users.find((u) => u.role === 'student') || users[0];
    if (token && token.includes('admin')) return users.find((u) => u.role === 'admin') || users[0];
    if (token && token.includes('teacher')) return users.find((u) => u.role === 'teacher') || users[0];
    if (token && token.includes('superadmin')) return users.find((u) => u.role === 'superadmin') || users[0];
    return users[0];
  }

  const user = getRequestUser();

  if (cleanPath === '/health') {
    return { status: 'ok', mode: 'frontend-fallback', timestamp: new Date().toISOString() };
  }

  if (cleanPath === '/auth/login' && m === 'POST') {
    return authService.login(body?.email, body?.password);
  }

  if (cleanPath === '/auth/google' && m === 'POST') {
    return authService.googleLogin(body?.credential, body?.target);
  }

  if (cleanPath === '/auth/register' && m === 'POST') {
    const newUser = await authService.register(body || {});
    return { user: newUser, token: `demo-token-${newUser.id}` };
  }

  if (cleanPath === '/auth/me') {
    if (!user) throw new Error('Unauthenticated');
    return { user };
  }

  if (cleanPath === '/me/dashboard' && m === 'GET') {
    return userService.getStudentDashboardData(user.id);
  }

  if (cleanPath === '/me/profile') {
    if (m === 'PUT') {
      const updated = await userService.updateProfile(user.id, body || {});
      return { user: updated };
    }
    const profile = await userService.getUserById(user.id);
    return { user: profile };
  }

  if (cleanPath === '/exams' && m === 'GET') {
    const list = await examService.getExams();
    return { exams: list };
  }

  const examMatch = cleanPath.match(/^\/exams\/([^/]+)$/);
  if (examMatch && m === 'GET') {
    const exam = await examService.getExamById(examMatch[1]);
    return { exam };
  }

  const adminExamMatch = cleanPath.match(/^\/admin\/exams\/([^/]+)$/);
  if (adminExamMatch && m === 'PUT') {
    const updated = await examService.updateExam(adminExamMatch[1], body || {});
    return { exam: updated, success: true };
  }

  if (cleanPath === '/admin/exams' && m === 'POST') {
    const created = await examService.createExam(body || {});
    return { exam: created, success: true };
  }

  if (cleanPath === '/exams/register' && m === 'POST') {
    const { walletService } = await import('../services/walletService');
    const exam = await examService.getExamById(body?.examId);
    return walletService.deductForExamRegistration({
      studentId: user.id,
      studentName: user.name,
      examId: body?.examId,
      examTitle: exam?.title || 'Competitive Mock Examination',
      fee: exam?.fee || 0
    });
  }

  if (cleanPath === '/questions' && m === 'GET') {
    const examId = query.get('examId');
    const exam = examId ? await examService.getExamById(examId) : null;
    const questions = await questionService.getQuestionsForExam(exam);
    return { questions };
  }

  if (cleanPath === '/exam-patterns' && m === 'GET') {
    const patterns = storageService.getCollection(STORAGE_KEYS.PATTERNS);
    return { patterns };
  }

  if (cleanPath === '/attempts/start' && m === 'POST') {
    return examService.startAttempt({ studentId: user.id, examId: body?.examId, retake: body?.retake });
  }

  if (cleanPath === '/attempts/save' && m === 'POST') {
    return examService.saveAttempt(body);
  }

  if (cleanPath === '/attempts/submit' && m === 'POST') {
    return examService.submitAttempt(body);
  }

  if (cleanPath === '/attempts/terminate' && m === 'POST') {
    return examService.terminateAttempt(body);
  }

  const leaderboardMatch = cleanPath.match(/^\/leaderboards?\/([^/]+)$/);
  if (leaderboardMatch && m === 'GET') {
    return leaderboardService.getExamLeaderboard(leaderboardMatch[1], user?.id);
  }

  const leaderboardExportMatch = cleanPath.match(/^\/leaderboards?\/([^/]+)\/export$/);
  if (leaderboardExportMatch && m === 'GET') {
    const csv = leaderboardService.exportToCsv(leaderboardExportMatch[1]);
    return { csv, success: true };
  }

  if (cleanPath === '/proctoring/session/init' && m === 'POST') {
    return { success: true, sessionId: `proc-${Date.now()}` };
  }

  if (cleanPath === '/proctoring/heartbeat' && m === 'POST') {
    return { success: true, timestamp: new Date().toISOString() };
  }

  if (cleanPath === '/proctoring/warning' && m === 'POST') {
    return { success: true, warningCount: 1, violationHistory: [] };
  }

  if (cleanPath === '/proctoring/event' && m === 'POST') {
    return { success: true };
  }

  if (cleanPath === '/admin/proctoring/overview' && m === 'GET') {
    return adminService.getProctoringOverview();
  }

  if (cleanPath === '/admin/proctoring/candidates' && m === 'GET') {
    const candidates = await adminService.getProctoringCandidates();
    return { candidates };
  }

  const proctoringTimelineMatch = cleanPath.match(/^\/admin\/proctoring\/attempts\/([^/]+)\/timeline$/);
  if (proctoringTimelineMatch && m === 'GET') {
    return adminService.getProctoringTimeline(proctoringTimelineMatch[1]);
  }

  // Question Banks Local Fallback
  if ((cleanPath === '/teacher/question-banks' || cleanPath === '/admin/question-banks') && m === 'GET') {
    const banks = storageService.getCollection('meritx_question_banks');
    return { banks };
  }

  const qbMatch = cleanPath.match(/^\/teacher\/question-banks\/([^/]+)$/);
  if (qbMatch && m === 'GET') {
    const banks = storageService.getCollection('meritx_question_banks');
    const b = banks.find((item) => item.id === qbMatch[1]) || { id: qbMatch[1], title: 'Sample Bank', subject: 'Physics', questions: [] };
    return { bank: b, questions: b.questions || [] };
  }

  if (qbMatch && m === 'PUT') {
    const banks = storageService.getCollection('meritx_question_banks');
    const existing = banks.find((item) => item.id === qbMatch[1]);
    const updated = {
      ...(existing || {}),
      ...(body || {}),
      id: qbMatch[1],
      questionCount: body?.questions?.length ?? existing?.questions?.length ?? 0
    };
    storageService.saveCollection('meritx_question_banks', [
      ...banks.filter((item) => item.id !== qbMatch[1]),
      updated
    ]);
    return { success: true, bank: updated };
  }

  if ((cleanPath === '/teacher/question-banks/import' || cleanPath === '/admin/question-banks/import') && m === 'POST') {
    const isAdmin = user?.role === 'admin' || user?.role === 'ADMIN' || user?.role === 'superadmin' || user?.role === 'SUPERADMIN';
    const banks = storageService.getCollection('meritx_question_banks');
    const id = `bank-${Date.now()}`;
    const initialStatus = isAdmin ? 'published' : 'submitted';
    const questions = body?.questions || [];
    const newBank = {
      id,
      title: body?.title || 'Imported Question Bank',
      subject: body?.subject || 'Physics',
      status: initialStatus,
      createdBy: user?.name || (isAdmin ? 'Admin' : 'Teacher'),
      teacherName: user?.name || (isAdmin ? 'Admin' : 'Teacher'),
      questions,
      questionCount: questions.length,
      date: new Date().toISOString().split('T')[0]
    };

    let newExam = null;
    if (isAdmin) {
      const examId = `pub-exam-${Date.now().toString().slice(-6)}`;
      newExam = {
        id: examId,
        bankId: id,
        title: newBank.title,
        type: 'Official Practice Exam',
        category: 'Official Mock Assessments',
        subject: newBank.subject,
        duration: 180,
        questionsCount: questions.length || 30,
        marks: (questions.length || 30) * 4,
        passingMarks: Math.round((questions.length || 30) * 4 * 0.4),
        status: 'published',
        registrationOpen: true,
        fee: 0,
        negativeMarking: true
      };
      newBank.assignedExamId = examId;
      const exams = storageService.getCollection(STORAGE_KEYS.EXAMS);
      storageService.saveCollection(STORAGE_KEYS.EXAMS, [newExam, ...exams]);
    }

    storageService.saveCollection('meritx_question_banks', [newBank, ...banks]);
    return {
      success: true,
      bank: newBank,
      exam: newExam,
      message: isAdmin
        ? `Question bank approved directly and published to examinations as "${newExam?.title}".`
        : 'Question bank imported and submitted for administrator review and approval.'
    };
  }

  if (cleanPath === '/teacher/question-banks/submit' && m === 'POST') {
    const isAdmin = user?.role === 'admin' || user?.role === 'ADMIN' || user?.role === 'superadmin' || user?.role === 'SUPERADMIN';
    const banks = storageService.getCollection('meritx_question_banks');
    const bank = banks.find((b) => b.id === body?.id);
    if (bank) {
      bank.status = isAdmin ? 'published' : 'submitted';
      storageService.saveCollection('meritx_question_banks', banks);
    }
    return {
      success: true,
      bank,
      message: isAdmin ? 'Question bank approved directly and published to examinations!' : 'Question bank submitted successfully for administrator approval.'
    };
  }

  if (cleanPath === '/admin/question-banks/approve' && m === 'POST') {
    const banks = storageService.getCollection('meritx_question_banks');
    const bank = banks.find((b) => b.id === body?.id);
    if (bank) {
      bank.status = 'approved';
      storageService.saveCollection('meritx_question_banks', banks);
    }
    return { success: true, message: 'Question bank approved for publication.' };
  }

  if (cleanPath === '/admin/question-banks/reject' && m === 'POST') {
    const banks = storageService.getCollection('meritx_question_banks');
    const bank = banks.find((b) => b.id === body?.id);
    if (bank) {
      bank.status = 'rejected';
      bank.rejectionReason = body?.reason || 'Rejection requested.';
      storageService.saveCollection('meritx_question_banks', banks);
    }
    return { success: true, message: 'Question bank rejected.' };
  }

  if (cleanPath === '/admin/question-banks/publish' && m === 'POST') {
    const banks = storageService.getCollection('meritx_question_banks');
    const bank = banks.find((b) => b.id === body?.id);
    const examId = `pub-exam-${Date.now().toString().slice(-6)}`;
    if (bank) {
      bank.status = 'published';
      bank.assignedExamId = examId;
      storageService.saveCollection('meritx_question_banks', banks);
    }
    const newExam = {
      id: examId,
      bankId: body?.id,
      title: bank?.title || 'Published Exam',
      type: 'Published Exam',
      category: 'Official Practice',
      subject: bank?.subject || 'Physics',
      duration: 180,
      questionsCount: bank?.questionCount || 30,
      marks: (bank?.questionCount || 30) * 4,
      status: 'published',
      registrationOpen: true
    };
    const exams = storageService.getCollection(STORAGE_KEYS.EXAMS);
    storageService.saveCollection(STORAGE_KEYS.EXAMS, [newExam, ...exams]);
    return { success: true, examId, message: 'Examination published to student catalog.' };
  }

  if (cleanPath === '/me/wallet' && m === 'GET') {
    const { walletService } = await import('../services/walletService');
    const myWallet = await walletService.getWallet(user.id);
    const transactions = await walletService.getTransactions(user.id);
    const deposits = transactions.filter((t) => t.type === 'credit' || t.type === 'deposit');
    const totalCredits = deposits.reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const debits = transactions.filter((t) => t.type === 'debit' || t.type === 'withdrawal');
    const totalDebits = debits.reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const withdrawals = transactions.filter((t) => t.type === 'withdrawal');
    return {
      balance: myWallet.balance ?? 0,
      availableBalance: myWallet.availableBalance ?? 0,
      currency: 'INR',
      lockedBalance: 0,
      totalCredits,
      totalDebits,
      totalDeposited: totalCredits,
      totalSpent: debits.filter((t) => t.type === 'debit').reduce((sum, t) => sum + Number(t.amount || 0), 0),
      wallet: {
        ...myWallet,
        totalDeposited: totalCredits,
        totalSpent: debits.filter(t => t.type === 'debit').reduce((sum, t) => sum + Number(t.amount || 0), 0),
        transactions
      },
      deposits,
      withdrawals,
      transactions
    };
  }

  if (cleanPath === '/me/wallet/deposit/order' && m === 'POST') {
    const numAmount = Number(body?.amount || 0);
    if (isNaN(numAmount) || numAmount < 1 || numAmount > 1000) {
      throw new Error('Recharge amount must be between ₹1 and ₹1,000.');
    }
    return {
      orderId: `order_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      amount: numAmount,
      amountPaise: Math.round(numAmount * 100),
      currency: 'INR',
      keyId: 'rzp_test_meritx_demo'
    };
  }

  if ((cleanPath === '/me/wallet/deposit/verify' || cleanPath === '/me/wallet/deposit') && m === 'POST') {
    const numAmount = Number(body?.amount || 0);
    if (isNaN(numAmount) || numAmount < 1 || numAmount > 1000) {
      throw new Error('Recharge amount must be between ₹1 and ₹1,000.');
    }
    const { walletService } = await import('../services/walletService');
    const result = await walletService.addMoney({
      studentId: user.id,
      studentName: user.name,
      amount: numAmount,
      method: body?.method || 'Instant Wallet Recharge (UPI/Demo)'
    });
    return {
      ...result,
      reference: result.transaction?.id || `DEP-${Date.now()}`,
      wallet: {
        availableBalance: result.newBalance,
        balance: result.newBalance,
        currency: 'INR'
      }
    };
  }

  if (cleanPath === '/me/wallet/withdraw' && m === 'POST') {
    const { walletService } = await import('../services/walletService');
    return walletService.withdrawMoney({
      studentId: user.id,
      studentName: user.name,
      amount: body?.amount,
      payoutMethod: body?.payoutMethod,
      destinationDetails: body?.destinationDetails
    });
  }

  if (cleanPath === '/me/wallet/transactions' && m === 'GET') {
    const { walletService } = await import('../services/walletService');
    const transactions = await walletService.getTransactions(user.id);
    return { transactions };
  }

  if (cleanPath === '/me/wallet/withdrawals' && m === 'GET') {
    const { walletService } = await import('../services/walletService');
    const transactions = await walletService.getTransactions(user.id);
    return { withdrawals: transactions.filter((t) => t.type === 'withdrawal') };
  }

  if (cleanPath === '/landing-content') {
    return {
      payload: {
        heading: 'About Our Courses',
        description: 'Structured mock examinations for JEE Main, JEE Advanced, MHT-CET and NEET UG with instant proctored assessment.',
        buttonLabel: 'Explore examinations',
        visible: true
      }
    };
  }

  if (cleanPath === '/payments/configuration') {
    return { configured: true, keyId: 'rzp_test_meritx_demo', mode: 'test' };
  }

  if (cleanPath === '/payments/orders' && m === 'POST') {
    return {
      configured: true,
      keyId: 'rzp_test_meritx_demo',
      mode: 'test',
      orderId: `ord_${Date.now()}`,
      order: { id: `order_${Date.now()}`, amount: 9900, currency: 'INR' },
      exam: { name: 'Competitive Examination' }
    };
  }

  if (cleanPath === '/payments/verify' && m === 'POST') {
    return {
      verified: true,
      enrollmentConfirmed: true,
      studentName: user?.name || 'Candidate',
      courseName: body?.examTitle || 'Competitive Examination',
      payment: { paymentId: `pay_${Date.now()}`, orderId: `order_${Date.now()}`, amount: 99, date: new Date().toISOString() }
    };
  }

  if (cleanPath === '/admin/overview' && m === 'GET') {
    return adminService.getOverview();
  }

  if (cleanPath === '/admin/finance/overview' || cleanPath === '/superadmin/finance') {
    return {
      todayCollection: 48500,
      todaySuccessfulPayments: 48,
      todayStudentsPaid: 45,
      totalAmountCollectedAllTime: 482500,
      totalSuccessfulTransactions: 512,
      totalStudentWalletBalance: 128500,
      totalTeacherWalletBalance: 86400,
      totalPendingWithdrawals: 42000,
      pendingWithdrawalCount: 2,
      totalRefunds: 4500,
      totalRewardsReserved: 25000,
      totalSettledAmount: 196100,
      availablePlatformBalance: 341850,
      withdrawablePlatformBalance: 196100,
      stats: { totalRevenue: 482500, platformBalance: 341850, pendingWithdrawals: 42000, totalRefunds: 4500, activePaidStudents: 894 },
      charts: { dailyCollections: [], monthlyCollections: [], revenueTrend: [], withdrawalTrend: [] },
      reconciliation: { reconciled: true, lastReconciledAt: new Date().toISOString(), variance: 0 }
    };
  }

  return { success: true, status: 'fallback_handled' };
}
