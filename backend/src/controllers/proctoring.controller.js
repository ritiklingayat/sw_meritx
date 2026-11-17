import { ProctoringService } from '../services/proctoring.service.js';

export class ProctoringController {
  static async initSession(req, res, next) {
    try {
      const result = await ProctoringService.initSession({
        attemptId: req.body.attemptId,
        examId: req.body.examId,
        studentId: req.user?.id || req.body.studentId
      });
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async heartbeat(req, res, next) {
    try {
      const result = await ProctoringService.heartbeat(req.body.attemptId);
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async warning(req, res, next) {
    try {
      const result = await ProctoringService.recordWarning({
        attemptId: req.body.attemptId,
        examId: req.body.examId,
        studentId: req.user?.id || req.body.studentId,
        studentName: req.user?.name || req.body.studentName,
        category: req.body.category,
        message: req.body.message,
        eventType: req.body.eventType
      });
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async event(req, res, next) {
    try {
      const result = await ProctoringService.logEvent({
        attemptId: req.body.attemptId,
        examId: req.body.examId,
        studentId: req.user?.id || req.body.studentId,
        eventType: req.body.eventType,
        description: req.body.description,
        severity: req.body.severity
      });
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
}
