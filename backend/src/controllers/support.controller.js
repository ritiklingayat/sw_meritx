import { AdminService } from '../services/admin.service.js';
import { prisma } from '../config/prisma.js';

export class SupportController {
  static async createTicket(req, res, next) {
    try {
      const ticket = await AdminService.createTicket({
        userId: req.user?.id || 'guest',
        userName: req.user?.name || req.body.name || 'Student Candidate',
        subject: req.body.subject || 'Support Request',
        message: req.body.message || ''
      });
      return res.status(201).json({ success: true, ticket });
    } catch (err) {
      next(err);
    }
  }

  static async getLandingContent(req, res, next) {
    try {
      const content = await prisma.landingPageContent.findUnique({
        where: { key: 'about_courses' }
      });

      return res.status(200).json({
        payload: content?.payload || {
          heading: 'About Our Courses',
          description: 'Structured mock examinations for JEE Main, JEE Advanced, MHT-CET and NEET UG with instant proctored assessment.',
          buttonLabel: 'Explore examinations',
          visible: true
        }
      });
    } catch (err) {
      next(err);
    }
  }
}
