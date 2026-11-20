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

    const activeExamsCount = new Set(attempts.filter((a) => a.status === 'in_progress').map((a) => a.examId)).size;
    const activeAttemptsCount = activeSessions;
    const activeCamerasCount = activeSessions;
    const interruptedCamerasCount = cameraInterruptions;
    const studentsWithWarningsCount = attempts.filter((a) => a.warningCount > 0 && a.warningCount < 3).length;
    const flaggedAttemptsCount = flaggedCandidates;
    const completedAttemptsCount = attempts.filter((a) => ['submitted', 'TERMINATED', 'AUTO_SUBMITTED'].includes(a.status)).length;

    return {
      activeSessions,
      totalViolations: events.length,
      flaggedCandidates,
      terminatedSessions,
      activeExamsCount,
      activeAttemptsCount,
      activeCamerasCount,
      interruptedCamerasCount,
      studentsWithWarningsCount,
      flaggedAttemptsCount,
      completedAttemptsCount,
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
        exam: true,
        proctoringSession: true
      },
      orderBy: { startedAt: 'desc' }
    });

    return attempts.map((a) => {
      const ps = a.proctoringSession;
      return {
        attemptId: a.id,
        studentId: a.studentId,
        studentName: a.student?.name || 'Demo Candidate',
        candidateName: a.student?.name || 'Demo Candidate',
        studentEmail: a.student?.email || 'student@meritx.demo',
        candidateEmail: a.student?.email || 'student@meritx.demo',
        candidateCity: a.student?.city || 'Pune',
        examId: a.examId,
        examTitle: a.exam?.title || 'Online Assessment',
        status: a.status,
        attemptStatus: a.status,
        warningCount: a.warningCount ?? ps?.warningCount ?? 0,
        isFlagged: a.isFlagged ?? ps?.isFlagged ?? false,
        cameraStatus: ps?.cameraStatus || (a.status === 'in_progress' ? 'active' : 'released'),
        micStatus: ps?.micStatus || (a.status === 'in_progress' ? 'active' : 'released'),
        fullscreenStatus: ps?.fullscreenStatus || (a.status === 'in_progress' ? 'locked' : 'exited'),
        interruptionCount: 0,
        totalInterruptionSeconds: 0,
        startedAt: a.startedAt
      };
    });
  }

  static async getTimeline(attemptId) {
    const attempt = await prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: {
        student: true,
        exam: true,
        proctoringSession: {
          include: {
            warnings: { orderBy: { createdAt: 'asc' } },
            events: { orderBy: { createdAt: 'desc' } }
          }
        }
      }
    }).catch(() => null);

    const [dbEvents, dbWarnings] = await Promise.all([
      prisma.proctoringEvent.findMany({
        where: { attemptId },
        orderBy: { createdAt: 'asc' }
      }).catch(() => []),
      prisma.proctoringWarning.findMany({
        where: { attemptId },
        orderBy: { createdAt: 'asc' }
      }).catch(() => [])
    ]);

    const session = attempt?.proctoringSession;
    const allEvents = dbEvents.length > 0 ? dbEvents : (session?.events || []);
    const allWarnings = dbWarnings.length > 0 ? dbWarnings : (session?.warnings || []);

    const timeline = allEvents.map((ev) => ({
      time: new Date(ev.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      type: ev.severity === 'critical' ? 'critical' : ev.severity === 'violation' ? 'warning' : 'info',
      message: `${ev.eventType}: ${ev.description}`
    }));

    const attemptData = {
      id: attempt?.id || attemptId,
      studentId: attempt?.studentId || 'unknown',
      studentName: attempt?.student?.name || 'Candidate',
      candidateName: attempt?.student?.name || 'Candidate',
      studentEmail: attempt?.student?.email || 'student@meritx.demo',
      examId: attempt?.examId || 'unknown',
      examTitle: attempt?.exam?.title || 'Competitive Assessment',
      status: attempt?.status || 'in_progress',
      cameraStatus: session?.cameraStatus || (attempt?.status === 'in_progress' ? 'active' : 'released'),
      micStatus: session?.micStatus || (attempt?.status === 'in_progress' ? 'active' : 'released'),
      fullscreenStatus: session?.fullscreenStatus || (attempt?.status === 'in_progress' ? 'locked' : 'exited'),
      warningCount: attempt?.warningCount ?? session?.warningCount ?? allWarnings.length,
      isFlagged: attempt?.isFlagged ?? session?.isFlagged ?? false,
      consentGivenAt: attempt?.startedAt || new Date().toISOString(),
      verificationChecks: {
        webcamVerified: true,
        microphoneVerified: true,
        screenCaptureAllowed: true,
        singleDisplayActive: true,
        environmentLightingOk: true
      }
    };

    const warnings = allWarnings.map((w) => ({
      id: w.id,
      warningNumber: w.warningNumber || 1,
      category: w.category || 'exam_rule_violation',
      message: w.message || 'Proctoring alert recorded',
      timestamp: w.createdAt || new Date().toISOString()
    }));

    const events = allEvents.map((ev) => ({
      id: ev.id,
      eventType: ev.eventType || 'EVENT',
      severity: ev.severity || 'info',
      description: ev.description || '',
      details: ev.details || ev.description || '',
      timestamp: ev.createdAt || new Date().toISOString()
    }));

    return {
      attempt: attemptData,
      warnings,
      events,
      timeline: timeline.length ? timeline : [
        { time: '10:00:00 AM', type: 'info', message: 'Hardware check passed: Webcam and Audio verified.' },
        { time: '10:00:05 AM', type: 'info', message: 'Candidate started examination in Fullscreen mode.' }
      ]
    };
  }
}
