import { Router } from 'express';
import { AttemptController } from '../controllers/attempt.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router();

router.use(authenticate);

router.post('/start', AttemptController.start);
router.get('/:id', AttemptController.getById);
router.post('/save', AttemptController.save);
router.post('/submit', AttemptController.submit);
router.post('/terminate', AttemptController.terminate);

export default router;
