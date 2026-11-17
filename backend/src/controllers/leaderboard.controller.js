import { LeaderboardService } from '../services/leaderboard.service.js';

export class LeaderboardController {
  static async getExamLeaderboard(req, res, next) {
    try {
      const examId = req.params.examId;
      const currentStudentId = req.user?.id || null;
      const data = await LeaderboardService.getLeaderboard(examId, currentStudentId);
      return res.status(200).json(data);
    } catch (err) {
      next(err);
    }
  }

  static async exportCsv(req, res, next) {
    try {
      const examId = req.params.examId;
      const csv = await LeaderboardService.exportToCsv(examId);
      return res.status(200).json({ csv, success: true });
    } catch (err) {
      next(err);
    }
  }
}
