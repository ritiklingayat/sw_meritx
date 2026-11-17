import assert from 'assert';
import {
  formatDateTime,
  formatDate,
  formatTime,
  formatExamWindow,
  formatCountdown,
  toDateTimeLocal,
  fromDateTimeLocal,
  extractExamSchedule,
  getExamScheduleInfo,
  validateExamSchedule,
  calculateAttemptDeadline
} from '../services/schedulingService.js';

console.log('=====================================================');
console.log('🧪 RUNNING SCHEDULING SYSTEM VERIFICATION TESTS');
console.log('=====================================================');

// -----------------------------------------------------------------
// TEST 1: Schedule Formatting & Date Parsing
// -----------------------------------------------------------------
console.log('\n[TEST 1] Testing Date, Time & Window Formatting...');

const sampleIso = '2026-11-15T10:00:00+05:30';
const sampleEndIso = '2026-11-15T12:00:00+05:30';

const formattedDate = formatDate(sampleIso);
assert(formattedDate.includes('15') && (formattedDate.includes('Nov') || formattedDate.includes('11')), 'formatDate should format correctly');

const windowStr = formatExamWindow(sampleIso, sampleEndIso);
assert(windowStr.includes('–') || windowStr.includes('-'), 'formatExamWindow should format range');

const localDt = toDateTimeLocal(sampleIso);
assert(localDt.startsWith('2026-11-15'), 'toDateTimeLocal should output YYYY-MM-DDTHH:mm');

const countdownStr = formatCountdown(15 * 60 * 1000); // 15 mins
assert(countdownStr.includes('15m'), `formatCountdown should format 15m (got ${countdownStr})`);

console.log('✅ TEST 1 PASSED: Formatting and date utilities function correctly.');

// -----------------------------------------------------------------
// TEST 2: Schedule Validation Rules (Admin form checks)
// -----------------------------------------------------------------
console.log('\n[TEST 2] Testing Admin Schedule Validation...');

// 2a. End time before start time
const invalidEndForm = {
  title: 'Java Mock',
  duration: 60,
  fee: 100,
  marks: 100,
  passingMarks: 40,
  questions: 30,
  schedule: {
    startsAt: '2026-11-15T12:00:00',
    endsAt: '2026-11-15T10:00:00', // invalid!
    registrationOpensAt: '2026-11-01T10:00:00',
    registrationClosesAt: '2026-11-14T18:00:00'
  }
};
const resInvalidEnd = validateExamSchedule(invalidEndForm);
assert(!resInvalidEnd.valid, 'Validation should fail when End Time is before Start Time');
assert(resInvalidEnd.errors.some(e => e.includes('strictly after')), 'Should alert about End Time');

// 2b. Duration exceeds total examination window
const invalidDurationForm = {
  title: 'Java Mock',
  duration: 180, // 3 hours
  fee: 100,
  marks: 100,
  passingMarks: 40,
  questions: 30,
  schedule: {
    startsAt: '2026-11-15T10:00:00',
    endsAt: '2026-11-15T12:00:00', // only 2 hours window!
    registrationOpensAt: '2026-11-01T10:00:00',
    registrationClosesAt: '2026-11-14T18:00:00'
  }
};
const resInvalidDuration = validateExamSchedule(invalidDurationForm);
assert(!resInvalidDuration.valid, 'Validation should fail when duration exceeds total window');
assert(resInvalidDuration.errors.some(e => e.includes('cannot exceed the total Examination Window')), 'Should alert duration exceeding window');

// 2c. Registration closing after exam start
const invalidRegCloseForm = {
  title: 'Java Mock',
  duration: 60,
  fee: 100,
  marks: 100,
  passingMarks: 40,
  questions: 30,
  schedule: {
    startsAt: '2026-11-15T10:00:00',
    endsAt: '2026-11-15T12:00:00',
    registrationOpensAt: '2026-11-01T10:00:00',
    registrationClosesAt: '2026-11-15T11:00:00' // after exam starts!
  }
};
const resInvalidReg = validateExamSchedule(invalidRegCloseForm);
assert(!resInvalidReg.valid, 'Validation should fail when registration closes after exam starts');
assert(resInvalidReg.errors.some(e => e.includes('on or before the Examination starts')), 'Should alert about registration closing late');

// 2d. Valid Form
const validForm = {
  title: 'Java Programming Assessment',
  duration: 60,
  fee: 299,
  marks: 100,
  passingMarks: 40,
  questions: 30,
  schedule: {
    startsAt: '2026-11-15T10:00:00',
    endsAt: '2026-11-15T12:00:00',
    registrationOpensAt: '2026-11-05T10:00:00',
    registrationClosesAt: '2026-11-14T18:00:00'
  }
};
const resValid = validateExamSchedule(validForm);
assert(resValid.valid, `Valid form should pass validation: ${resValid.errors.join(', ')}`);

