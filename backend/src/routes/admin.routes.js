import { Router } from 'express';
import { AdminController } from '../controllers/admin.controller.js';
import { authenticate, authorize } from '../middleware/auth.middleware.js';

const router = Router();

router.use(authenticate);
router.use(authorize('ADMIN', 'SUPERADMIN'));

router.get('/overview', AdminController.getOverview);
router.get('/students', AdminController.getStudents);
router.get('/registrations', AdminController.getRegistrations);
router.get('/transactions', AdminController.getTransactions);

router.get('/exams', AdminController.getExams);
router.post('/exams', AdminController.createExam);
router.put('/exams/:id', AdminController.updateExam);
router.delete('/exams/:id', AdminController.deleteExam);

router.get('/courses', AdminController.getCourses);
router.post('/courses', AdminController.createCourse);
router.put('/courses/:id', AdminController.updateCourse);
router.delete('/courses/:id', AdminController.deleteCourse);

router.get('/tickets', AdminController.getTickets);
router.put('/tickets/:id', AdminController.updateTicket);
router.get('/results', AdminController.getResults);

router.get('/proctoring/overview', AdminController.getProctoringOverview);
router.get('/proctoring/candidates', AdminController.getProctoringCandidates);
router.get('/proctoring/events', AdminController.getProctoringEvents);
router.get('/proctoring/attempts/:id/timeline', AdminController.getProctoringTimeline);

router.post('/papers/approve', AdminController.approvePaper);
router.post('/question-banks/approve', AdminController.approveQuestionBank);
router.post('/question-banks/reject', AdminController.rejectQuestionBank);
router.post('/question-banks/publish', AdminController.publishQuestionBank);

router.get('/prize-distributions', AdminController.getPrizeDistributions);
router.get('/prize-rankings', AdminController.getPrizeRankings);
router.post('/prize-distributions/:id/approve', AdminController.approvePrize);

export default router;
