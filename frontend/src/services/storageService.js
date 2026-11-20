import usersSeed from '../data/users.json';
import examsSeed from '../data/exams.json';
import questionsSeed from '../data/questions.json';
import patternsSeed from '../data/patterns.json';
import walletsSeed from '../data/wallets.json';
import seedLeaderboards from '../data/seedLeaderboards.json';

const STORAGE_KEYS = {
  USERS: 'meritx_users',
  EXAMS: 'meritx_exams',
  QUESTIONS: 'meritx_questions',
  PATTERNS: 'meritx_patterns',
  REGISTRATIONS: 'meritx_registrations',
  ATTEMPTS: 'meritx_attempts',
  TICKETS: 'meritx_tickets',
  AUDIT: 'meritx_audit',
  WALLETS: 'meritx_wallets',
  WALLET_TRANSACTIONS: 'meritx_wallet_transactions',
  PROCTORING: 'meritx_proctoring_events',
  INITIALIZED: 'meritx_exam_platform_v8'
};

class StorageService {
  constructor() {
    this.init();
  }

  init() {
    if (typeof window === 'undefined') return;

    // Check version migration to ensure clean examination platform upgrade
    const isUpgraded = localStorage.getItem(STORAGE_KEYS.INITIALIZED);
    if (!isUpgraded || isUpgraded !== 'meritx_exam_platform_v8') {
      // Clear legacy course keys if present and reload updated exam definitions
      localStorage.removeItem('meritx_courses');
      localStorage.removeItem('meritx_enrollments');
      this.set(STORAGE_KEYS.EXAMS, examsSeed);
      this.set(STORAGE_KEYS.WALLETS, [
        { studentId: 'student-1', balance: 1, availableBalance: 1, currency: 'INR', lockedBalance: 0 },
        { studentId: 'student-2', balance: 0, availableBalance: 0, currency: 'INR', lockedBalance: 0 }
      ]);
      this.set(STORAGE_KEYS.REGISTRATIONS, [
        {
          id: 'reg-01',
          registrationId: 'reg-01',
          studentId: 'student-1',
          studentName: 'Aarav Sharma',
          examId: 'jee-main-01',
          examTitle: 'JEE Main Grand Mock 01',
          amountPaid: 0,
          paymentStatus: 'successful',
          status: 'confirmed',
          registeredAt: '2026-10-01T12:00:00.000Z',
          registrationDate: '2026-10-01T12:00:00.000Z'
        },
        {
          id: 'reg-02',
          registrationId: 'reg-02',
          studentId: 'student-1',
          studentName: 'Aarav Sharma',
          examId: 'java-assessment-01',
          examTitle: 'Java & Core Programming Assessment',
          amountPaid: 0,
          paymentStatus: 'successful',
          status: 'confirmed',
          registeredAt: '2026-10-15T09:30:00.000Z',
          registrationDate: '2026-10-15T09:30:00.000Z'
        },
        {
          id: 'reg-03',
          registrationId: 'reg-03',
          studentId: 'student-1',
          studentName: 'Aarav Sharma',
          examId: 'neet-biology-01',
          examTitle: 'NEET Biology Sprint Mock',
          amountPaid: 0,
          paymentStatus: 'successful',
          status: 'confirmed',
          registeredAt: '2026-10-20T11:00:00.000Z',
          registrationDate: '2026-10-20T11:00:00.000Z'
        }
      ]);
      this.set(STORAGE_KEYS.WALLET_TRANSACTIONS, [
        {
          id: 'tx-dep-1rs',
          transactionId: 'tx-dep-1rs',
          studentId: 'student-1',
          studentName: 'Aarav Sharma',
          examId: null,
          examTitle: null,
          transactionType: 'credit',
          type: 'credit',
          amount: 1,
          balanceBefore: 0,
          balanceAfter: 1,
          timestamp: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          status: 'successful',
          description: 'Wallet Deposit (Razorpay Payment Gateway)',
          memo: 'Wallet Deposit (Razorpay Payment Gateway)'
        }
      ]);
      localStorage.setItem(STORAGE_KEYS.INITIALIZED, 'meritx_exam_platform_v8');
    }

    // Initialize collections if missing in localStorage
    if (!localStorage.getItem(STORAGE_KEYS.USERS)) {
      this.set(STORAGE_KEYS.USERS, usersSeed);
    }
    if (!localStorage.getItem(STORAGE_KEYS.EXAMS)) {
      this.set(STORAGE_KEYS.EXAMS, examsSeed);
    }
    if (!localStorage.getItem(STORAGE_KEYS.QUESTIONS)) {
      this.set(STORAGE_KEYS.QUESTIONS, questionsSeed);
    }
    if (!localStorage.getItem(STORAGE_KEYS.PATTERNS)) {
      this.set(STORAGE_KEYS.PATTERNS, patternsSeed);
    }
    if (!localStorage.getItem(STORAGE_KEYS.WALLETS)) {
      this.set(STORAGE_KEYS.WALLETS, walletsSeed.wallets || []);
    }
    if (!localStorage.getItem(STORAGE_KEYS.WALLET_TRANSACTIONS)) {
      this.set(STORAGE_KEYS.WALLET_TRANSACTIONS, []);
    }
    if (!localStorage.getItem(STORAGE_KEYS.TICKETS)) {
      this.set(STORAGE_KEYS.TICKETS, walletsSeed.tickets || []);
    }
    if (!localStorage.getItem(STORAGE_KEYS.AUDIT)) {
      this.set(STORAGE_KEYS.AUDIT, walletsSeed.audit || []);
    }
    if (!localStorage.getItem(STORAGE_KEYS.REGISTRATIONS)) {
      this.set(STORAGE_KEYS.REGISTRATIONS, [
        {
          id: 'reg-01',
          registrationId: 'reg-01',
          studentId: 'student-1',
          studentName: 'Aarav Sharma',
          examId: 'jee-main-01',
          examTitle: 'JEE Main Grand Mock 01',
          amountPaid: 2,
          paymentStatus: 'successful',
          status: 'confirmed',
          registeredAt: '2026-10-01T12:00:00.000Z',
          registrationDate: '2026-10-01T12:00:00.000Z'
        },
        {
          id: 'reg-02',
          registrationId: 'reg-02',
          studentId: 'student-1',
          studentName: 'Aarav Sharma',
          examId: 'java-assessment-01',
          examTitle: 'Java & Core Programming Assessment',
          amountPaid: 0,
          paymentStatus: 'successful',
          status: 'confirmed',
          registeredAt: '2026-10-15T09:30:00.000Z',
          registrationDate: '2026-10-15T09:30:00.000Z'
        }
      ]);
    }
    if (!localStorage.getItem(STORAGE_KEYS.ATTEMPTS)) {
      // Initialize with seed leaderboard attempts
      this.set(STORAGE_KEYS.ATTEMPTS, seedLeaderboards || []);
    }
  }

