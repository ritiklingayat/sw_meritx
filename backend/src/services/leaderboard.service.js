import { prisma } from '../config/prisma.js';

export class LeaderboardService {
  static formatTime(seconds) {
    const s = Math.max(0, Number(seconds) || 0);
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = s % 60;
    if (hrs > 0) {
      return `${hrs}h ${mins}m ${secs}s`;
    }
    return `${mins}m ${secs}s`;
  }

  static async getLeaderboard(examId, currentStudentId = null) {
    const attempts = await prisma.examAttempt.findMany({
      where: {
        examId,
        status: { in: ['submitted', 'TERMINATED', 'AUTO_SUBMITTED'] }
      },
      include: {
        student: true,
        result: true
      }
    });

    if (!attempts.length) {
      return {
        examId,
        totalParticipants: 0,
        highestScore: 0,
        averageScore: 0,
        lowestScore: 0,
        topThree: [],
        currentStudentRank: null,
        rankings: []
      };
    }

    // Best attempt per student
    const bestMap = new Map();
    attempts.forEach((att) => {
      const studentId = att.studentId;
      const score = Number(att.result?.score ?? 0);
      const accuracy = Number(att.result?.accuracy ?? 0);
      const timeTaken = Number(att.timeTaken ?? att.durationSeconds);

      const entry = {
        id: att.id,
        examId: att.examId,
        studentId: att.studentId,
        studentName: att.student?.name || 'Student Candidate',
        studentEmail: att.student?.email || 'student@meritx.demo',
        studentCity: att.student?.city || 'Pune',
        studentAvatar: att.student?.avatarUrl || null,
        status: att.status,
        score,
        maximumMarks: att.result?.maximumMarks ?? 300,
        percentage: att.result?.percentage ?? 0,
        accuracy,
        attempted: att.result?.attempted ?? 0,
        correct: att.result?.correct ?? 0,
        incorrect: att.result?.incorrect ?? 0,
        timeTaken,
        submittedAt: att.submittedAt || att.startedAt
      };

      const existing = bestMap.get(studentId);
      if (!existing) {
        bestMap.set(studentId, entry);
      } else {
        if (
          score > existing.score ||
          (score === existing.score && accuracy > existing.accuracy) ||
          (score === existing.score && accuracy === existing.accuracy && timeTaken < existing.timeTaken)
        ) {
          bestMap.set(studentId, entry);
        }
      }
    });

    const entries = Array.from(bestMap.values());

    // Deterministic 4-step tie-breaking:
    // 1. Highest Score descending
    // 2. Highest Accuracy descending
    // 3. Least Time taken ascending
    // 4. Earliest submission timestamp ascending
    entries.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy;
      if (a.timeTaken !== b.timeTaken) return a.timeTaken - b.timeTaken;
      return new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime();
    });

    let currentRank = 1;
    const rankings = entries.map((entry, index) => {
      if (index > 0) {
        const prev = entries[index - 1];
        const isTie =
          entry.score === prev.score &&
          entry.accuracy === prev.accuracy &&
          entry.timeTaken === prev.timeTaken;
        if (!isTie) {
          currentRank = index + 1;
        }
      }

      return {
        ...entry,
        rank: currentRank,
        formattedTime: this.formatTime(entry.timeTaken),
        isCurrentStudent: currentStudentId && String(entry.studentId) === String(currentStudentId)
      };
    });

    const scores = rankings.map((r) => r.score);
    const highestScore = Math.max(...scores);
    const lowestScore = Math.min(...scores);
    const totalScoreSum = scores.reduce((sum, val) => sum + val, 0);
    const averageScore = Math.round(totalScoreSum / rankings.length);

    const currentStudentRank = rankings.find((r) => r.isCurrentStudent) || null;
    const topThree = rankings.filter((r) => r.rank <= 3);

    return {
      examId,
      totalParticipants: rankings.length,
      highestScore,
      averageScore,
      lowestScore,
      topThree,
      currentStudentRank,
      rankings
    };
  }

  static async exportToCsv(examId) {
    const leaderboard = await this.getLeaderboard(examId);
    if (!leaderboard.rankings.length) {
      return '';
    }

    const headers = [
      'Rank',
      'Student Name',
      'Email',
      'City',
      'Score',
      'Maximum Marks',
      'Percentage',
      'Accuracy (%)',
      'Time Taken',
      'Status',
      'Submitted At'
    ];

    const rows = leaderboard.rankings.map((r) => [
      r.rank,
      `"${r.studentName.replace(/"/g, '""')}"`,
      `"${r.studentEmail}"`,
      `"${r.studentCity || ''}"`,
      r.score,
      r.maximumMarks,
      `${r.percentage}%`,
      `${r.accuracy}%`,
      `"${r.formattedTime}"`,
      r.status,
      `"${r.submittedAt}"`
    ]);

    return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
  }
}
