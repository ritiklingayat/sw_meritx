import { prisma } from '../config/prisma.js';
import { NotFoundError, BadRequestError, ForbiddenError } from '../utils/errors.js';
import { ScoringService } from './scoring.service.js';
import { QuestionService } from './question.service.js';

export class AttemptService {
  static async startAttempt({ studentId, examId, retake = false }) {
    const exam = await prisma.exam.findUnique({
      where: { id: examId }
    });

    if (!exam) {
      throw new NotFoundError('Examination not found.');
    }

    // 1. Strict Registration Check
    const registration = await prisma.examRegistration.findUnique({
      where: {
        studentId_examId: {
          studentId,
          examId
        }
      }
    });

    if (!registration || registration.status !== 'confirmed') {
      throw new ForbiddenError('Registration required: You must register for this examination before attempting it.');
    }

    // 2. Strict One Attempt Rule / Resume Check
    const existingAttempt = await prisma.examAttempt.findUnique({
      where: {
        studentId_examId: {
          studentId,
          examId
        }
      },
      include: { result: true }
    });

    if (existingAttempt) {
      if (['submitted', 'TERMINATED', 'AUTO_SUBMITTED'].includes(existingAttempt.status)) {
        return {
          attempt: existingAttempt,
          alreadyFinished: true,
          message: 'You have already submitted this examination. Each student is limited to exactly one attempt.'
        };
      }

      // Resume in-progress attempt
      return {
        attempt: existingAttempt,
        resumed: true
      };
    }

    // 3. Strict Window Check
    const now = new Date();
    let durationSeconds = (exam.duration || 180) * 60;
    let deadlineAt = new Date(now.getTime() + durationSeconds * 1000);
    let isTruncatedByWindow = false;

    if (exam.schedule) {
      const schedule = exam.schedule;
      if (schedule.startsAt && new Date(schedule.startsAt) > now) {
        throw new BadRequestError(`Examination has not started yet. It is scheduled to begin on ${new Date(schedule.startsAt).toLocaleString('en-IN')}.`);
      }

      if (schedule.endsAt) {
        const windowEnd = new Date(schedule.endsAt);
        if (windowEnd < now) {
          throw new BadRequestError('Examination window has closed.');
        }

        if (deadlineAt > windowEnd) {
          deadlineAt = windowEnd;
          durationSeconds = Math.max(60, Math.floor((windowEnd.getTime() - now.getTime()) / 1000));
          isTruncatedByWindow = true;
        }
      }
    }

    // 4. Fetch questions snapshot
    const questions = await QuestionService.getQuestionsForExam(exam);

    // 5. Create Attempt
    const attempt = await prisma.examAttempt.create({
      data: {
        studentId,
        examId,
        status: 'in_progress',
        answers: {},
        marked: [],
        visited: [0],
        durationSeconds,
        startedAt: now,
        deadlineAt,
        warningCount: 0,
        isFlagged: false,
        proctoringStatus: exam.proctoringRequired ? 'monitored' : 'unmonitored',
        questionSnapshot: questions
      }
    });

    // Initialize proctoring session if proctored
    if (exam.proctoringRequired) {
      await prisma.proctoringSession.create({
        data: {
          attemptId: attempt.id,
          examId,
          studentId,
          cameraStatus: 'active',
          micStatus: 'active',
          fullscreenStatus: 'locked'
        }
      }).catch(() => null);
    }

    return {
      attempt,
      started: true,
      isTruncatedByWindow
    };
  }

