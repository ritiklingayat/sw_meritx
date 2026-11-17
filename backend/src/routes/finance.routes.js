import { Router } from 'express';
import { FinanceController } from '../controllers/finance.controller.js';
import { authenticate, authorize } from '../middleware/auth.middleware.js';

const router = Router();

router.use(authenticate);
router.use(authorize('ADMIN', 'SUPERADMIN'));

router.get('/overview', FinanceController.getOverview);
router.get('/master-wallet', FinanceController.getMasterWallet);
router.post('/master-wallet/withdraw', FinanceController.withdrawMasterWallet);
router.get('/teachers', FinanceController.getTeachers);
router.get('/payments', FinanceController.getPayments);
router.get('/refunds', FinanceController.getRefunds);
router.get('/wallets', FinanceController.getWallets);
router.get('/wallets/:id', FinanceController.getWalletById);
router.get('/withdrawals', FinanceController.getWithdrawals);
router.post('/withdrawals/:id/review', FinanceController.reviewWithdrawal);
router.post('/withdrawals/:id', FinanceController.reviewWithdrawal);
router.get('/reports', FinanceController.getReports);

export default router;
