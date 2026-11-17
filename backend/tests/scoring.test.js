import test from 'node:test';
import assert from 'node:assert';
import { ScoringService } from '../src/services/scoring.service.js';

test('Scoring Engine - Single Correct Evaluation', () => {
  const questions = [
    { id: 'q1', questionType: 'single_correct', answer: 1, options: ['A', 'B', 'C', 'D'], subject: 'Physics' },
    { id: 'q2', questionType: 'single_correct', answer: 2, options: ['A', 'B', 'C', 'D'], subject: 'Physics' },
    { id: 'q3', questionType: 'single_correct', answer: 0, options: ['A', 'B', 'C', 'D'], subject: 'Chemistry' }
  ];

  const config = {
    rules: {
      single_correct: { correct: 4, incorrect: -1, unanswered: 0 }
    }
  };

  // 1 correct, 1 wrong, 1 unattempted
  // Score: +4 - 1 + 0 = 3
  const answers = {
    q1: 1, // correct (+4)
    q2: 0  // wrong (-1)
    // q3 unattempted (0)
  };

  const result = ScoringService.evaluateAttempt(questions, answers, config);

  assert.strictEqual(result.score, 3, 'Score should be 3 (+4 - 1)');
  assert.strictEqual(result.maximumMarks, 12, 'Maximum marks should be 12 (3 * 4)');
  assert.strictEqual(result.attempted, 2, 'Attempted count should be 2');
  assert.strictEqual(result.correct, 1, 'Correct count should be 1');
  assert.strictEqual(result.incorrect, 1, 'Incorrect count should be 1');
  assert.strictEqual(result.unattempted, 1, 'Unattempted count should be 1');
  assert.strictEqual(result.accuracy, 50, 'Accuracy should be 50% (1 of 2 attempted)');
});

test('Scoring Engine - JEE Advanced Multiple Correct & Partial Marking', () => {
  const questions = [
    {
      id: 'q1',
      questionType: 'multiple_correct',
      correctOptions: [0, 1, 2], // Options A, B, C are correct
      options: ['A', 'B', 'C', 'D'],
      subject: 'Physics'
    }
  ];

  const config = {
    rules: {
      multiple_correct: { correct: 4, incorrect: -2, unanswered: 0, partial: true }
    }
  };

  // Case A: Exact full correct set [0, 1, 2] -> +4
  const resExact = ScoringService.evaluateAttempt(questions, { q1: [0, 1, 2] }, config);
  assert.strictEqual(resExact.score, 4, 'Full correct set should award full marks (+4)');
  assert.strictEqual(resExact.correct, 1);

  // Case B: Subset partial correct [0, 1] without wrong options -> +2
  const resPartial = ScoringService.evaluateAttempt(questions, { q1: [0, 1] }, config);
  assert.strictEqual(resPartial.score, 2, 'Subset of 2 options should award partial marks (+2)');
  assert.strictEqual(resPartial.details[0].isPartial, true);

  // Case C: Includes an incorrect option [0, 1, 3] -> -2 penalty
  const resWrong = ScoringService.evaluateAttempt(questions, { q1: [0, 1, 3] }, config);
  assert.strictEqual(resWrong.score, -2, 'Selecting any incorrect option should apply negative marking (-2)');
  assert.strictEqual(resWrong.incorrect, 1);
});

test('Scoring Engine - Numerical Questions with Tolerance', () => {
  const questions = [
    {
      id: 'q1',
      questionType: 'numerical',
      numericalAnswer: 40.0,
      numericalTolerance: 0.05,
      subject: 'Physics'
    }
  ];

  const config = {
    rules: {
      numerical: { correct: 4, incorrect: 0, unanswered: 0 }
    }
  };

  // Exact match
  const resExact = ScoringService.evaluateAttempt(questions, { q1: '40' }, config);
  assert.strictEqual(resExact.score, 4);

  // Within tolerance (40.03 is within 0.05 of 40.0)
  const resTol = ScoringService.evaluateAttempt(questions, { q1: '40.03' }, config);
  assert.strictEqual(resTol.score, 4, 'Answer within tolerance should be marked correct');

  // Outside tolerance (40.10 is outside 0.05 of 40.0)
  const resOut = ScoringService.evaluateAttempt(questions, { q1: '40.10' }, config);
  assert.strictEqual(resOut.score, 0, 'Answer outside tolerance should be marked incorrect');
});

test('Scoring Engine - MHT-CET Subject Overrides (Mathematics +2, No Negative)', () => {
  const questions = [
    { id: 'q1', questionType: 'single_correct', answer: 0, subject: 'Physics' },
    { id: 'q2', questionType: 'single_correct', answer: 1, subject: 'Mathematics' }
  ];

  const config = {
    rules: {
      single_correct: { correct: 1, incorrect: 0, unanswered: 0 },
      subjectOverrides: {
        Mathematics: { correct: 2, incorrect: 0 }
      }
    }
  };

  // Both correct: Physics (+1), Mathematics (+2) = +3
  const res = ScoringService.evaluateAttempt(questions, { q1: 0, q2: 1 }, config);
  assert.strictEqual(res.score, 3, 'Physics +1, Mathematics +2 should yield 3');
  assert.strictEqual(res.maximumMarks, 3);
  assert.strictEqual(res.subjectBreakdown.Mathematics.score, 2);
  assert.strictEqual(res.subjectBreakdown.Physics.score, 1);
});
