export class ScoringService {
  /**
   * Evaluate student submission against immutable question snapshot and pattern rules
   */
  static evaluateAttempt(questionList = [], submittedAnswers = {}, examConfig = {}) {
    if (!questionList || !questionList.length) {
      return {
        score: 0,
        maximumMarks: 0,
        percentage: 0,
        attempted: 0,
        correct: 0,
        incorrect: 0,
        unattempted: 0,
        unanswered: 0,
        accuracy: 0,
        details: [],
        subjectBreakdown: {}
      };
    }

    let totalScore = 0;
    let maximumMarks = 0;
    let correctCount = 0;
    let incorrectCount = 0;
    let unattemptedCount = 0;
    const details = [];
    const subjectMap = {};

    const rules = examConfig?.rules || {};
    const defaultSingleRule = rules.single_correct || { correct: 4, incorrect: -1, unanswered: 0 };
    const defaultMultiRule = rules.multiple_correct || { correct: 4, incorrect: -1, unanswered: 0, partial: true };
    const defaultNumRule = rules.numerical || { correct: 4, incorrect: -1, unanswered: 0 };

    // MHT-CET or custom subject-specific overrides
    const subjectOverrides = rules.subjectOverrides || {};

    questionList.forEach((item) => {
      const subj = item.subject || 'General';
      if (!subjectMap[subj]) {
        subjectMap[subj] = { total: 0, attempted: 0, correct: 0, incorrect: 0, score: 0, maxMarks: 0 };
      }
      subjectMap[subj].total += 1;

      // Determine points for question
      let posMark = Number(defaultSingleRule.correct ?? 4);
      let negMark = Math.abs(Number(defaultSingleRule.incorrect ?? -1));

      if (subjectOverrides[subj]) {
        if (subjectOverrides[subj].correct !== undefined) posMark = Number(subjectOverrides[subj].correct);
        if (subjectOverrides[subj].incorrect !== undefined) negMark = Math.abs(Number(subjectOverrides[subj].incorrect));
      } else if (item.questionType === 'multiple_correct') {
        posMark = Number(defaultMultiRule.correct ?? 4);
        negMark = Math.abs(Number(defaultMultiRule.incorrect ?? -1));
      } else if (item.questionType === 'numerical') {
        posMark = Number(defaultNumRule.correct ?? 4);
        negMark = Math.abs(Number(defaultNumRule.incorrect ?? 0));
      }

      maximumMarks += posMark;
      subjectMap[subj].maxMarks += posMark;

      const userAns = submittedAnswers[item.id];
      const isAnswered = userAns !== undefined && userAns !== null && userAns !== '';
      let isCorrect = false;
      let questionScore = 0;
      let isPartial = false;

      if (isAnswered) {
        subjectMap[subj].attempted += 1;

        if (item.questionType === 'multiple_correct') {
          // Normalize correct set
          const rawCorrect = Array.isArray(item.correctOptions)
            ? item.correctOptions
            : (item.correctOption !== undefined ? [item.correctOption] : [item.answer ?? 0]);
          const correctSet = new Set(rawCorrect.map(Number));
          const userSet = new Set((Array.isArray(userAns) ? userAns : [userAns]).map(Number));

          const hasIncorrectSelection = [...userSet].some((ans) => !correctSet.has(ans));

          if (!hasIncorrectSelection) {
            if (userSet.size === correctSet.size) {
              // Complete correct set selected
              isCorrect = true;
              questionScore = posMark;
            } else if (userSet.size > 0 && defaultMultiRule.partial) {
              // JEE Advanced subset partial marking
              isPartial = true;
              isCorrect = true;
              questionScore = Math.min(userSet.size, posMark - 1);
            }
          } else {
            // Selected one or more wrong options
            isCorrect = false;
            questionScore = -negMark;
          }
        } else if (item.questionType === 'numerical') {
          const userNum = parseFloat(userAns);
          const correctNum = parseFloat(item.numericalAnswer ?? item.answer);
          const tolerance = item.numericalTolerance ?? 0.01;

          if (!isNaN(userNum) && !isNaN(correctNum) && Math.abs(userNum - correctNum) <= tolerance) {
            isCorrect = true;
            questionScore = posMark;
          } else {
            isCorrect = false;
            questionScore = -negMark;
          }
        } else {
          // single_correct
          const userVal = Number.isInteger(userAns) ? userAns : Number(userAns);
          const correctVal = Number.isInteger(item.answer)
            ? item.answer
            : Number(item.correctOption ?? 0);

          if (userVal === correctVal) {
            isCorrect = true;
            questionScore = posMark;
          } else {
            isCorrect = false;
            questionScore = -negMark;
          }
        }

        if (isCorrect) {
          correctCount += 1;
          subjectMap[subj].correct += 1;
        } else {
          incorrectCount += 1;
          subjectMap[subj].incorrect += 1;
        }

        totalScore += questionScore;
        subjectMap[subj].score += questionScore;
      } else {
        unattemptedCount += 1;
      }

      const correctOptIndex = item.answer ?? item.correctOption ?? 0;
      const correctText = item.options?.[correctOptIndex] || String(item.numericalAnswer ?? correctOptIndex);
      const userText = isAnswered
        ? (item.options?.[userAns] || String(userAns))
        : 'Not Attempted';

      details.push({
        id: item.id,
        attempted: isAnswered,
        selectedValue: isAnswered
          ? (Number.isInteger(userAns) ? String.fromCharCode(65 + userAns) : String(userAns))
          : null,
        correctValue: Number.isInteger(correctOptIndex)
          ? String.fromCharCode(65 + correctOptIndex)
          : String(correctOptIndex),
        selectedText: userText,
        correctText,
        selectedOptions: Array.isArray(userAns) ? userAns : (isAnswered ? [userAns] : []),
        correctOptions: Array.isArray(item.correctOptions)
          ? item.correctOptions
          : [correctOptIndex],
        isCorrect,
        isPartial,
        scoreObtained: questionScore,
        explanation: item.explanation || 'Answer verified according to standard official academic key.'
      });
    });

    const attemptedCount = correctCount + incorrectCount;
    const accuracy = attemptedCount > 0 ? Math.round((correctCount / attemptedCount) * 100) : 0;
    const percentage = maximumMarks > 0 ? Math.max(0, Math.round((totalScore / maximumMarks) * 100)) : 0;

    // Calculate subject-wise accuracy
    Object.keys(subjectMap).forEach((subj) => {
      const s = subjectMap[subj];
      s.accuracy = s.attempted > 0 ? Math.round((s.correct / s.attempted) * 100) : 0;
    });

    return {
      score: totalScore,
      maximumMarks,
      percentage,
      attempted: attemptedCount,
      correct: correctCount,
      incorrect: incorrectCount,
      unattempted: unattemptedCount,
      unanswered: unattemptedCount,
      accuracy,
      details,
      subjectBreakdown: subjectMap
    };
  }
}
