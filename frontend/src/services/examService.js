import { storageService, STORAGE_KEYS } from './storageService';
import { questionService } from './questionService';
import { resultService } from './resultService';

class ExamService {
  async getExams({ search = '', type = '', status = '', courseId = '' } = {}) {
    let list = storageService.getCollection(STORAGE_KEYS.EXAMS);

    if (courseId) {
      list = list.filter((e) => e.courseId === courseId);
    }

    if (type) {
      list = list.filter((e) => e.type?.toLowerCase() === type.toLowerCase());
    }

    if (status) {
      list = list.filter((e) => e.status === status);
    }

    if (search) {
      const q = search.toLowerCase();
      list = list.filter((e) =>
        e.title?.toLowerCase().includes(q) ||
        e.subject?.toLowerCase().includes(q) ||
        e.type?.toLowerCase().includes(q)
      );
    }

    return list;
  }

  async getExamById(id) {
    const list = storageService.getCollection(STORAGE_KEYS.EXAMS);
    if (!id) return list[0] || null;

    // 1. Direct ID match
    let found = list.find((e) => e.id === id);
    if (found) return found;

    // 2. Course ID match (e.g. "course-jee-main" or "course-neet")
    found = list.find((e) => e.courseId === id);
    if (found) return found;

    // 3. Slug or exam type match (e.g. contains "neet", "advanced", "jee")
    const clean = String(id).toLowerCase();
    if (clean.includes("neet-bio")) {
      found = list.find((e) => e.id.includes("biology")) || list.find((e) => e.type?.includes("NEET"));
    } else if (clean.includes("neet")) {
      found = list.find((e) => e.id.includes("neet-01")) || list.find((e) => e.type?.includes("NEET"));
    } else if (clean.includes("advanced")) {
      found = list.find((e) => e.id.includes("advanced"));
    } else if (clean.includes("jee") || clean.includes("main")) {
      found = list.find((e) => e.id.includes("jee-main"));
    }

    // 4. Safe fallback: return first exam so candidate is never blocked
    return found || list[0] || null;
  }

  async createExam(examData) {
    const newExam = storageService.insert(STORAGE_KEYS.EXAMS, {
      ...examData,
      status: examData.status || 'published',
      registered: 0,
      registrationOpen: examData.registrationOpen ?? true
    });
    return newExam;
  }

  async updateExam(id, updates) {
    return storageService.update(STORAGE_KEYS.EXAMS, id, updates);
  }

  async deleteExam(id) {
    return storageService.delete(STORAGE_KEYS.EXAMS, id);
  }

  async registerExam(studentId, examId, studentName = '') {
    const { walletService } = await import('./walletService');
    const { getExamScheduleInfo, formatDateTime } = await import('./schedulingService');
    const exam = await this.getExamById(examId);
    if (!exam) throw new Error('Examination not found.');

    // Strict Registration Window Check
    const scheduleInfo = getExamScheduleInfo(exam);
    if (!scheduleInfo.isRegistrationOpen) {
      if (scheduleInfo.registrationStatus === 'Upcoming Registration') {
        throw new Error(`Registration opens on ${formatDateTime(scheduleInfo.registrationOpensAt)}.`);
      } else {
        throw new Error('Registration for this examination has closed.');
      }
    }

    return walletService.deductForExamRegistration({
      studentId,
      examId,
      examTitle: exam?.title || 'Competitive Mock Examination',
      fee: exam?.fee || 0,
      studentName
    });
  }

