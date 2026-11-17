import { storageService, STORAGE_KEYS } from './storageService';

class CourseService {
  async getCourses({ search = '', category = '', examType = '', status = '', sort = '' } = {}) {
    let list = storageService.getCollection(STORAGE_KEYS.COURSES);

    if (status) {
      list = list.filter((c) => c.status === status);
    }

    if (category) {
      list = list.filter((c) => c.category?.toLowerCase() === category.toLowerCase());
    }

    if (examType) {
      list = list.filter((c) => c.examType?.toLowerCase() === examType.toLowerCase());
    }

    if (search) {
      const q = search.toLowerCase();
      list = list.filter((c) =>
        c.name?.toLowerCase().includes(q) ||
        c.shortDescription?.toLowerCase().includes(q) ||
        c.category?.toLowerCase().includes(q)
      );
    }

    if (sort === 'fee_asc') {
      list.sort((a, b) => (a.effectivePrice || a.fee) - (b.effectivePrice || b.fee));
    } else if (sort === 'fee_desc') {
      list.sort((a, b) => (b.effectivePrice || b.fee) - (a.effectivePrice || a.fee));
    } else if (sort === 'name') {
      list.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      list.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
    }

    return list;
  }

  async getCourseById(id) {
    const list = storageService.getCollection(STORAGE_KEYS.COURSES);
    return list.find((c) => c.id === id || c.slug === id) || null;
  }

  async createCourse(courseData) {
    const slug = courseData.slug || courseData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const discount = Number(courseData.discountPercent || 0);
    const fee = Number(courseData.fee || 0);
    const effectivePrice = Math.max(0, fee * (1 - discount / 100));

    const newCourse = storageService.insert(STORAGE_KEYS.COURSES, {
      ...courseData,
      slug,
      fee,
      discountPercent: discount,
      effectivePrice,
      durationDays: Number(courseData.durationDays || 180),
      mockTestCount: Number(courseData.mockTestCount || 10),
      publishedExamCount: 0,
      publishedQuestionCount: 0,
      enrolledStudentCount: 0,
      status: courseData.status || 'published',
      visible: courseData.visible ?? true,
      featured: courseData.featured ?? false,
      displayOrder: Number(courseData.displayOrder || 99)
    });

    return newCourse;
  }

  async updateCourse(id, updates) {
    const fee = updates.fee !== undefined ? Number(updates.fee) : undefined;
    const discount = updates.discountPercent !== undefined ? Number(updates.discountPercent) : undefined;
    
    const existing = await this.getCourseById(id);
    if (!existing) throw new Error('Course not found.');

    const finalFee = fee !== undefined ? fee : existing.fee;
    const finalDiscount = discount !== undefined ? discount : existing.discountPercent;
    const effectivePrice = Math.max(0, finalFee * (1 - finalDiscount / 100));

    const updated = storageService.update(STORAGE_KEYS.COURSES, id, {
      ...updates,
      fee: finalFee,
      discountPercent: finalDiscount,
      effectivePrice
    });

    return updated;
  }

  async deleteCourse(id) {
    return storageService.delete(STORAGE_KEYS.COURSES, id);
  }

  async enrollStudent(studentId, courseId) {
    const enrollments = storageService.getCollection(STORAGE_KEYS.ENROLLMENTS);
    const existing = enrollments.find((e) => e.studentId === studentId && e.courseId === courseId);
    
    if (existing) {
      return { success: true, message: 'Already enrolled in this course.', enrollment: existing };
    }

    const newEnrollment = storageService.insert(STORAGE_KEYS.ENROLLMENTS, {
      studentId,
      courseId,
      status: 'active',
      enrolledAt: new Date().toISOString()
    });

    // Update enrolled student count on the course
    const course = await this.getCourseById(courseId);
    if (course) {
      this.updateCourse(courseId, {
        enrolledStudentCount: (course.enrolledStudentCount || 0) + 1
      });
    }

    return { success: true, message: 'Successfully enrolled!', enrollment: newEnrollment };
  }

  async getStudentCourses(studentId) {
    const enrollments = storageService.getCollection(STORAGE_KEYS.ENROLLMENTS)
      .filter((e) => e.studentId === studentId);
    const courseIds = new Set(enrollments.map((e) => e.courseId));
    const all = storageService.getCollection(STORAGE_KEYS.COURSES);
    return all.filter((c) => courseIds.has(c.id));
  }
}

export const courseService = new CourseService();
