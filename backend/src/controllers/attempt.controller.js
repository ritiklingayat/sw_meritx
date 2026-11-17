import { AttemptService } from '../services/attempt.service.js';

export class AttemptController {
  static async start(req, res, next) {
    try {
      const { examId, retake } = req.body;
      const result = await AttemptService.startAttempt({
        studentId: req.user.id,
        examId,
        retake
      });
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async getById(req, res, next) {
    try {
      const attempt = await AttemptService.getAttemptById(req.params.id);
      return res.status(200).json({ attempt });
    } catch (err) {
      next(err);
    }
  }

  static async save(req, res, next) {
    try {
      const { attemptId, answers, marked, visited } = req.body;
      const result = await AttemptService.saveAttempt({
        attemptId,
        answers,
        marked,
        visited
      });
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async submit(req, res, next) {
    try {
      const { attemptId, answers, marked, timeTaken } = req.body;
      const result = await AttemptService.submitAttempt({
        attemptId,
        answers,
        marked,
        timeTaken
      });
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async terminate(req, res, next) {
    try {
      const { attemptId, answers, reason } = req.body;
      const result = await AttemptService.terminateAttempt({
        attemptId,
        answers,
        reason
      });
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
}
