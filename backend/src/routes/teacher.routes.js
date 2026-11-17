import { Router } from 'express';
import { TeacherController } from '../controllers/teacher.controller.js';
import { authenticate, authorize } from '../middleware/auth.middleware.js';

const router = Router();

router.use(authenticate);
router.use(authorize('TEACHER', 'ADMIN', 'SUPERADMIN'));

router.get('/dashboard', TeacherController.getDashboard);
router.get('/profile', TeacherController.getProfile);
router.put('/profile', TeacherController.updateProfile);
router.get('/papers', TeacherController.getPapers);
router.post('/papers', TeacherController.createPaper);
router.get('/question-banks', TeacherController.getQuestionBanks);
router.get('/question-banks/:id', TeacherController.getQuestionBankById);
router.put('/question-banks/:id', TeacherController.updateQuestionBank);
router.post('/question-banks/import', TeacherController.importQuestionBank);
router.post('/question-banks/submit', TeacherController.submitQuestionBank);

export default router;
