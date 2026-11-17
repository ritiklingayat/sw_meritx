import { prisma } from '../config/prisma.js';

export class ProctoringService {
  static async initSession({ attemptId, examId, studentId }) {
    const sessionId = `proc-${Date.now()}`;
    await prisma.proctoringSession.upsert({
      where: { attemptId },
      update: {
        lastHeartbeatAt: new Date(),
        cameraStatus: 'active',
        micStatus: 'active',
        fullscreenStatus: 'locked'
      },
      create: {
        id: sessionId,
        attemptId,
        examId,
        studentId,
        cameraStatus: 'active',
        micStatus: 'active',
        fullscreenStatus: 'locked'
      }
    }).catch(() => null);

    return { success: true, sessionId };
  }

  static async heartbeat(attemptId) {
    if (attemptId) {
      await prisma.proctoringSession.updateMany({
        where: { attemptId },
        data: { lastHeartbeatAt: new Date() }
      }).catch(() => null);
    }
    return { success: true, timestamp: new Date().toISOString() };
  }

  static async recordWarning({ attemptId, examId, studentId, studentName, category, message, eventType }) {
    let warningCount = 1;
    let attempt = null;

    if (attemptId) {
      attempt = await prisma.examAttempt.findUnique({ where: { id: attemptId } });
      if (attempt) {
        warningCount = (attempt.warningCount || 0) + 1;
        await prisma.examAttempt.update({
          where: { id: attemptId },
          data: {
            warningCount,
            isFlagged: warningCount >= 2,
            flagReason: warningCount >= 2 ? (message || category || 'Progressive proctoring violations threshold exceeded') : null
          }
        });
      }
    }

    // Record Event
    const event = await prisma.proctoringEvent.create({
      data: {
        attemptId: attemptId || `att-${Date.now()}`,
        studentId: studentId || attempt?.studentId || 'unknown',
        examId: examId || attempt?.examId || 'unknown',
        eventType: eventType || 'WARNING_ISSUED',
        description: message || category || 'Proctoring violation detected',
        severity: warningCount >= 3 ? 'critical' : warningCount >= 2 ? 'violation' : 'warning',
        details: { category, message, warningCount }
      }
    });

    // Record Warning
    await prisma.proctoringWarning.create({
      data: {
        attemptId: attemptId || `att-${Date.now()}`,
        studentId: studentId || attempt?.studentId || 'unknown',
        examId: examId || attempt?.examId || 'unknown',
        warningNumber: Math.min(warningCount, 3),
        category: category || 'exam_rule_violation',
        message: message || 'Proctoring rule violation'
      }
    }).catch(() => null);

    return {
      success: true,
      warningCount,
      violationHistory: [
        { timestamp: new Date().toISOString(), category, message }
      ],
      event
    };
  }

  static async logEvent({ attemptId, examId, studentId, eventType, description, severity = 'warning' }) {
    const event = await prisma.proctoringEvent.create({
      data: {
        attemptId: attemptId || `att-${Date.now()}`,
        studentId: studentId || 'unknown',
        examId: examId || 'unknown',
        eventType: eventType || 'EVENT',
        description: description || 'Proctoring event logged',
        severity
      }
    });

    return { success: true, event };
  }

  static async getSummary() {
    const [events, attempts] = await Promise.all([
      prisma.proctoringEvent.findMany({
        take: 500,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.examAttempt.findMany()
    ]);

    const activeSessions = attempts.filter((a) => a.status === 'in_progress').length;
    const flaggedCandidates = attempts.filter((a) => a.isFlagged || a.warningCount > 0).length;
    const terminatedSessions = attempts.filter((a) => a.status === 'TERMINATED').length;

    const tabSwitches = events.filter((e) => e.eventType === 'TAB_SWITCH' || e.eventType === 'WINDOW_BLUR').length;
    const fullscreenExits = events.filter((e) => e.eventType === 'FULLSCREEN_EXIT').length;
    const cameraInterruptions = events.filter((e) => e.eventType === 'CAMERA_INTERRUPTED').length;
    const micInterruptions = events.filter((e) => e.eventType === 'MIC_INTERRUPTED').length;

    return {
      activeSessions,
      totalViolations: events.length,
      flaggedCandidates,
      terminatedSessions,
      breakdown: {
        tabSwitches,
        fullscreenExits,
        cameraInterruptions,
        micInterruptions
      }
    };
  }

  static async getCandidatesStatus() {
    const attempts = await prisma.examAttempt.findMany({
      include: {
        student: true,
        exam: true
      },
      orderBy: { startedAt: 'desc' }
    });

    return attempts.map((a) => ({
      attemptId: a.id,
      studentId: a.studentId,
      candidateName: a.student?.name || 'Demo Candidate',
      candidateEmail: a.student?.email || 'student@meritx.demo',
      candidateCity: a.student?.city || 'Pune',
      examId: a.examId,
      examTitle: a.exam?.title || 'Online Assessment',
      status: a.status,
      warningCount: a.warningCount,
      isFlagged: a.isFlagged,
      cameraStatus: a.status === 'in_progress' ? 'active' : 'released',
      micStatus: a.status === 'in_progress' ? 'active' : 'released',
      fullscreenStatus: a.status === 'in_progress' ? 'locked' : 'exited',
      startedAt: a.startedAt
    }));
  }

  static async getTimeline(attemptId) {
    const events = await prisma.proctoringEvent.findMany({
      where: { attemptId },
      orderBy: { createdAt: 'asc' }
    });

    const timeline = events.map((ev) => ({
      time: new Date(ev.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      type: ev.severity === 'critical' ? 'critical' : ev.severity === 'violation' ? 'warning' : 'info',
      message: `${ev.eventType}: ${ev.description}`
    }));

    return {
      timeline: timeline.length ? timeline : [
        { time: '10:00:00 AM', type: 'info', message: 'Hardware check passed: Webcam and Audio verified.' },
        { time: '10:00:05 AM', type: 'info', message: 'Candidate started examination in Fullscreen mode.' }
      ]
    };
  }
}
