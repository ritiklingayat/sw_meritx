import { Router } from 'express';
import { LeaderboardController } from '../controllers/leaderboard.controller.js';
import { optionalAuthenticate } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/:examId/export', optionalAuthenticate, LeaderboardController.exportCsv);
router.get('/:examId', optionalAuthenticate, LeaderboardController.getExamLeaderboard);

export default router;