console.log('✅ TEST 2 PASSED: All scheduling validation rules strictly enforced.');

// -----------------------------------------------------------------
// TEST 3: Dynamic Status Calculations (Live, Starting Soon, Scheduled, Ended)
// -----------------------------------------------------------------
console.log('\n[TEST 3] Testing Dynamic Exam Status Calculations...');

const testExam = {
  id: 'test-exam-01',
  title: 'Dynamic Test',
  duration: 60,
  schedule: {
    startsAt: '2026-11-15T10:00:00+05:30',
    endsAt: '2026-11-15T12:00:00+05:30',
    registrationOpensAt: '2026-11-05T10:00:00+05:30',
    registrationClosesAt: '2026-11-14T18:00:00+05:30'
  }
};

// 3a. Before registration opens (e.g. 01 Nov 2026)
const tBeforeReg = new Date('2026-11-01T10:00:00+05:30');
const statusBeforeReg = getExamScheduleInfo(testExam, tBeforeReg);
assert.strictEqual(statusBeforeReg.registrationStatus, 'Upcoming Registration');
assert.strictEqual(statusBeforeReg.isRegistrationOpen, false);
assert.strictEqual(statusBeforeReg.examStatus, 'Scheduled');

// 3b. During registration window (e.g. 10 Nov 2026)
const tDuringReg = new Date('2026-11-10T10:00:00+05:30');
const statusDuringReg = getExamScheduleInfo(testExam, tDuringReg);
assert.strictEqual(statusDuringReg.registrationStatus, 'Registration Open');
assert.strictEqual(statusDuringReg.isRegistrationOpen, true);
assert.strictEqual(statusDuringReg.examStatus, 'Scheduled');

// 3c. After registration closes, before exam starts (e.g. 15 Nov 09:00 AM)
const tRegClosed = new Date('2026-11-15T09:00:00+05:30');
const statusRegClosed = getExamScheduleInfo(testExam, tRegClosed);
assert.strictEqual(statusRegClosed.registrationStatus, 'Registration Closed');
assert.strictEqual(statusRegClosed.isRegistrationOpen, false);
assert.strictEqual(statusRegClosed.examStatus, 'Scheduled');

// 3d. Starting soon (< 30 mins, e.g. 15 Nov 09:45 AM)
const tStartingSoon = new Date('2026-11-15T09:45:00+05:30');
const statusStartingSoon = getExamScheduleInfo(testExam, tStartingSoon);
assert.strictEqual(statusStartingSoon.examStatus, 'Starting Soon');
assert.strictEqual(statusStartingSoon.isStartingSoon, true);
assert(statusStartingSoon.countdownMs > 0 && statusStartingSoon.countdownMs <= 15 * 60 * 1000, 'Countdown should be <= 15 mins');

// 3e. Live window (e.g. 15 Nov 10:30 AM)
const tLive = new Date('2026-11-15T10:30:00+05:30');
const statusLive = getExamScheduleInfo(testExam, tLive);
assert.strictEqual(statusLive.examStatus, 'Live');
assert.strictEqual(statusLive.isLive, true);
assert.strictEqual(statusLive.canStartExam, true);

// 3f. Examination window passed (e.g. 15 Nov 12:30 PM)
const tEnded = new Date('2026-11-15T12:30:00+05:30');
const statusEnded = getExamScheduleInfo(testExam, tEnded);
assert.strictEqual(statusEnded.examStatus, 'Completed');
assert.strictEqual(statusEnded.isCompleted, true);
assert.strictEqual(statusEnded.canStartExam, false);

console.log('✅ TEST 3 PASSED: Dynamic statuses accurately transition across all time points.');

// -----------------------------------------------------------------
// TEST 4: Attempt Timing & Truncation by Availability Window
// -----------------------------------------------------------------
console.log('\n[TEST 4] Testing Attempt Deadline & Window Truncation...');

// Exam window: 10:00 AM to 12:00 PM (120 mins). Candidate duration: 60 mins.

// Case A: Student starts at 10:30 AM.
// 10:30 AM + 60 mins = 11:30 AM (before 12:00 PM). Candidate gets full 60 mins (3600 secs).
const startA = new Date('2026-11-15T10:30:00+05:30');
const deadlineA = calculateAttemptDeadline({ exam: testExam, attemptStartTime: startA });
assert.strictEqual(deadlineA.durationSeconds, 3600);
assert.strictEqual(deadlineA.isTruncatedByWindow, false);

