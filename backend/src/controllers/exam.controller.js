import { ExamService } from '../services/exam.service.js';
import { QuestionService } from '../services/question.service.js';
import { successResponse } from '../utils/apiResponse.js';

export class ExamController {
  static async getExams(req, res, next) {
    try {
      const exams = await ExamService.getExams(req.query);
      return res.status(200).json({ exams });
    } catch (err) {
      next(err);
    }
  }

  static async getExamById(req, res, next) {
    try {
      const exam = await ExamService.getExamById(req.params.id);
      return res.status(200).json({ exam });
    } catch (err) {
      next(err);
    }
  }

  static async register(req, res, next) {
    try {
      const examId = req.body.examId;
      const result = await ExamService.registerExam(req.user.id, examId);
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async getExamQuestions(req, res, next) {
    try {
      const examId = req.params.id || req.query.examId;
      const exam = examId ? await ExamService.getExamById(examId) : null;
      // Do not expose correct answers or explanations if student takes exam
      const isStudent = req.user?.role === 'STUDENT' || !req.user;
      const questions = await QuestionService.getQuestionsForExam(exam, isStudent);
      return res.status(200).json({ questions });
    } catch (err) {
      next(err);
    }
  }

  static async getPatterns(req, res, next) {
    try {
      const patterns = await ExamService.getExamPatterns();
      return res.status(200).json({ patterns });
    } catch (err) {
      next(err);
    }
  }
}
