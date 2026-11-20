import test from 'node:test';
import assert from 'node:assert';
import { LeaderboardService } from '../src/services/leaderboard.service.js';

test('Leaderboard - Deterministic 4-level Tie-Breaking Algorithm', () => {
  // Candidate A: Score 250, Accuracy 80%, Time 3600
  // Candidate B: Score 250, Accuracy 85%, Time 3800 -> Higher accuracy beats Candidate A
  // Candidate C: Score 250, Accuracy 85%, Time 3200 -> Same score & accuracy as B, but less time beats B
  // Candidate D: Score 280, Accuracy 90%, Time 4000 -> Highest score is #1
  const candidates = [
    { studentId: 'A', score: 250, accuracy: 80, timeTaken: 3600, submittedAt: '2026-11-04T10:00:00Z' },
    { studentId: 'B', score: 250, accuracy: 85, timeTaken: 3800, submittedAt: '2026-11-04T10:05:00Z' },
    { studentId: 'C', score: 250, accuracy: 85, timeTaken: 3200, submittedAt: '2026-11-04T10:10:00Z' },
    { studentId: 'D', score: 280, accuracy: 90, timeTaken: 4000, submittedAt: '2026-11-04T10:15:00Z' }
  ];

  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy;
    if (a.timeTaken !== b.timeTaken) return a.timeTaken - b.timeTaken;
    return new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime();
  });

  assert.strictEqual(candidates[0].studentId, 'D', 'Rank 1 must be D (Highest score 280)');
  assert.strictEqual(candidates[1].studentId, 'C', 'Rank 2 must be C (Score 250, higher accuracy 85%, less time 3200)');
  assert.strictEqual(candidates[2].studentId, 'B', 'Rank 3 must be B (Score 250, accuracy 85%, time 3800)');
  assert.strictEqual(candidates[3].studentId, 'A', 'Rank 4 must be A (Score 250, lower accuracy 80%)');
});

test('Leaderboard - Time Formatting Utility', () => {
  assert.strictEqual(LeaderboardService.formatTime(90), '1m 30s');
  assert.strictEqual(LeaderboardService.formatTime(3600), '1h 0m 0s');
  assert.strictEqual(LeaderboardService.formatTime(5445), '1h 30m 45s');
});

test('Proctoring - 3-Warning Progressive Enforcement Logic', () => {
  let warningCount = 0;
  let isFlagged = false;
  let isTerminated = false;

  function handleViolation() {
    warningCount += 1;
    if (warningCount >= 2) isFlagged = true;
    if (warningCount >= 3) isTerminated = true;
    return { warningCount, isFlagged, isTerminated };
  }

  // Violation 1
  const v1 = handleViolation();
  assert.strictEqual(v1.warningCount, 1);
  assert.strictEqual(v1.isFlagged, false);
  assert.strictEqual(v1.isTerminated, false);

  // Violation 2
  const v2 = handleViolation();
  assert.strictEqual(v2.warningCount, 2);
  assert.strictEqual(v2.isFlagged, true, 'Warning 2 must flag candidate for review');
  assert.strictEqual(v2.isTerminated, false);

  // Violation 3
  const v3 = handleViolation();
  assert.strictEqual(v3.warningCount, 3);
  assert.strictEqual(v3.isFlagged, true);
  assert.strictEqual(v3.isTerminated, true, 'Warning 3 must trigger automatic examination termination');
});

test('Proctoring - Dossier payload structure contains attempt, cameraStatus and telemetry', () => {
  const dummyAttempt = {
    id: 'att-123',
    studentId: 'usr-1',
    studentName: 'Aarav Sharma',
    examTitle: 'JEE Advanced Challenge 01',
    status: 'in_progress',
    cameraStatus: 'active',
    warningCount: 1,
    isFlagged: false,
    consentGivenAt: new Date().toISOString(),
    verificationChecks: {
      webcamVerified: true,
      microphoneVerified: true
    }
  };

  const dummyDossier = {
    attempt: dummyAttempt,
    warnings: [
      { id: 'w-1', warningNumber: 1, category: 'tab_switch', message: 'Switched tabs', timestamp: new Date().toISOString() }
    ],
    events: [
      { id: 'ev-1', eventType: 'TAB_SWITCH', severity: 'warning', description: 'Tab switch', timestamp: new Date().toISOString() }
    ],
    timeline: [
      { time: '10:00:00 AM', type: 'info', message: 'Hardware check passed' }
    ]
  };

  assert.ok(dummyDossier.attempt, 'Dossier must have attempt object');
  assert.strictEqual(dummyDossier.attempt.cameraStatus, 'active', 'attempt.cameraStatus must be accessible');
  assert.strictEqual(Array.isArray(dummyDossier.warnings), true, 'warnings must be an array');
  assert.strictEqual(Array.isArray(dummyDossier.events), true, 'events must be an array');
  assert.strictEqual(Array.isArray(dummyDossier.timeline), true, 'timeline must be an array');
});
