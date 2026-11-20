import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

const loadJson = (filePath) => {
  try {
    const fullPath = path.resolve(__dirname, filePath);
    if (fs.existsSync(fullPath)) {
      return JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
    }
  } catch (err) {
    console.warn(`[Seed] Warning loading ${filePath}:`, err.message);
  }
  return [];
};

async function main() {
  console.log('🌱 Starting MERITX database seed...');

  // 1. Seed Landing Page Content
  await prisma.landingPageContent.upsert({
    where: { key: 'about_courses' },
    update: {},
    create: {
      key: 'about_courses',
      payload: {
        heading: 'About Our Courses',
        description: 'Structured mock examinations for JEE Main, JEE Advanced, MHT-CET and NEET UG with instant proctored assessment.',
        buttonLabel: 'Explore examinations',
        visible: true
      }
    }
  });

  // 2. Seed Users
  const usersData = loadJson('../../frontend/src/data/users.json');
  console.log(`👤 Seeding ${usersData.length} users...`);

  for (const u of usersData) {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(u.password || 'Student@123', salt);
    const role = u.role.toUpperCase();

    const user = await prisma.user.upsert({
      where: { email: u.email.toLowerCase() },
      update: {
        name: u.name,
        target: u.target,
        city: u.city,
        academicYear: u.year,
        phone: u.phone,
        avatarUrl: u.avatar
      },
      create: {
        id: u.id,
        name: u.name,
        email: u.email.toLowerCase(),
        passwordHash,
        role: Role[role] || Role.STUDENT,
        target: u.target,
        city: u.city,
        academicYear: u.year,
        phone: u.phone,
        avatarUrl: u.avatar
      }
    });

    // Create user profile
    await prisma.userProfile.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        phone: u.phone,
        city: u.city,
        targetExam: u.target,
        academicYear: u.year,
        avatarUrl: u.avatar,
        designation: role === 'TEACHER' ? 'Senior Faculty & Assessment Lead' : null,
        department: role === 'TEACHER' ? 'Physical & Engineering Sciences' : null,
        specialization: role === 'TEACHER' ? 'Mechanics, Electromagnetism & Modern Physics' : null,
        experienceYears: role === 'TEACHER' ? 12 : null
      }
    });

    // Create wallet with zero initial starting balance for students
    const initialPaise = user.role === 'STUDENT' ? BigInt(0) : BigInt(150000);
    const wallet = await prisma.wallet.upsert({
      where: { userId: user.id },
      update: user.role === 'STUDENT' ? { balancePaise: BigInt(0) } : {},
      create: {
        userId: user.id,
        balancePaise: initialPaise,
        currency: 'INR',
        status: 'active'
      }
    });

    // Create initial deposit transaction record only for non-student demo accounts
    const refId = `DEP-INIT-${user.id}`;
    const existingTx = await prisma.walletTransaction.findUnique({
      where: { referenceId: refId }
    });

    if (!existingTx && initialPaise > BigInt(0)) {
      await prisma.walletTransaction.create({
        data: {
          walletId: wallet.id,
          userId: user.id,
          type: 'deposit',
          direction: 'credit',
          amountPaise: initialPaise,
          balanceBeforePaise: BigInt(0),
          balanceAfterPaise: initialPaise,
          status: 'successful',
          referenceId: refId,
          description: 'Initial Demo Account Balance Credit'
        }
      });

      await prisma.walletLedgerEntry.create({
        data: {
          walletId: wallet.id,
          transactionKey: `LEDGER-${refId}`,
          entryType: 'CREDIT',
          category: 'DEPOSIT',
          amountPaise: initialPaise,
          balanceAfterPaise: initialPaise,
          memo: 'Welcome Demo Credit'
        }
      });
    }
  }

  // 3. Seed Exam Patterns
  const patternsData = loadJson('../../frontend/src/data/patterns.json');
  console.log(`📐 Seeding ${patternsData.length} examination patterns...`);

  for (const p of patternsData) {
    await prisma.examPattern.upsert({
      where: {
        code_version: {
          code: p.code,
          version: p.version || 1
        }
      },
      update: {
        name: p.name,
        configuration: p.configuration,
        status: p.status || 'active'
      },
      create: {
        id: p.id,
        code: p.code,
        name: p.name,
        version: p.version || 1,
        officialYear: p.officialYear || 2026,
        configuration: p.configuration,
        status: p.status || 'active',
        isBuiltin: Boolean(p.builtIn)
      }
    });
  }

  // 4. Seed Courses
  console.log('📚 Seeding official courses...');
  const defaultCourses = [
    {
      id: 'course-jee-main',
      slug: 'jee-main-2026',
      name: 'JEE Main 2026 Mock Tests',
      category: 'Engineering Entrance',
      examType: 'JEE Main',
      shortDescription: 'Full-length JEE Main practice with server-side scoring.',
      fullDescription: 'Practice the configured JEE Main pattern with detailed results and explanations.',
      fee: 0,
      durationDays: 180,
      mockTestCount: 10,
      publishedExamCount: 1,
      enrolledStudentCount: 68,
      status: 'published',
      isVisible: true,
      isFeatured: true,
      displayOrder: 1,
      teacherId: 'teacher-1'
    },
    {
      id: 'course-jee-advanced',
      slug: 'jee-advanced-2026',
      name: 'JEE Advanced 2026 Practice',
      category: 'Engineering Entrance',
      examType: 'JEE Advanced',
      shortDescription: 'Two-paper advanced practice with partial marking support.',
      fullDescription: 'Compatible uploaded banks are clearly labeled as practice sets with multi-correct and numerical questions.',
      fee: 0,
      durationDays: 180,
      mockTestCount: 10,
      publishedExamCount: 1,
      enrolledStudentCount: 29,
      status: 'published',
      isVisible: true,
      isFeatured: true,
      displayOrder: 2,
      teacherId: 'teacher-1'
    },
    {
      id: 'course-mht-cet',
      slug: 'mht-cet-pcm-2026',
      name: 'MHT-CET PCM 2026 Mock Tests',
      category: 'State Entrance',
      examType: 'MHT-CET PCM',
      shortDescription: 'PCM mock tests with a locked 90+90 minute flow.',
      fullDescription: 'Physics and Chemistry run first for 90 minutes, followed by the Mathematics block for 90 minutes.',
      fee: 0,
      durationDays: 120,
      mockTestCount: 10,
      publishedExamCount: 1,
      enrolledStudentCount: 35,
      status: 'published',
      isVisible: true,
      isFeatured: true,
      displayOrder: 3,
      teacherId: 'teacher-1'
    },
    {
      id: 'course-neet',
      slug: 'neet-ug-2026',
      name: 'NEET UG 2026 Mock Tests',
      category: 'Medical Entrance',
      examType: 'NEET UG',
      shortDescription: 'Digital OMR-inspired NEET practice.',
      fullDescription: 'Full-length NEET mock tests with subject-wise analytics across Botany, Zoology, Physics, and Chemistry.',
      fee: 0,
      durationDays: 180,
      mockTestCount: 10,
      publishedExamCount: 1,
      enrolledStudentCount: 45,
      status: 'published',
      isVisible: true,
      isFeatured: true,
      displayOrder: 4,
      teacherId: 'teacher-1'
    }
  ];

  for (const c of defaultCourses) {
    await prisma.course.upsert({
      where: { id: c.id },
      update: {
        name: c.name,
        category: c.category,
        examType: c.examType,
        shortDescription: c.shortDescription,
        fullDescription: c.fullDescription,
        fee: c.fee * 100,
        enrolledStudentCount: c.enrolledStudentCount,
        status: c.status
      },
      create: {
        id: c.id,
        slug: c.slug,
        name: c.name,
        category: c.category,
        examType: c.examType,
        shortDescription: c.shortDescription,
        fullDescription: c.fullDescription,
        fee: c.fee * 100,
        durationDays: c.durationDays,
        mockTestCount: c.mockTestCount,
        publishedExamCount: c.publishedExamCount,
        enrolledStudentCount: c.enrolledStudentCount,
        status: c.status,
        isVisible: c.isVisible,
        isFeatured: c.isFeatured,
        displayOrder: c.displayOrder,
        teacherId: c.teacherId
      }
    });
  }

  // 5. Seed Examinations
  const examsData = loadJson('../../frontend/src/data/exams.json');
  console.log(`📝 Seeding ${examsData.length} exams...`);

  const existingPatterns = await prisma.examPattern.findMany({ select: { id: true } });
  const validPatternIds = new Set(existingPatterns.map(p => p.id));

  for (const e of examsData) {
    const verifiedPatternId = (e.patternId && validPatternIds.has(e.patternId)) ? e.patternId : null;
    await prisma.exam.upsert({
      where: { id: e.id },
      update: {
        patternId: verifiedPatternId,
        title: e.title,
        type: e.type,
        category: e.category,
        subject: e.subject,
        duration: e.duration,
        marks: e.marks,
        passingMarks: e.passingMarks,
        negativeMarking: e.negativeMarking,
        proctoringRequired: e.proctoringRequired,
        fee: (e.fee || 0) * 100,
        tag: e.tag,
        description: e.description,
        syllabus: e.syllabus,
        status: e.status || 'published',
        registrationOpen: e.registrationOpen ?? true,
        bannerImageUrl: e.bannerImageUrl,
        schedule: e.schedule || null,
        configuration: e.configuration || null
      },
      create: {
        id: e.id,
        patternId: verifiedPatternId,
        title: e.title,
        type: e.type,
        category: e.category,
        subject: e.subject,
        date: e.date,
        time: e.time,
        duration: e.duration,
        questionsCount: e.questions || 30,
        marks: e.marks || 120,
        passingMarks: e.passingMarks || 60,
        negativeMarking: e.negativeMarking ?? true,
        maxAttempts: e.maxAttempts || 1,
        proctoringRequired: e.proctoringRequired ?? true,
        fee: (e.fee || 0) * 100,
        tag: e.tag,
        description: e.description,
        syllabus: e.syllabus,
        status: e.status || 'published',
        registrationOpen: e.registrationOpen ?? true,
        bannerImageUrl: e.bannerImageUrl,
        schedule: e.schedule || null,
        configuration: e.configuration || null,
        registeredCount: e.registered || 0
      }
    });
  }

  // 6. Seed Question Banks and Questions
  console.log('🔬 Seeding Question Bank and Questions...');
  const defaultBank = await prisma.questionBank.upsert({
    where: { id: 'qb-master-01' },
    update: {},
    create: {
      id: 'qb-master-01',
      title: 'Grand Master Mock Question Repository',
      subject: 'PCM & Biology',
      status: 'approved',
      createdById: 'teacher-1',
      approvedById: 'admin-1',
      approvedAt: new Date()
    }
  });

  const questionsData = loadJson('../../frontend/src/data/questions.json');
  console.log(`❓ Seeding ${questionsData.length} core questions...`);

  for (const [index, q] of questionsData.entries()) {
    const qId = `q-${q.id || index + 1}`;
    await prisma.question.upsert({
      where: { id: qId },
      update: {
        text: q.text,
        options: q.options || [],
        answer: q.answer ?? q.correctOption ?? 0,
        correctOption: q.correctOption ?? q.answer ?? 0,
        correctOptions: q.correctOptions || [q.answer ?? q.correctOption ?? 0],
        numericalAnswer: q.numericalAnswer ?? null,
        explanation: q.explanation || null
      },
      create: {
        id: qId,
        bankId: defaultBank.id,
        position: index + 1,
        subject: q.subject || 'General',
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

  // 7. Seed Initial Registrations for Demo Student
  console.log('🎟️ Seeding demo registrations...');
  const demoExams = ['java-assessment-01', 'jee-main-01', 'neet-biology-01'];
  for (const examId of demoExams) {
    const exists = await prisma.exam.findUnique({ where: { id: examId } });
    if (exists) {
      await prisma.examRegistration.upsert({
        where: {
          studentId_examId: {
            studentId: 'student-1',
            examId
          }
        },
        update: {},
        create: {
          studentId: 'student-1',
          examId,
          amountPaid: exists.fee,
          paymentStatus: 'successful',
          status: 'confirmed'
        }
      });
    }
  }

  // 8. Seed Platform Master Treasury Ledger
  console.log('🏛️ Seeding platform treasury ledger...');
  await prisma.platformMasterLedger.upsert({
    where: { transactionKey: 'PML-INIT-CAPITAL' },
    update: {},
    create: {
      transactionKey: 'PML-INIT-CAPITAL',
      category: 'treasury',
      type: 'initial_balance',
      direction: 'credit',
      amountPaise: BigInt(48250000), // ₹4,82,500.00
      balanceAfterPaise: BigInt(34185000), // ₹3,41,850.00
      referenceId: 'CAP-INIT-2026',
      description: 'Initial platform working capital reserve'
    }
  });

  console.log('✅ MERITX Database Seeding Completed Successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
