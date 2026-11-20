import { storageService, STORAGE_KEYS } from './storageService';

class WalletService {
  /**
   * Get student wallet, initializing a default if not found
   */
  async getWallet(studentId) {
    if (!studentId) return { balance: 0, availableBalance: 0, currency: 'INR', lockedBalance: 0 };

    const wallets = storageService.getCollection(STORAGE_KEYS.WALLETS);
    let wallet = wallets.find((w) => w.studentId === studentId);

    if (!wallet) {
      wallet = {
        studentId,
        balance: 0,
        availableBalance: 0,
        currency: 'INR',
        lockedBalance: 0
      };
      wallets.push(wallet);
      storageService.set(STORAGE_KEYS.WALLETS, wallets);
    }

    return {
      ...wallet,
      balance: wallet.balance ?? 0,
      availableBalance: wallet.balance ?? 0
    };
  }

  /**
   * Get wallet transaction history, optionally filtered by studentId
   */
  async getTransactions(studentId = null) {
    let list = storageService.getCollection(STORAGE_KEYS.WALLET_TRANSACTIONS);
    if (studentId) {
      list = list.filter((tx) => tx.studentId === studentId);
    }
    // Sort descending by timestamp
    return list.sort((a, b) => new Date(b.timestamp || b.createdAt || 0) - new Date(a.timestamp || a.createdAt || 0));
  }

  /**
   * Deduct registration fee from student wallet and record registration atomically
   */
  async deductForExamRegistration({ studentId, examId, examTitle, fee = 0, studentName = '' }) {
    if (!studentId || !examId) {
      throw new Error('Student ID and Examination ID are required for registration.');
    }

    const regFee = Number(fee || 0);

    // 1. Check duplicate registration
    const registrations = storageService.getCollection(STORAGE_KEYS.REGISTRATIONS);
    const existingReg = registrations.find(
      (r) => r.studentId === studentId && r.examId === examId && (r.status === 'confirmed' || r.paymentStatus === 'successful')
    );
    if (existingReg) {
      return {
        success: false,
        error: 'ALREADY_REGISTERED',
        message: 'You have already registered for this examination.',
        registration: existingReg
      };
    }

    // 2. Check wallet balance
    const wallets = storageService.getCollection(STORAGE_KEYS.WALLETS);
    let walletIndex = wallets.findIndex((w) => w.studentId === studentId);

    if (walletIndex === -1) {
      wallets.push({
        studentId,
        balance: 0,
        currency: 'INR',
        lockedBalance: 0
      });
      walletIndex = wallets.length - 1;
    }

    const currentWallet = wallets[walletIndex];
    const balanceBefore = Number(currentWallet.balance ?? 0);

    if (balanceBefore < regFee) {
      return {
        success: false,
        error: 'INSUFFICIENT_BALANCE',
        balance: balanceBefore,
        required: regFee,
        shortfall: regFee - balanceBefore,
        message: `Insufficient wallet balance. You have ₹${balanceBefore}, but ₹${regFee} is required.`
      };
    }

    // 3. Atomically deduct fee
    const balanceAfter = balanceBefore - regFee;
    currentWallet.balance = balanceAfter;
    storageService.set(STORAGE_KEYS.WALLETS, wallets);

    // 4. Create Wallet Transaction Record
    const txId = `tx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const now = new Date().toISOString();
    const transaction = storageService.insert(STORAGE_KEYS.WALLET_TRANSACTIONS, {
      id: txId,
      transactionId: txId,
      studentId,
      studentName: studentName || 'Candidate',
      examId,
      examTitle: examTitle || 'Competitive Mock Examination',
      transactionType: 'debit',
      type: 'debit',
      amount: regFee,
      balanceBefore,
      balanceAfter,
      timestamp: now,
      createdAt: now,
      status: 'successful',
      description: `Registration: ${examTitle || examId}`,
      memo: `Registration Fee: ${examTitle || examId}`
    });

    // 5. Create Registration Record
    const regId = `reg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const registration = storageService.insert(STORAGE_KEYS.REGISTRATIONS, {
      id: regId,
      registrationId: regId,
      studentId,
      studentName: studentName || 'Candidate',
      examId,
      examTitle: examTitle || 'Competitive Mock Examination',
      registrationDate: now,
      registeredAt: now,
      amountPaid: regFee,
      paymentStatus: 'successful',
      status: 'confirmed'
    });

    // 6. Update exam registration count
    const exams = storageService.getCollection(STORAGE_KEYS.EXAMS);
    const examItem = exams.find((e) => e.id === examId);
    if (examItem) {
      examItem.registered = (examItem.registered || 0) + 1;
      storageService.set(STORAGE_KEYS.EXAMS, exams);
    }

    return {
      success: true,
      message: 'Registration confirmed and fee deducted successfully.',
      registration,
      transaction,
      newBalance: balanceAfter
    };
  }