  static async getAttemptById(attemptId) {
    const attempt = await prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: {
        exam: true,
        result: true
      }
    });
    if (!attempt) throw new NotFoundError('Attempt not found.');
    return attempt;
  }

  static async saveAttempt({ attemptId, answers, marked, visited }) {
    const attempt = await prisma.examAttempt.findUnique({
      where: { id: attemptId }
    });

    if (!attempt) throw new NotFoundError('Attempt not found.');
    if (attempt.status !== 'in_progress') {
      return { success: false, message: 'Attempt is no longer in progress.', attempt };
    }

    const data = { lastSavedAt: new Date() };
    if (answers !== undefined) data.answers = answers;
    if (marked !== undefined) data.marked = marked;
    if (visited !== undefined) data.visited = visited;

    const updated = await prisma.examAttempt.update({
      where: { id: attemptId },
      data
    });

    return { success: true, attempt: updated };
  }

  static async submitAttempt({ attemptId, answers, marked, timeTaken }) {
    const attempt = await prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: { exam: true }
    });

    if (!attempt) throw new NotFoundError('Attempt not found.');

    const finalAnswers = answers !== undefined ? answers : (attempt.answers || {});
    const questions = attempt.questionSnapshot || await QuestionService.getQuestionsForExam(attempt.exam);

    // Calculate official scores server-side
    const finalResult = ScoringService.evaluateAttempt(questions, finalAnswers, attempt.exam?.configuration);

    const now = new Date();
    const updated = await prisma.$transaction(async (tx) => {
      const savedAttempt = await tx.examAttempt.update({
        where: { id: attemptId },
        data: {
          status: 'submitted',
          answers: finalAnswers,
          marked: marked || attempt.marked || [],
          submittedAt: now,
          timeTaken: timeTaken || attempt.durationSeconds
        }
      });

      const savedResult = await tx.examResult.upsert({
        where: { attemptId },
        update: {
          score: finalResult.score,
          maximumMarks: finalResult.maximumMarks,
          percentage: finalResult.percentage,
          accuracy: finalResult.accuracy,
          attempted: finalResult.attempted,
          correct: finalResult.correct,
          incorrect: finalResult.incorrect,
          unattempted: finalResult.unattempted,
          details: finalResult.details
        },
        create: {
          attemptId,
          examId: attempt.examId,
          studentId: attempt.studentId,
          score: finalResult.score,
          maximumMarks: finalResult.maximumMarks,
          percentage: finalResult.percentage,
          accuracy: finalResult.accuracy,
          attempted: finalResult.attempted,
          correct: finalResult.correct,
          incorrect: finalResult.incorrect,
          unattempted: finalResult.unattempted,
          details: finalResult.details
        }
      });

      return { attempt: savedAttempt, result: savedResult };
    });

    return {
      success: true,
      attempt: updated.attempt,
      result: finalResult
    };
  }

  static async terminateAttempt({ attemptId, answers, reason = 'MAX_VIOLATIONS_REACHED' }) {
    const attempt = await prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: { exam: true }
    });

    if (!attempt) throw new NotFoundError('Attempt not found.');

    const finalAnswers = answers !== undefined ? answers : (attempt.answers || {});
    const questions = attempt.questionSnapshot || await QuestionService.getQuestionsForExam(attempt.exam);

    const finalResult = ScoringService.evaluateAttempt(questions, finalAnswers, attempt.exam?.configuration);
    const now = new Date();

    const updated = await prisma.$transaction(async (tx) => {
      const savedAttempt = await tx.examAttempt.update({
        where: { id: attemptId },
        data: {
          status: 'TERMINATED',
          terminationReason: reason,
          terminatedAt: now,
          submittedAt: now,
          answers: finalAnswers
        }
      });

      const savedResult = await tx.examResult.upsert({
        where: { attemptId },
        update: {
          score: finalResult.score,
          maximumMarks: finalResult.maximumMarks,
          percentage: finalResult.percentage,
          accuracy: finalResult.accuracy,
          attempted: finalResult.attempted,
          correct: finalResult.correct,
          incorrect: finalResult.incorrect,
          unattempted: finalResult.unattempted,
          details: finalResult.details
        },
        create: {
          attemptId,
          examId: attempt.examId,
          studentId: attempt.studentId,
          score: finalResult.score,
          maximumMarks: finalResult.maximumMarks,
          percentage: finalResult.percentage,
          accuracy: finalResult.accuracy,
          attempted: finalResult.attempted,
          correct: finalResult.correct,
          incorrect: finalResult.incorrect,
          unattempted: finalResult.unattempted,
          details: finalResult.details
        }
      });

      return { attempt: savedAttempt, result: savedResult };
    });

    return {
      success: true,
      attempt: updated.attempt,
      result: finalResult
    };
  }
}
