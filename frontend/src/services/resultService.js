import { storageService, STORAGE_KEYS } from './storageService';

class ResultService {
  evaluateAttempt(questionList, submittedAnswers = {}, examConfig = {}) {
    if (!questionList || !questionList.length) {
      return {
        score: 0,
        maximumMarks: 0,
        attempted: 0,
        correct: 0,
        incorrect: 0,
        unattempted: 0,
        unanswered: 0,
        accuracy: 0,
        details: []
      };
    }

    let correct = 0;
    let incorrect = 0;
    let unattempted = 0;
    let score = 0;
    const details = [];

    const marking = examConfig?.rules?.single_correct || {
      correct: 4,
      incorrect: -1,
      unanswered: 0
    };
    const posMark = Number(marking.correct ?? 4);
    const negMark = Math.abs(Number(marking.incorrect ?? -1));

    questionList.forEach((item) => {
      const ans = submittedAnswers[item.id];
      const isAnswered = ans !== undefined && ans !== null && ans !== '';
      let isCorrect = false;

      if (isAnswered) {
        if (item.questionType === 'multiple_correct') {
          const correctSet = new Set(
            Array.isArray(item.correctOptions)
              ? item.correctOptions
              : (item.correctOption !== undefined ? [item.correctOption] : [item.answer])
          );
          const userSet = new Set(Array.isArray(ans) ? ans : [ans]);
          isCorrect =
            correctSet.size === userSet.size &&
            [...correctSet].every((val) => userSet.has(val));
        } else if (item.questionType === 'numerical') {
          const userNum = parseFloat(ans);
          const correctNum = parseFloat(item.numericalAnswer ?? item.answer);
          isCorrect = !isNaN(userNum) && !isNaN(correctNum) && Math.abs(userNum - correctNum) < 0.01;
        } else {
          const userVal = Number.isInteger(ans) ? ans : Number(ans);
          const correctVal = Number.isInteger(item.answer)
            ? item.answer
            : Number(item.correctOption);
          isCorrect = userVal === correctVal;
        }

        if (isCorrect) {
          correct++;
          score += posMark;
        } else {
          incorrect++;
          score -= negMark;
        }
      } else {
        unattempted++;
      }

      const correctOptIndex = item.answer ?? item.correctOption ?? 0;
      const correctText = item.options?.[correctOptIndex] || String(item.numericalAnswer ?? correctOptIndex);
      const userText = isAnswered
        ? (item.options?.[ans] || String(ans))
        : 'Not Attempted';

      details.push({
        id: item.id,
        attempted: isAnswered,
        selectedValue: isAnswered
          ? (Number.isInteger(ans) ? String.fromCharCode(65 + ans) : String(ans))
          : null,
        correctValue: Number.isInteger(correctOptIndex)
          ? String.fromCharCode(65 + correctOptIndex)
          : String(correctOptIndex),
        selectedText: userText,
        correctText,
        selectedOptions: Array.isArray(ans) ? ans : (isAnswered ? [ans] : []),
        correctOptions: Array.isArray(item.correctOptions)
          ? item.correctOptions
          : [correctOptIndex],
        isCorrect,
        explanation: item.explanation || 'Answer verified according to standard official academic key.'
      });
    });

    const attemptedCount = correct + incorrect;
    const maximumMarks = questionList.length * posMark;
    const accuracy = attemptedCount > 0 ? Math.round((correct / attemptedCount) * 100) : 0;
    const percentage = maximumMarks > 0 ? Math.round((score / maximumMarks) * 100) : 0;

    return {
      score,
      maximumMarks,
      percentage,
      attempted: attemptedCount,
      correct,
      incorrect,
      unattempted,
      unanswered: unattempted,
      accuracy,
      details
    };
  }

  async getAttemptsByStudent(studentId) {
    const attempts = storageService.getCollection(STORAGE_KEYS.ATTEMPTS);
    return attempts.filter((a) => a.studentId === studentId);
  }

  async getAttemptById(attemptId) {
    return storageService.findById(STORAGE_KEYS.ATTEMPTS, attemptId);
  }

  async getExamResults(examId) {
    const attempts = storageService.getCollection(STORAGE_KEYS.ATTEMPTS);
    return attempts.filter((a) => a.examId === examId);
  }
}

export const resultService = new ResultService();
