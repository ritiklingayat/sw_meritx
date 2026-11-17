import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';
import { BadRequestError, NotFoundError } from '../utils/errors.js';

export class WalletService {
  static async getWallet(userId) {
    let wallet = await prisma.wallet.findUnique({
      where: { userId },
      include: {
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 50
        },
        withdrawals: {
          orderBy: { createdAt: 'desc' },
          take: 20
        }
      }
    });

    if (!wallet) {
      const initialPaise = BigInt(150000);
      wallet = await prisma.wallet.create({
        data: {
          userId,
          balancePaise: initialPaise,
          currency: 'INR'
        },
        include: {
          transactions: true,
          withdrawals: true
        }
      });
    }

    const balanceRs = Number(wallet.balancePaise) / 100;
    const lockedRs = Number(wallet.lockedPaise) / 100;

    const formattedTxs = (wallet.transactions || []).map((t) => ({
      id: t.id,
      transactionId: t.id,
      userId: t.userId,
      studentId: t.userId,
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
    }));

    const deposits = formattedTxs.filter((t) => t.type === 'credit' || t.type === 'deposit');
    const totalCredits = deposits.reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const debits = formattedTxs.filter((t) => t.type === 'debit');
    const totalDebits = debits.reduce((sum, t) => sum + Number(t.amount || 0), 0);

    const withdrawals = (wallet.withdrawals || []).map((w) => ({
      id: w.id,
      amount: Number(w.amountPaise) / 100,
      status: w.status,
      payoutMethod: w.payoutMethod,
      payoutDetails: w.payoutDetails,
      upiId: w.payoutDetails?.upiId || 'student@demo',
      createdAt: w.createdAt
    }));

    return {
      balance: balanceRs,
      availableBalance: balanceRs - lockedRs,
      currency: 'INR',
      lockedBalance: lockedRs,
      totalCredits,
      totalDebits,
      wallet: {
        id: wallet.id,
        balance: balanceRs,
        availableBalance: balanceRs - lockedRs,
        currency: 'INR'
      },
      deposits,
      withdrawals: withdrawals.length ? withdrawals : [
        { id: 'wd-1', amount: 400, status: 'approved', upiId: 'student@demo', createdAt: new Date().toISOString() }
      ],
      transactions: formattedTxs
    };
  }

  static async getTransactions(userId = null) {
    const where = userId ? { userId } : {};
    const txs = await prisma.walletTransaction.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });

    return txs.map((t) => ({
      id: t.id,
      transactionId: t.id,
      userId: t.userId,
      studentId: t.userId,
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
    }));
  }

  static async depositOrder({ userId, amount }) {
    const numAmount = Number(amount || 500);
    if (isNaN(numAmount) || numAmount <= 0) {
      throw new BadRequestError('Invalid deposit amount.');
    }

    const amountPaise = BigInt(Math.round(numAmount * 100));
    const orderId = `order_${Date.now()}`;

    return {
      orderId,
      amount: numAmount,
      amountPaise: Number(amountPaise),
      currency: 'INR',
      keyId: env.RAZORPAY_KEY_ID
    };
  }

  static async addMoney({ userId, amount = 500, method = 'UPI / Instant Demo Recharge' }) {
    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      throw new BadRequestError('Deposit amount must be a positive number.');
    }

    const amountPaise = BigInt(Math.round(numAmount * 100));

    return prisma.$transaction(async (tx) => {
      let wallet = await tx.wallet.findUnique({ where: { userId } });
      if (!wallet) {
        wallet = await tx.wallet.create({
          data: { userId, balancePaise: BigInt(0), currency: 'INR' }
        });
      }

      const balanceBefore = wallet.balancePaise;
      const balanceAfter = balanceBefore + amountPaise;

      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balancePaise: balanceAfter }
      });

      const refId = `DEP-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const walletTx = await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          userId,
          type: 'credit',
          direction: 'credit',
          amountPaise,
          balanceBeforePaise: balanceBefore,
          balanceAfterPaise: balanceAfter,
          status: 'successful',
          referenceId: refId,
          description: `Wallet Deposit (${method})`
        }
      });

      await tx.walletLedgerEntry.create({
        data: {
          walletId: wallet.id,
          transactionKey: `LEDGER-${refId}`,
          entryType: 'CREDIT',
          category: 'DEPOSIT',
          amountPaise,
          balanceAfterPaise: balanceAfter,
          memo: `Wallet Deposit: ₹${numAmount} via ${method}`
        }
      });

      const balanceRs = Number(balanceAfter) / 100;
      return {
        success: true,
        message: `₹${numAmount} successfully added to your wallet!`,
        newBalance: balanceRs,
        transaction: {
          id: walletTx.id,
          amount: numAmount,
          balanceBefore: Number(balanceBefore) / 100,
          balanceAfter: balanceRs,
          createdAt: walletTx.createdAt
        }
      };
    });
  }

  static async withdrawMoney({ userId, amount, payoutMethod = 'upi', destinationDetails = {} }) {
    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      throw new BadRequestError('Withdrawal amount must be a positive number.');
    }

    const amountPaise = BigInt(Math.round(numAmount * 100));

    return prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({ where: { userId } });
      if (!wallet) throw new NotFoundError('Wallet not found.');

      if (wallet.balancePaise < amountPaise) {
        const balanceRs = Number(wallet.balancePaise) / 100;
        throw new BadRequestError(`Cannot withdraw ₹${numAmount}. Available balance is only ₹${balanceRs}.`);
      }

      const balanceBefore = wallet.balancePaise;
      const balanceAfter = balanceBefore - amountPaise;

      await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          balancePaise: balanceAfter,
          totalWithdrawnPaise: wallet.totalWithdrawnPaise + amountPaise
        }
      });

      const refId = `WD-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const walletTx = await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          userId,
          type: 'withdrawal',
          direction: 'debit',
          amountPaise,
          balanceBeforePaise: balanceBefore,
          balanceAfterPaise: balanceAfter,
          status: 'successful',
          referenceId: refId,
          description: `Withdrawal payout via ${payoutMethod.toUpperCase()}`
        }
      });

      await tx.walletLedgerEntry.create({
        data: {
          walletId: wallet.id,
          transactionKey: `LEDGER-${refId}`,
          entryType: 'DEBIT',
          category: 'WITHDRAWAL',
          amountPaise,
          balanceAfterPaise: balanceAfter,
          memo: `Withdrawal Request: ₹${numAmount}`
        }
      });

      const withdrawal = await tx.withdrawalRequest.create({
        data: {
          userId,
          walletId: wallet.id,
          amountPaise,
          payoutMethod,
          payoutDetails: destinationDetails,
          status: 'approved',
          referenceNumber: refId
        }
      });

      const balanceRs = Number(balanceAfter) / 100;
      return {
        success: true,
        message: `₹${numAmount} successfully withdrawn to your ${payoutMethod.toUpperCase()} destination.`,
        newBalance: balanceRs,
        transaction: walletTx,
        withdrawal
      };
    });
  }

  static async getWithdrawals(userId) {
    const list = await prisma.withdrawalRequest.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });

    return list.map((w) => ({
      id: w.id,
      referenceNumber: w.referenceNumber,
      amount: Number(w.amountPaise) / 100,
      payoutMethod: w.payoutMethod,
      payoutDetails: w.payoutDetails,
      status: w.status,
      createdAt: w.createdAt
    }));
  }
}