// Case B: Student starts late at 11:30 AM.
// 11:30 AM + 60 mins = 12:30 PM, BUT exam ends at 12:00 PM!
// Candidate gets only 30 mins (1800 secs).
const startB = new Date('2026-11-15T11:30:00+05:30');
const deadlineB = calculateAttemptDeadline({ exam: testExam, attemptStartTime: startB });
assert.strictEqual(deadlineB.durationSeconds, 1800);
assert.strictEqual(deadlineB.isTruncatedByWindow, true);
assert.strictEqual(deadlineB.deadlineAt, new Date('2026-11-15T12:00:00+05:30').toISOString());

console.log('✅ TEST 4 PASSED: Attempt deadline correctly truncates at exam window closing time.');

// -----------------------------------------------------------------
// TEST 5: Auto End Time Calculation & Midnight Crossover
// -----------------------------------------------------------------
console.log('\n[TEST 5] Testing Auto End Time Calculation & Midnight Crossover...');

import {
  calculateEndTime,
  formatDurationHuman,
  DURATION_PRESETS,
  extractExamEditFields
} from '../services/schedulingService.js';

// 5a. Normal day calculation: 15 Nov 2026, 10:00 AM + 2 Hours (120 mins) = 12:00 PM
const resNormal = calculateEndTime({
  examDate: '2026-11-15',
  startTime: '10:00',
  durationMinutes: 120
});
assert(resNormal.isValid, 'Should be valid');
assert(resNormal.formattedStartTime.includes('10:00'), `Start time should be 10:00 AM (got ${resNormal.formattedStartTime})`);
assert(resNormal.formattedEndTime.includes('12:00'), `End time should be 12:00 PM (got ${resNormal.formattedEndTime})`);
assert.strictEqual(resNormal.isNextDay, false, 'Should not be next day');
assert.strictEqual(resNormal.formattedDuration, '2 Hours');

// 5b. Midnight crossover: 15 Nov 2026, 23:30 (11:30 PM) + 2 Hours (120 mins) = 01:30 AM Next Day
const resMidnight = calculateEndTime({
  examDate: '2026-11-15',
  startTime: '23:30',
  durationMinutes: 120
});
assert(resMidnight.isValid, 'Should be valid for midnight crossover');
assert(resMidnight.isNextDay, 'Should detect next day crossover');
assert(resMidnight.formattedEndTime.includes('01:30') || resMidnight.formattedEndTime.includes('1:30'), 'Should end at 01:30 AM');
assert(resMidnight.formattedEndTime.includes('Next Day'), 'Should mention Next Day');

// 5c. Duration human formatting
assert.strictEqual(formatDurationHuman(15), '15 Minutes');
assert.strictEqual(formatDurationHuman(60), '1 Hour');
assert.strictEqual(formatDurationHuman(90), '1 Hour 30 Minutes');
assert.strictEqual(formatDurationHuman(120), '2 Hours');
assert.strictEqual(formatDurationHuman(180), '3 Hours');

console.log('✅ TEST 5 PASSED: Auto End Time calculation & midnight crossover verified.');

// -----------------------------------------------------------------
// TEST 6: Form Field Extraction & Custom Duration on Exam Edit
// -----------------------------------------------------------------
console.log('\n[TEST 6] Testing Form Field Extraction & Custom Duration for Admin Edit...');

const existingExam = {
  id: 'jee-main-mock',
  title: 'JEE Main Full Test',
  date: '2026-11-20',
  duration: 150, // 2h 30m (Custom)
  schedule: {
    startsAt: '2026-11-20T09:30:00+05:30',
    endsAt: '2026-11-20T12:00:00+05:30',
    registrationOpensAt: '2026-11-10T10:00:00+05:30',
    registrationClosesAt: '2026-11-20T09:00:00+05:30'
  }
};

const editFields = extractExamEditFields(existingExam);
assert.strictEqual(editFields.examDate, '2026-11-20', 'Extracted examDate should match');
assert.strictEqual(editFields.startTime, '09:30', 'Extracted startTime should match');
assert.strictEqual(editFields.duration, 150, 'Duration should be 150 mins');
assert.strictEqual(editFields.durationPreset, 'custom', '150 mins should fall back to custom preset');
assert.strictEqual(editFields.customHours, 2, 'Custom hours should be 2');
assert.strictEqual(editFields.customMinutes, 30, 'Custom minutes should be 30');
assert(editFields.calculatedEnd.isValid, 'Calculated end should be valid');
assert(editFields.calculatedEnd.formattedEndTime.includes('12:00'), 'End time should be 12:00 PM');

console.log('✅ TEST 6 PASSED: Existing exam edit fields & custom duration correctly extracted.');

console.log('\n=====================================================');
console.log('🎉 ALL 6 MASTER SCHEDULING TESTS PASSED PERFECTLY!');
console.log('=====================================================\n');
