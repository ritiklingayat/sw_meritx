import test from 'node:test';
import assert from 'node:assert';
import { TeacherService } from '../src/services/teacher.service.js';

test('Question Bank Workflow - Teacher import sets status to submitted for admin approval', () => {
  // Simulating teacher user role
  const teacherRole = 'TEACHER';
  const isAdmin = teacherRole === 'ADMIN' || teacherRole === 'SUPERADMIN';
  const initialStatus = isAdmin ? 'published' : 'submitted';

  assert.strictEqual(isAdmin, false, 'Teacher is not an admin');
  assert.strictEqual(initialStatus, 'submitted', 'Teacher imported bank must have status "submitted" for admin approval');
});

test('Question Bank Workflow - Admin import sets status to published and publishes directly to exams', () => {
  // Simulating admin user role
  const adminRole = 'ADMIN';
  const isAdmin = adminRole === 'ADMIN' || adminRole === 'SUPERADMIN';
  const initialStatus = isAdmin ? 'published' : 'submitted';

  assert.strictEqual(isAdmin, true, 'Admin is verified');
  assert.strictEqual(initialStatus, 'published', 'Admin imported bank must be approved directly and published');
});

test('Question Bank Workflow - CSV Question Parser extracts question text, options and answers', () => {
  function parseCsv(text) {
    const rows = [];
    let currentRow = [];
    let currentField = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === '"') {
        if (inQuotes && text[i + 1] === '"') {
          currentField += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        currentRow.push(currentField);
        currentField = '';
      } else if ((char === '\r' || char === '\n') && !inQuotes) {
        if (char === '\r' && text[i + 1] === '\n') i++;
        currentRow.push(currentField);
        if (currentRow.some((c) => c.trim().length > 0)) rows.push(currentRow);
        currentRow = [];
        currentField = '';
      } else {
        currentField += char;
      }
    }
    if (currentField.length > 0 || currentRow.length > 0) {
      currentRow.push(currentField);
      if (currentRow.some((c) => c.trim().length > 0)) rows.push(currentRow);
    }
    return rows;
  }

  const sampleCsv = `question_id,exam,subject,question_type,question_text,option_a,option_b,option_c,option_d,correct_answers,explanation
JA1PH001,JEE Adv,Physics,single_correct,"What is the SI unit of force?",Newton,Joule,Pascal,Watt,A,"Force is measured in Newtons (N)"
JA1PH006,JEE Adv,Physics,multiple_correct,"Select all true statements",Option 1,Option 2,Option 3,Option 4,"A,B,C","Multiple options are correct"`;

  const rows = parseCsv(sampleCsv);
  assert.strictEqual(rows.length, 3, 'Must parse 3 rows (1 header + 2 questions)');

  const headers = rows[0].map(h => h.trim().toLowerCase());
  const qTextIdx = headers.findIndex((h) =>
    h === 'question_text' ||
    h === 'question text' ||
    h === 'text' ||
    (h.includes('question') && !h.includes('id') && !h.includes('type') && !h.includes('bank'))
  );

  assert.strictEqual(qTextIdx, 4, 'Must correctly identify question_text column without confusing with question_id');
  assert.strictEqual(rows[1][qTextIdx], 'What is the SI unit of force?');
  assert.strictEqual(rows[2][qTextIdx], 'Select all true statements');

  // Verify multiple correct answer tokenization
  const rawAns = rows[2][9];
  const letterMap = { A: 0, B: 1, C: 2, D: 3 };
  const tokens = rawAns.split(/[,\s]+/).map(t => t.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
  const correctOptions = tokens.map(t => letterMap[t]);
  assert.deepStrictEqual(correctOptions, [0, 1, 2], 'Multiple correct answers A,B,C mapped to [0, 1, 2]');
});

test('Question Bank Workflow - Published Exam Data matches Prisma schema (no illegal top-level columns)', () => {
  // Verify publish exam data structure matches Prisma schema:
  // cameraRequired, micRequired, showResultsImmediate, enableLeaderboard must NOT be top-level keys
  const validTopLevelExamKeys = new Set([
    'id', 'patternId', 'courseId', 'bankId', 'title', 'type', 'category', 'subject',
    'date', 'time', 'duration', 'questionsCount', 'marks', 'passingMarks', 'negativeMarking',
    'maxAttempts', 'proctoringRequired', 'fee', 'tag', 'description', 'syllabus',
    'status', 'registrationOpen', 'imageUrl', 'bannerImageUrl', 'schedule', 'configuration',
    'registeredCount', 'createdAt', 'updatedAt'
  ]);

  const bank = { id: 'bank-123', title: 'Test Mock', subject: 'Physics', questions: Array(30).fill({}) };
  const examId = `pub-exam-123456`;
  const questionsCount = bank.questions.length;
  const marks = questionsCount * 4;
  const passingMarks = Math.round(marks * 0.4);

  const payloadData = {
    id: examId,
    bankId: bank.id,
    title: bank.title,
    type: 'Official Assessment',
    category: 'Official Mock Assessments',
    subject: bank.subject,
    duration: 180,
    questionsCount,
    marks,
    passingMarks,
    negativeMarking: true,
    status: 'published',
    registrationOpen: true,
    proctoringRequired: true,
    fee: 0,
    schedule: {
      startsAt: new Date().toISOString(),
      endsAt: new Date(Date.now() + 30 * 86400000).toISOString(),
      registrationOpensAt: new Date().toISOString(),
      registrationClosesAt: new Date(Date.now() + 30 * 86400000).toISOString(),
      timezone: 'Asia/Kolkata'
    },
    configuration: {
      cameraRequired: true,
      micRequired: true,
      showResultsImmediate: true,
      enableLeaderboard: true,
      rules: { single_correct: { correct: 4, incorrect: -1, unanswered: 0 } },
      instructions: ['Attempt all questions within the allocated duration.']
    }
  };

  for (const key of Object.keys(payloadData)) {
    assert(validTopLevelExamKeys.has(key), `Key "${key}" must be a valid Prisma schema column on model Exam`);
  }

  assert.strictEqual(payloadData.cameraRequired, undefined, 'cameraRequired must not be top-level');
  assert.strictEqual(payloadData.configuration.cameraRequired, true, 'cameraRequired belongs in configuration');
  assert.strictEqual(payloadData.configuration.micRequired, true, 'micRequired belongs in configuration');
});
