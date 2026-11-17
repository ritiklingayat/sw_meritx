import { Router } from 'express';
import { ExamController } from '../controllers/exam.controller.js';
import { authenticate, optionalAuthenticate } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/', ExamController.getExams);
router.get('/exam-patterns', ExamController.getPatterns);
router.get('/:id', ExamController.getExamById);
router.post('/register', authenticate, ExamController.register);
router.get('/:id/questions', optionalAuthenticate, ExamController.getExamQuestions);

export default router;
