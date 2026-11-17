import { Router } from 'express';
import { StudentController } from '../controllers/student.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router();

router.use(authenticate);

router.get('/dashboard', StudentController.getDashboard);
router.get('/profile', StudentController.getProfile);
router.put('/profile', StudentController.updateProfile);
router.get('/courses', StudentController.getCourses);
router.post('/courses/enroll', StudentController.enrollCourse);
router.get('/exams', StudentController.getExams);
router.get('/registrations', StudentController.getRegistrations);
router.get('/results', StudentController.getResults);
router.get('/wallet', StudentController.getWallet);
router.get('/wallet/transactions', StudentController.getWalletTransactions);
router.post('/wallet/deposit/order', StudentController.depositOrder);
router.post('/wallet/deposit/verify', StudentController.depositVerify);
router.post('/wallet/deposit', StudentController.depositVerify);
router.post('/wallet/withdraw', StudentController.withdraw);
router.get('/wallet/withdrawals', StudentController.getWithdrawals);

export default router;
