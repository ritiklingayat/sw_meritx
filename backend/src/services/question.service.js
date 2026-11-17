import { prisma } from '../config/prisma.js';
import { NotFoundError } from '../utils/errors.js';

export class QuestionService {
  /**
   * Return questions for exam. When isStudentExamSession is true, strip answer keys and explanations!
   */
  static async getQuestionsForExam(exam, isStudentExamSession = false) {
    if (!exam) {
      return prisma.question.findMany({
        take: 30,
        orderBy: { position: 'asc' }
      });
    }

    let questions = [];

    // 1. If exam has questions linked to a bank
    if (exam.bankId) {
      questions = await prisma.question.findMany({
        where: { bankId: exam.bankId },
        orderBy: { position: 'asc' }
      });
    }

    // 2. If no bank questions, filter questions based on exam subject/type
    if (!questions.length) {
      const examType = String(exam.type || '').toUpperCase();
      let where = {};

      if (examType.startsWith('NEET')) {
        where = { subject: { not: 'Mathematics' } };
      } else if (examType.includes('JEE') || examType.includes('ENGINEERING')) {
        where = { subject: { not: 'Biology' } };
      }

      questions = await prisma.question.findMany({
        where,
        orderBy: { position: 'asc' }
      });
    }

    if (isStudentExamSession) {
      return questions.map(({ answer, correctOption, correctOptions, numericalAnswer, explanation, ...safeQ }) => safeQ);
    }

    return questions;
  }

  static async getQuestions({ subject = '', chapter = '', difficulty = '', search = '' } = {}) {
    const where = {};
    if (subject) where.subject = { equals: subject, mode: 'insensitive' };
    if (chapter) where.chapter = { contains: chapter, mode: 'insensitive' };
    if (difficulty) where.difficulty = { equals: difficulty, mode: 'insensitive' };
    if (search) {
      where.OR = [
        { text: { contains: search, mode: 'insensitive' } },
        { chapter: { contains: search, mode: 'insensitive' } }
      ];
    }

    return prisma.question.findMany({
      where,
      orderBy: { position: 'asc' }
    });
  }

  static async getQuestionById(id) {
    const q = await prisma.question.findUnique({
      where: { id }
    });
    if (!q) throw new NotFoundError('Question not found.');
    return q;
  }

  static async createQuestion(data) {
    return prisma.question.create({
      data: {
        bankId: data.bankId || null,
        externalId: data.externalId || null,
        position: Number(data.position || 0),
        subject: data.subject || 'General',
        chapter: data.chapter || null,
        topic: data.topic || null,
        difficulty: data.difficulty || 'Medium',
        questionType: data.questionType || 'single_correct',
        text: data.text,
        options: data.options || ['Option A', 'Option B', 'Option C', 'Option D'],
        answer: data.answer !== undefined ? Number(data.answer) : 0,
        correctOption: data.correctOption !== undefined ? Number(data.correctOption) : Number(data.answer || 0),
        correctOptions: data.correctOptions || [Number(data.answer || 0)],
        numericalAnswer: data.numericalAnswer !== undefined ? Number(data.numericalAnswer) : null,
        explanation: data.explanation || null,
        imageUrl: data.imageUrl || null
      }
    });
  }

  static async updateQuestion(id, updates) {
    return prisma.question.update({
      where: { id },
      data: updates
    });
  }

  static async deleteQuestion(id) {
    await prisma.question.delete({ where: { id } });
    return { success: true };
  }
}
