import { Router } from 'express';
import { ProctoringController } from '../controllers/proctoring.controller.js';
import { optionalAuthenticate } from '../middleware/auth.middleware.js';

const router = Router();

router.post('/session/init', optionalAuthenticate, ProctoringController.initSession);
router.post('/heartbeat', optionalAuthenticate, ProctoringController.heartbeat);
router.post('/warning', optionalAuthenticate, ProctoringController.warning);
router.post('/event', optionalAuthenticate, ProctoringController.event);

export default router;
