import { Router } from 'express';
import authRoutes from './auth.routes.js';
import studentRoutes from './student.routes.js';
import examRoutes from './exam.routes.js';
import attemptRoutes from './attempt.routes.js';
import teacherRoutes from './teacher.routes.js';
import adminRoutes from './admin.routes.js';
import financeRoutes from './finance.routes.js';
import paymentRoutes from './payment.routes.js';
import proctoringRoutes from './proctoring.routes.js';
import leaderboardRoutes from './leaderboard.routes.js';
import { SupportController } from '../controllers/support.controller.js';
import { ExamController } from '../controllers/exam.controller.js';
import { QuestionService } from '../services/question.service.js';
import { prisma } from '../config/prisma.js';
import { authenticate, optionalAuthenticate, authorize } from '../middleware/auth.middleware.js';

const router = Router();

// Health check
router.get('/health', async (req, res) => {
  return res.status(200).json({
    status: 'ok',
    mode: 'production-ready',
    timestamp: new Date().toISOString(),
    database: 'Neon PostgreSQL (Prisma ORM)'
  });
});

// Modular Routes
router.use('/auth', authRoutes);
router.use('/me', studentRoutes);
router.use('/exams', examRoutes);
router.use('/attempts', attemptRoutes);
router.use('/teacher', teacherRoutes);
router.use('/admin', adminRoutes);
router.use('/admin/finance', financeRoutes);
router.use('/superadmin/finance', financeRoutes);
router.use('/payments', paymentRoutes);
router.use('/proctoring', proctoringRoutes);
router.use('/leaderboards', leaderboardRoutes);
router.use('/leaderboard', leaderboardRoutes);

// Public / Common Platform Endpoints
router.get('/landing-content', SupportController.getLandingContent);
router.post('/support', optionalAuthenticate, SupportController.createTicket);

// Direct Question and Pattern Top-level Routes for frontend compatibility
router.get('/questions', optionalAuthenticate, ExamController.getExamQuestions);
router.get('/exam-patterns', ExamController.getPatterns);

// Direct Course Routes for frontend compatibility
router.get('/courses', async (req, res, next) => {
  try {
    const list = await prisma.course.findMany({
      where: { isVisible: true },
      orderBy: { displayOrder: 'asc' }
    });
    return res.status(200).json({
      courses: list.map((c) => ({
        ...c,
        fee: Math.round(Number(c.fee || 0) / 100),
        effectivePrice: Math.round(Number(c.effectivePrice || 0) / 100)
      }))
    });
  } catch (err) {
    next(err);
  }
});

router.get('/courses/:id', async (req, res, next) => {
  try {
    const course = await prisma.course.findFirst({
      where: {
        OR: [{ id: req.params.id }, { slug: req.params.id }]
      }
    });
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }
    return res.status(200).json({
      course: {
        ...course,
        fee: Math.round(Number(course.fee || 0) / 100),
        effectivePrice: Math.round(Number(course.effectivePrice || 0) / 100)
      }
    });
  } catch (err) {
    next(err);
  }
});

router.post('/courses/:id/enroll', authenticate, async (req, res, next) => {
  try {
    const enrollment = await prisma.courseEnrollment.upsert({
      where: {
        studentId_courseId: {
          studentId: req.user.id,
          courseId: req.params.id
        }
      },
      update: {},
      create: {
        studentId: req.user.id,
        courseId: req.params.id,
        feePaid: 0,
        status: 'active'
      }
    });
    return res.status(200).json({ success: true, enrollment });
  } catch (err) {
    next(err);
  }
});

export default router;
