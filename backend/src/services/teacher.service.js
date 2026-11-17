import { prisma } from '../config/prisma.js';
import { NotFoundError } from '../utils/errors.js';

export class TeacherService {
  static async getDashboard(teacherId) {
    const user = await prisma.user.findUnique({
      where: { id: teacherId },
      include: { profile: true }
    });

    const courses = await prisma.course.findMany({
      where: { teacherId },
      include: {
        enrollments: {
          include: { student: true }
        }
      }
    });

    const banks = await prisma.questionBank.findMany({
      where: { createdById: teacherId },
      include: { questions: true }
    });

    const totalStudents = courses.reduce((sum, c) => sum + (c.enrolledStudentCount || c.enrollments.length || 0), 0);

    const assignedCourses = courses.map((c) => ({
      id: c.id,
      name: c.name,
      category: c.category,
      examType: c.examType,
      shortDescription: c.shortDescription,
      enrolledStudentCount: c.enrolledStudentCount || c.enrollments.length,
      publishedExamCount: c.publishedExamCount,
      durationDays: c.durationDays,
      status: c.status,
      enrolledStudents: c.enrollments.map((en) => ({
        studentId: en.studentId,
        name: en.student.name,
        email: en.student.email,
        enrolledAt: en.enrolledAt
      }))
    }));

    return {
      teacher: { name: user?.name || 'Dr. Meera Joshi' },
      assignedCourses,
      totalStudents,
      stats: {
        totalPapers: 6,
        totalQuestionBanks: banks.length || 4,
        publishedMocks: 3,
        studentsEvaluated: 1240
      },
      papers: [
        { id: 'p-1', title: 'Grand Mock Physics 2026', subject: 'Physics', questions: 25, status: 'approved', date: '2026-10-20' },
        { id: 'p-2', title: 'Inorganic Chemistry Sprint', subject: 'Chemistry', questions: 25, status: 'approved', date: '2026-10-22' }
      ],
      banks: banks.map((b) => ({
        id: b.id,
        title: b.title,
        subject: b.subject,
        questionCount: b.questions.length,
        status: b.status,
        date: b.createdAt.toISOString().split('T')[0]
      }))
    };
  }

  static async getProfile(teacherId) {
    const user = await prisma.user.findUnique({
      where: { id: teacherId },
      include: { profile: true }
    });
    if (!user) throw new NotFoundError('Teacher not found.');

    const defaultProfile = {
      designation: user.profile?.designation || user.target || 'Senior Physics Faculty & Assessment Lead',
      department: user.profile?.department || 'Physical & Engineering Sciences',
      specialization: user.profile?.specialization || 'Mechanics, Electromagnetism & Modern Physics',
      experienceYears: user.profile?.experienceYears || 12,
      phone: user.phone || '+91 97654 32109',
      bio: user.profile?.bio || 'Senior academic author and faculty member focusing on conceptual mastery and high-yield problem solving for JEE Advanced and NEET UG aspirants.'
    };

    const { passwordHash: _, ...safeUser } = user;
    return { user: safeUser, profile: defaultProfile };
  }

  static async updateProfile(teacherId, updates) {
    const { name, phone, designation, department, specialization, experienceYears, bio } = updates;

    const user = await prisma.user.update({
      where: { id: teacherId },
      data: {
        ...(name && { name }),
        ...(phone && { phone }),
        profile: {
          upsert: {
            create: { designation, department, specialization, experienceYears, bio, phone },
            update: { designation, department, specialization, experienceYears, bio, phone }
          }
        }
      },
      include: { profile: true }
    });

    const { passwordHash: _, ...safeUser } = user;
    return { user: safeUser, profile: user.profile };
  }

  static async getQuestionBanks(teacherId) {
    const banks = await prisma.questionBank.findMany({
      where: { createdById: teacherId },
      include: { questions: true }
    });

    return {
      banks: banks.map((b) => ({
        id: b.id,
        title: b.title,
        subject: b.subject,
        questionCount: b.questions.length,
        status: b.status,
        date: b.createdAt.toISOString().split('T')[0]
      }))
    };
  }

  static async getQuestionBankById(id) {
    const bank = await prisma.questionBank.findUnique({
      where: { id },
      include: { questions: true }
    });
    if (!bank) throw new NotFoundError('Question bank not found.');

    return {
      bank: {
        ...bank,
        questionCount: bank.questions.length
      },
      questions: bank.questions
    };
  }

  static async importQuestionBank(teacherId, data) {
    const questions = data.questions || [];
    const bank = await prisma.questionBank.create({
      data: {
        title: data.title || 'Imported Question Bank',
        subject: data.subject || 'Physics',
        status: 'draft',
        createdById: teacherId,
        sourceFilename: data.filename || 'import.csv',
        sourceType: 'csv'
      }
    });

    // Create questions
    for (const [idx, q] of questions.entries()) {
      await prisma.question.create({
        data: {
          bankId: bank.id,
          position: idx + 1,
          subject: q.subject || data.subject || 'General',
          chapter: q.chapter || null,
          difficulty: q.difficulty || 'Medium',
          questionType: q.questionType || 'single_correct',
          text: q.text,
          options: q.options || [],
          answer: q.answer ?? q.correctOption ?? 0,
          correctOption: q.correctOption ?? q.answer ?? 0,
          correctOptions: q.correctOptions || [q.answer ?? q.correctOption ?? 0],
          numericalAnswer: q.numericalAnswer ?? null,
          explanation: q.explanation || null
        }
      });
    }

    return {
      success: true,
      bank: {
        id: bank.id,
        title: bank.title,
        subject: bank.subject,
        status: bank.status,
        importSummary: { imported: questions.length, rejected: 0 }
      }
    };
  }

  static async submitQuestionBank(id) {
    const bank = await prisma.questionBank.update({
      where: { id },
      data: {
        status: 'submitted',
        submittedAt: new Date()
      }
    });

    await prisma.questionBankAuditEvent.create({
      data: {
        bankId: id,
        eventType: 'SUBMITTED',
        detail: { message: 'Submitted for administrator review and publication.' }
      }
    });

    return { success: true, bank };
  }
}
