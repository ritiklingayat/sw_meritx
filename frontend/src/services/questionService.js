import { storageService, STORAGE_KEYS } from './storageService';

class QuestionService {
  async getQuestions({ subject = '', chapter = '', difficulty = '', search = '' } = {}) {
    let list = storageService.getCollection(STORAGE_KEYS.QUESTIONS);

    if (subject) {
      list = list.filter((q) => q.subject?.toLowerCase() === subject.toLowerCase());
    }

    if (chapter) {
      list = list.filter((q) => q.chapter?.toLowerCase().includes(chapter.toLowerCase()));
    }

    if (difficulty) {
      list = list.filter((q) => q.difficulty?.toLowerCase() === difficulty.toLowerCase());
    }

    if (search) {
      const s = search.toLowerCase();
      list = list.filter((q) =>
        q.text?.toLowerCase().includes(s) ||
        q.chapter?.toLowerCase().includes(s) ||
        (q.options && q.options.some((opt) => opt.toLowerCase().includes(s)))
      );
    }

    return list;
  }

  async getQuestionById(id) {
    const list = storageService.getCollection(STORAGE_KEYS.QUESTIONS);
    return list.find((q) => Number(q.id) === Number(id)) || null;
  }

  async getQuestionsForExam(exam) {
    const all = storageService.getCollection(STORAGE_KEYS.QUESTIONS);
    if (!exam) return all;

    const examType = String(exam.type || '').toUpperCase();
    if (examType.startsWith('NEET')) {
      return all.filter((q) => q.subject !== 'Mathematics');
    } else if (examType.includes('JEE') || examType.includes('ENGINEERING')) {
      return all.filter((q) => q.subject !== 'Biology');
    }
    return all;
  }

  async createQuestion(questionData) {
    const list = storageService.getCollection(STORAGE_KEYS.QUESTIONS);
    const maxId = list.reduce((max, q) => Math.max(max, Number(q.id) || 0), 0);
    
    const newQuestion = storageService.insert(STORAGE_KEYS.QUESTIONS, {
      ...questionData,
      id: maxId + 1,
      options: questionData.options || ['Option A', 'Option B', 'Option C', 'Option D'],
      answer: questionData.answer !== undefined ? Number(questionData.answer) : 0,
      correctOption: questionData.correctOption !== undefined ? Number(questionData.correctOption) : Number(questionData.answer || 0),
      correctOptions: questionData.correctOptions || [Number(questionData.answer || 0)],
      difficulty: questionData.difficulty || 'Medium',
      questionType: questionData.questionType || 'single_correct'
    });

    return newQuestion;
  }

  async updateQuestion(id, updates) {
    return storageService.update(STORAGE_KEYS.QUESTIONS, id, updates);
  }

  async deleteQuestion(id) {
    return storageService.delete(STORAGE_KEYS.QUESTIONS, id);
  }
}

export const questionService = new QuestionService();
