import { storageService, STORAGE_KEYS } from './storageService';

const PROCTORING_STORAGE_KEY = 'meritx_proctoring_events';

class ProctoringService {
  getEvents() {
    return storageService.get(PROCTORING_STORAGE_KEY, []);
  }

  saveEvents(events) {
    storageService.set(PROCTORING_STORAGE_KEY, events);
  }

  logEvent({
    attemptId,
    examId,
    studentId,
    studentName,
    eventType, // "TAB_SWITCH", "WINDOW_BLUR", "FULLSCREEN_EXIT", "CAMERA_INTERRUPTED", "MIC_INTERRUPTED", "WARNING_ISSUED", "EXAM_TERMINATED"
    description,
    severity = 'warning' // "info", "warning", "violation", "critical"
  }) {
    const events = this.getEvents();
    const newEvent = {
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      attemptId,
      examId,
      studentId,
      studentName: studentName || 'Candidate',
      eventType,
      description,
      severity,
      timestamp: new Date().toISOString()
    };
    events.unshift(newEvent);
    this.saveEvents(events.slice(0, 500)); // Cap at 500 records
    return newEvent;
  }

  getEventsForAttempt(attemptId) {
    return this.getEvents().filter((e) => String(e.attemptId) === String(attemptId));
  }

  getEventsForStudent(studentId) {
    return this.getEvents().filter((e) => String(e.studentId) === String(studentId));
  }

  getProctoringSummary() {
    const events = this.getEvents();
    const attempts = storageService.getCollection(STORAGE_KEYS.ATTEMPTS);

    const activeAttempts = attempts.filter((a) => a.status === 'in_progress');
    const flaggedAttempts = attempts.filter((a) => a.isFlagged || (a.warningCount && a.warningCount > 0));
    const terminatedAttempts = attempts.filter((a) => a.status === 'TERMINATED');

    const tabSwitchCount = events.filter((e) => e.eventType === 'TAB_SWITCH' || e.eventType === 'WINDOW_BLUR').length;
    const fullscreenExitCount = events.filter((e) => e.eventType === 'FULLSCREEN_EXIT').length;
    const cameraInterruptionCount = events.filter((e) => e.eventType === 'CAMERA_INTERRUPTED').length;
    const micInterruptionCount = events.filter((e) => e.eventType === 'MIC_INTERRUPTED').length;

    return {
      activeSessions: activeAttempts.length,
      totalViolations: events.length,
      flaggedCandidates: flaggedAttempts.length,
      terminatedSessions: terminatedAttempts.length,
      breakdown: {
        tabSwitches: tabSwitchCount,
        fullscreenExits: fullscreenExitCount,
        cameraInterruptions: cameraInterruptionCount,
        micInterruptions: micInterruptionCount
      }
    };
  }

  getCandidatesStatus() {
    const attempts = storageService.getCollection(STORAGE_KEYS.ATTEMPTS);
    const users = storageService.getCollection(STORAGE_KEYS.USERS);
    const exams = storageService.getCollection(STORAGE_KEYS.EXAMS);
    const events = this.getEvents();

    return attempts.map((a) => {
      const u = users.find((user) => user.id === a.studentId) || { name: 'Demo Candidate', email: 'student@meritx.demo' };
      const e = exams.find((exam) => exam.id === a.examId) || { title: 'Online Assessment' };
      const studentEvents = events.filter((ev) => ev.attemptId === a.id);

      return {
        attemptId: a.id,
        studentId: a.studentId,
        candidateName: u.name,
        candidateEmail: u.email,
        candidateCity: u.city || 'Pune',
        examId: a.examId,
        examTitle: e.title,
        status: a.status,
        warningCount: a.warningCount || studentEvents.filter((ev) => ev.severity === 'violation').length,
        isFlagged: Boolean(a.isFlagged || a.warningCount >= 2),
        cameraStatus: a.status === 'in_progress' ? 'active' : 'released',
        micStatus: a.status === 'in_progress' ? 'active' : 'released',
        fullscreenStatus: a.status === 'in_progress' ? 'locked' : 'exited',
        lastEvent: studentEvents[0] || null,
        totalEvents: studentEvents.length,
        startedAt: a.startedAt
      };
    });
  }
}

export const proctoringService = new ProctoringService();
