import test from 'node:test';
import assert from 'node:assert';
import { formatExam } from '../src/services/exam.service.js';

test('Exam Scheduler - formatExam extracts nested configurations into flat fields', () => {
  const rawDbExam = {
    id: 'jee-advanced-01',
    title: 'JEE Advanced Challenge 01',
    fee: 10000, // 10000 paise = ₹100
    questionsCount: 30,
    negativeMarking: true,
    proctoringRequired: true,
    configuration: {
      negativeMarkValue: 2,
      cameraRequired: true,
      micRequired: false,
      showResultsImmediate: false,
      enableLeaderboard: true,
      rules: { single_correct: { correct: 4, incorrect: -2 } }
    }
  };

  const formatted = formatExam(rawDbExam);

  assert.strictEqual(formatted.fee, 100, 'Fee must be formatted to ₹100 from 10000 paise');
  assert.strictEqual(formatted.questions, 30, 'questions must be mapped from questionsCount');
  assert.strictEqual(formatted.negativeMarkValue, 2, 'negativeMarkValue must be extracted from configuration');
  assert.strictEqual(formatted.cameraRequired, true, 'cameraRequired must be extracted from configuration');
  assert.strictEqual(formatted.micRequired, false, 'micRequired must be extracted from configuration');
  assert.strictEqual(formatted.showResultsImmediate, false, 'showResultsImmediate must be extracted from configuration');
  assert.strictEqual(formatted.enableLeaderboard, true, 'enableLeaderboard must be extracted from configuration');
});

test('Exam Scheduler - formatExam provides fallback values when configuration is empty', () => {
  const rawDbExam = {
    id: 'neet-01',
    title: 'NEET Practice',
    fee: 5000,
    questionsCount: 45,
    negativeMarking: true,
    proctoringRequired: true,
    configuration: null
  };

  const formatted = formatExam(rawDbExam);

  assert.strictEqual(formatted.fee, 50, 'Fee must be ₹50');
  assert.strictEqual(formatted.questions, 45, 'questions mapped from questionsCount');
  assert.strictEqual(formatted.negativeMarkValue, 1, 'Default negativeMarkValue is 1 when negativeMarking is true');
  assert.strictEqual(formatted.cameraRequired, true, 'Default cameraRequired is true when proctoringRequired is true');
  assert.strictEqual(formatted.micRequired, true, 'Default micRequired is true when proctoringRequired is true');
  assert.strictEqual(formatted.showResultsImmediate, true, 'Default showResultsImmediate is true');
  assert.strictEqual(formatted.enableLeaderboard, true, 'Default enableLeaderboard is true');
});
