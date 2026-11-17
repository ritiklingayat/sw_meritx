import { storageService, STORAGE_KEYS } from './storageService';
import seedLeaderboards from '../data/seedLeaderboards.json';

class LeaderboardService {
  /**
   * Helper to format seconds into readable hours/minutes/seconds
   */
  formatTime(seconds) {
    const s = Math.max(0, Number(seconds) || 0);
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = s % 60;
    if (hrs > 0) {
      return `${hrs}h ${mins}m ${secs}s`;
    }
    return `${mins}m ${secs}s`;
  }

  /**
   * Get all eligible submitted attempts for a specific exam
   */
  getAllAttemptsForExam(examId) {
    const localAttempts = storageService.getCollection(STORAGE_KEYS.ATTEMPTS) || [];
    const users = storageService.getCollection(STORAGE_KEYS.USERS) || [];

    // Filter local submitted attempts for this exam
    const validLocal = localAttempts
      .filter((a) => a.examId === examId && (a.status === 'submitted' || a.status === 'TERMINATED') && a.result)
      .map((a) => {
        const u = users.find((user) => user.id === a.studentId) || {};
        const res = a.result || {};
        return {
          id: a.id,
          examId: a.examId,
          studentId: a.studentId,
          studentName: u.name || a.studentName || 'Student Candidate',
          studentEmail: u.email || 'student@meritx.demo',
          studentCity: u.city || 'Pune',
          studentAvatar: u.avatar || null,
          status: a.status,
          score: Number(res.score ?? 0),
          maximumMarks: Number(res.maximumMarks ?? 300),
          percentage: Number(res.percentage ?? (res.maximumMarks ? Math.round((res.score / res.maximumMarks) * 100) : 0)),
          accuracy: Number(res.accuracy ?? 0),
          attempted: Number(res.attempted ?? 0),
          correct: Number(res.correct ?? 0),
          incorrect: Number(res.incorrect ?? 0),
          timeTaken: Number(a.timeTaken ?? 3600),
          submittedAt: a.submittedAt || a.startedAt || new Date().toISOString()
        };
      });

    // Seed attempts for this exam
    const validSeeds = (seedLeaderboards || []).filter((s) => s.examId === examId);

    // Merge: If a student exists in local attempts, prioritize local attempt
    const studentIdsInLocal = new Set(validLocal.map((a) => a.studentId));
    const combined = [...validLocal];

    validSeeds.forEach((seed) => {
      if (!studentIdsInLocal.has(seed.studentId)) {
        combined.push(seed);
      }
    });

    return combined;
  }

  /**
   * Calculate deterministic rankings for an exam
   */
  getExamLeaderboard(examId, currentStudentId = null) {
    const attempts = this.getAllAttemptsForExam(examId);

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

    // Deduplicate student attempts: Keep best score per student
    const bestPerStudent = new Map();
    attempts.forEach((att) => {
      const existing = bestPerStudent.get(att.studentId);
      if (!existing) {
        bestPerStudent.set(att.studentId, att);
      } else {
        // Tie-breaker rules: 1. Higher score, 2. Higher accuracy, 3. Less time taken
        if (
          att.score > existing.score ||
          (att.score === existing.score && att.accuracy > existing.accuracy) ||
          (att.score === existing.score && att.accuracy === existing.accuracy && att.timeTaken < existing.timeTaken)
        ) {
          bestPerStudent.set(att.studentId, att);
        }
      }
    });

    const deduped = Array.from(bestPerStudent.values());

    // Deterministic Sorting:
    // 1. Score descending
    // 2. Accuracy descending
    // 3. Time taken ascending
    // 4. SubmittedAt ascending
    deduped.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy;
      if (a.timeTaken !== b.timeTaken) return a.timeTaken - b.timeTaken;
      return String(a.submittedAt).localeCompare(String(b.submittedAt));
    });

    // Assign rank
    let currentRank = 1;
    const rankings = deduped.map((entry, index) => {
      if (index > 0) {
        const prev = deduped[index - 1];
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

    // Calculate Summary Metrics
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

  /**
   * Export leaderboard data to CSV format
   */
  exportToCsv(examId, examTitle = 'Examination') {
    const leaderboard = this.getExamLeaderboard(examId);
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

export const leaderboardService = new LeaderboardService();