  get(key, defaultValue = null) {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (e) {
      console.warn(`Error reading key ${key} from localStorage:`, e);
      return defaultValue;
    }
  }

  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.error(`Error saving key ${key} to localStorage:`, e);
      return false;
    }
  }

  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn(`Error removing key ${key}:`, e);
    }
  }

  // Collection CRUD Helpers
  getCollection(key) {
    return this.get(key, []);
  }

  findById(key, id) {
    const list = this.getCollection(key);
    return list.find((item) => String(item.id) === String(id)) || null;
  }

  insert(key, item) {
    const list = this.getCollection(key);
    const newItem = {
      ...item,
      id: item.id || `id-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: item.createdAt || new Date().toISOString()
    };
    list.unshift(newItem);
    this.set(key, list);
    return newItem;
  }

  update(key, id, updates) {
    const list = this.getCollection(key);
    const index = list.findIndex((item) => String(item.id) === String(id));
    if (index === -1) return null;
    list[index] = {
      ...list[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    this.set(key, list);
    return list[index];
  }

  delete(key, id) {
    const list = this.getCollection(key);
    const filtered = list.filter((item) => String(item.id) !== String(id));
    this.set(key, filtered);
    return filtered.length < list.length;
  }

  // Restore fresh state
  resetAll() {
    this.set(STORAGE_KEYS.USERS, usersSeed);
    this.set(STORAGE_KEYS.EXAMS, examsSeed);
    this.set(STORAGE_KEYS.QUESTIONS, questionsSeed);
    this.set(STORAGE_KEYS.PATTERNS, patternsSeed);
    this.set(STORAGE_KEYS.WALLETS, walletsSeed.wallets || []);
    this.set(STORAGE_KEYS.TICKETS, walletsSeed.tickets || []);
    this.set(STORAGE_KEYS.AUDIT, walletsSeed.audit || []);
    this.set(STORAGE_KEYS.REGISTRATIONS, [
      {
        id: 'reg-01',
        studentId: 'student-1',
        examId: 'jee-main-01',
        status: 'confirmed',
        registeredAt: '2026-10-01T12:00:00.000Z'
      },
      {
        id: 'reg-02',
        studentId: 'student-1',
        examId: 'java-assessment-01',
        status: 'confirmed',
        registeredAt: '2026-10-15T09:30:00.000Z'
      }
    ]);
    this.set(STORAGE_KEYS.ATTEMPTS, seedLeaderboards || []);
    this.set(STORAGE_KEYS.PROCTORING, []);
    return true;
  }
}

export const storageService = new StorageService();
export { STORAGE_KEYS };