  /**
   * Deposit/Add money to student wallet
   */
  async addMoney({ studentId, studentName = '', amount = 500, method = 'UPI / Instant Demo Top-Up' }) {
    const numAmount = Number(amount);
    if (!studentId || isNaN(numAmount) || numAmount < 1 || numAmount > 1000) {
      throw new Error('Deposit amount must be between ₹1 and ₹1,000.');
    }

    const wallets = storageService.getCollection(STORAGE_KEYS.WALLETS);
    let walletIndex = wallets.findIndex((w) => w.studentId === studentId);

    if (walletIndex === -1) {
      wallets.push({
        studentId,
        balance: 0,
        currency: 'INR',
        lockedBalance: 0
      });
      walletIndex = wallets.length - 1;
    }

    const currentWallet = wallets[walletIndex];
    const balanceBefore = Number(currentWallet.balance ?? 0);
    const balanceAfter = balanceBefore + numAmount;
    currentWallet.balance = balanceAfter;
    storageService.set(STORAGE_KEYS.WALLETS, wallets);

    const txId = `tx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const now = new Date().toISOString();
    const transaction = storageService.insert(STORAGE_KEYS.WALLET_TRANSACTIONS, {
      id: txId,
      transactionId: txId,
      studentId,
      studentName: studentName || 'Candidate',
      examId: null,
      examTitle: null,
      transactionType: 'credit',
      type: 'credit',
      amount: numAmount,
      balanceBefore,
      balanceAfter,
      timestamp: now,
      createdAt: now,
      status: 'successful',
      description: `Wallet Deposit (${method})`,
      memo: `Wallet Deposit (${method})`
    });

    return {
      success: true,
      message: `₹${numAmount} successfully added to your wallet!`,
      newBalance: balanceAfter,
      transaction
    };
  }

  /**
   * Withdraw money from student wallet
   */
  async withdrawMoney({ studentId, studentName = '', amount = 500, payoutMethod = 'upi', destinationDetails = {} }) {
    const numAmount = Number(amount);
    if (!studentId || isNaN(numAmount) || numAmount <= 0) {
      throw new Error('Valid student ID and positive withdrawal amount are required.');
    }

    const wallets = storageService.getCollection(STORAGE_KEYS.WALLETS);
    let walletIndex = wallets.findIndex((w) => w.studentId === studentId);

    if (walletIndex === -1) {
      wallets.push({
        studentId,
        balance: 0,
        currency: 'INR',
        lockedBalance: 0
      });
      walletIndex = wallets.length - 1;
    }

    const currentWallet = wallets[walletIndex];
    const balanceBefore = Number(currentWallet.balance ?? 0);

    if (balanceBefore < numAmount) {
      return {
        success: false,
        error: 'INSUFFICIENT_BALANCE',
        balance: balanceBefore,
        required: numAmount,
        message: `Cannot withdraw ₹${numAmount}. Available balance is only ₹${balanceBefore}.`
      };
    }

    const balanceAfter = balanceBefore - numAmount;
    currentWallet.balance = balanceAfter;
    currentWallet.totalWithdrawn = (currentWallet.totalWithdrawn || 0) + numAmount;
    storageService.set(STORAGE_KEYS.WALLETS, wallets);

    const txId = `tx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const now = new Date().toISOString();
    const destStr = payoutMethod === 'upi'
      ? (destinationDetails.upiId ? `UPI: ${destinationDetails.upiId}` : 'Instant UPI Payout')
      : (destinationDetails.accountNumber ? `Bank A/C: ••••${destinationDetails.accountNumber.slice(-4)}` : 'Bank Transfer');

    const transaction = storageService.insert(STORAGE_KEYS.WALLET_TRANSACTIONS, {
      id: txId,
      transactionId: txId,
      studentId,
      studentName: studentName || 'Candidate',
      examId: null,
      examTitle: null,
      transactionType: 'withdrawal',
      type: 'withdrawal',
      amount: numAmount,
      balanceBefore,
      balanceAfter,
      timestamp: now,
      createdAt: now,
      status: 'successful',
      description: `Withdrawal payout to ${destStr}`,
      memo: `Wallet Withdrawal (${payoutMethod.toUpperCase()})`
    });

    return {
      success: true,
      message: `₹${numAmount} successfully withdrawn to your ${payoutMethod.toUpperCase()} destination.`,
      newBalance: balanceAfter,
      transaction
    };
  }
}

export const walletService = new WalletService();