  async startAttempt({ studentId, examId }) {
    const exam = await this.getExamById(examId);
    if (!exam) throw new Error('Examination not found.');

    // 1. Strict Registration Check: Must be registered and confirmed
    const registrations = storageService.getCollection(STORAGE_KEYS.REGISTRATIONS);
    const isRegistered = registrations.some(
      (r) => r.studentId === studentId && r.examId === examId && (r.status === 'confirmed' || r.paymentStatus === 'successful')
    );
    if (!isRegistered) {
      throw new Error('Registration required: You must register and complete payment for this examination before attempting it.');
    }

    // 2. Strict One Attempt Rule
    const attempts = storageService.getCollection(STORAGE_KEYS.ATTEMPTS);
    let attempt = attempts.find((a) => a.studentId === studentId && a.examId === examId);

    if (attempt) {
      // If already submitted or terminated, strictly block starting another attempt
      if (attempt.status === 'submitted' || attempt.status === 'AUTO_SUBMITTED' || attempt.status === 'TERMINATED') {
        return {
          attempt,
          alreadyFinished: true,
          message: 'You have already submitted this examination. Each student is limited to exactly one attempt.'
        };
      }
      // If in progress, resume the existing attempt without creating a duplicate
      return { attempt, resumed: true };
    }

    // 3. Strict Examination Availability Window Check
    const { getExamScheduleInfo, calculateAttemptDeadline, formatDateTime } = await import('./schedulingService');
    const scheduleInfo = getExamScheduleInfo(exam);

    if (scheduleInfo.isCancelled) {
      throw new Error('This examination has been cancelled by administrators.');
    }

    if (scheduleInfo.examStatus === 'Scheduled' || scheduleInfo.examStatus === 'Starting Soon') {
      throw new Error(
        `Examination has not started yet. It is scheduled to begin on ${formatDateTime(scheduleInfo.startsAt)}.`
      );
    }

    if (scheduleInfo.isCompleted) {
      throw new Error(
        `Examination window has closed. The deadline for this examination was ${formatDateTime(scheduleInfo.endsAt)}.`
      );
    }

    const { deadlineAt, durationSeconds, isTruncatedByWindow } = calculateAttemptDeadline({
      exam,
      attemptStartTime: new Date()
    });

    const now = new Date();
    const questions = await questionService.getQuestionsForExam(exam);

    const newAttempt = {
      id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      studentId,
      examId,
      status: 'in_progress',
      answers: {},
      marked: [],
      visited: [],
      durationSeconds,
      startedAt: now.toISOString(),
      deadlineAt,
      serverNow: now.toISOString(),
      warningCount: 0,
      isFlagged: false,
      proctoringStatus: exam.proctoringRequired !== false ? 'monitored' : 'unmonitored',
      isTruncatedByWindow,
      questionSnapshot: questions
    };

    const created = storageService.insert(STORAGE_KEYS.ATTEMPTS, newAttempt);
    return { attempt: created, started: true };
  }

  async saveAttempt({ attemptId, answers, marked, visited }) {
    const updates = {
      lastSavedAt: new Date().toISOString()
    };
    if (answers !== undefined) updates.answers = answers;
    if (marked !== undefined) updates.marked = marked;
    if (visited !== undefined) updates.visited = visited;

    const updated = storageService.update(STORAGE_KEYS.ATTEMPTS, attemptId, updates);
    return { success: true, attempt: updated };
  }

  async submitAttempt({ attemptId, answers, marked, timeTaken }) {
    const attempt = storageService.findById(STORAGE_KEYS.ATTEMPTS, attemptId);
    if (!attempt) throw new Error('Attempt not found.');

    const exam = await this.getExamById(attempt.examId);
    const questions = attempt.questionSnapshot || await questionService.getQuestionsForExam(exam);

    const finalAnswers = answers !== undefined ? answers : (attempt.answers || {});
    const finalResult = resultService.evaluateAttempt(questions, finalAnswers, exam?.configuration);

    const updated = storageService.update(STORAGE_KEYS.ATTEMPTS, attemptId, {
      status: 'submitted',
      attemptStatus: 'SUBMITTED',
      answers: finalAnswers,
      marked: marked || attempt.marked || [],
      result: finalResult,
      submittedAt: new Date().toISOString(),
      timeTaken: timeTaken || attempt.durationSeconds,
      obtainedMarks: finalResult.score,
      totalMarks: exam?.marks || 300,
      percentage: finalResult.accuracy
    });

    return { success: true, attempt: updated, result: finalResult };
  }

  async terminateAttempt({ attemptId, answers, reason = 'MAX_VIOLATIONS_REACHED' }) {
    const attempt = storageService.findById(STORAGE_KEYS.ATTEMPTS, attemptId);
    if (!attempt) throw new Error('Attempt not found.');

    const exam = await this.getExamById(attempt.examId);
    const questions = attempt.questionSnapshot || await questionService.getQuestionsForExam(exam);

    const finalAnswers = answers !== undefined ? answers : (attempt.answers || {});
    const finalResult = resultService.evaluateAttempt(questions, finalAnswers, exam?.configuration);

    const updated = storageService.update(STORAGE_KEYS.ATTEMPTS, attemptId, {
      status: 'TERMINATED',
      attemptStatus: 'AUTO_SUBMITTED',
      terminationReason: reason,
      terminatedAt: new Date().toISOString(),
      submittedAt: new Date().toISOString(),
      answers: finalAnswers,
      result: finalResult,
      obtainedMarks: finalResult.score,
      totalMarks: exam?.marks || 300,
      percentage: finalResult.accuracy
    });

    return { success: true, attempt: updated, result: finalResult };
  }
}

export const examService = new ExamService();
