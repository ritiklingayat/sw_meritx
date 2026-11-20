import { storageService, STORAGE_KEYS } from './storageService';

class UserService {
  async getUsers() {
    const users = storageService.getCollection(STORAGE_KEYS.USERS);
    return users.map(({ password, ...u }) => u);
  }

  async getUserById(id) {
    const user = storageService.findById(STORAGE_KEYS.USERS, id);
    if (!user) return null;
    const { password, ...safe } = user;
    return safe;
  }

  async getStudents() {
    const users = await this.getUsers();
    return users.filter((u) => u.role === 'student');
  }

  async getTeachers() {
    const users = await this.getUsers();
    return users.filter((u) => u.role === 'teacher');
  }

  async updateProfile(id, updates) {
    const updated = storageService.update(STORAGE_KEYS.USERS, id, updates);
    if (!updated) throw new Error('User not found.');

    // Also update session if this is the active logged in user
    try {
      const active = JSON.parse(sessionStorage.getItem('meritx_user') || '{}');
      if (active.id === id) {
        const merged = { ...active, ...updates };
        delete merged.password;
        sessionStorage.setItem('meritx_user', JSON.stringify(merged));
      }
    } catch {}

    const { password, ...safe } = updated;
    return safe;
  }

  async getStudentDashboardData(studentId) {
    const registrations = storageService.getCollection(STORAGE_KEYS.REGISTRATIONS)
      .filter((r) => r.studentId === studentId);

    const attempts = storageService.getCollection(STORAGE_KEYS.ATTEMPTS)
      .filter((a) => a.studentId === studentId);

    const allExams = storageService.getCollection(STORAGE_KEYS.EXAMS);
    const registeredExamIds = new Set(registrations.map((r) => r.examId));

    // Student's registered exams
    const registeredExams = allExams.filter((e) => registeredExamIds.has(e.id));

    const wallets = storageService.getCollection(STORAGE_KEYS.WALLETS);
    const userWallet = wallets.find((w) => w.studentId === studentId) || {
      studentId,
      balance: 0,
      currency: 'INR'
    };

    return {
      stats: {
        registeredExams: registrations.length,
        completedExams: attempts.filter((a) => a.status === 'submitted' || a.status === 'TERMINATED').length,
        walletBalance: userWallet.balance
      },
      registeredExams,
      courses: registeredExams,
      registrations,
      attempts,
      availableExams: allExams.filter((e) => !registeredExamIds.has(e.id))
    };
  }
}

export const userService = new UserService();
