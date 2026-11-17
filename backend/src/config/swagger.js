import swaggerUi from 'swagger-ui-express';

export const swaggerDocument = {
  openapi: '3.0.0',
  info: {
    title: 'MERITX Online Examination Platform API',
    version: '2.0.0',
    description: 'Production REST API for SW MERITX competitive examination platform powered by Node.js, Express, Neon PostgreSQL, and Prisma ORM.'
  },
  servers: [
    {
      url: '/api',
      description: 'API base path'
    }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Provide signed JWT access token in the format: Bearer <token>'
      }
    },
    schemas: {
      User: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          email: { type: 'string', format: 'email' },
          role: { type: 'string', enum: ['STUDENT', 'TEACHER', 'ADMIN', 'SUPERADMIN'] },
          city: { type: 'string' },
          target: { type: 'string' }
        }
      },
      Exam: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          type: { type: 'string' },
          subject: { type: 'string' },
          duration: { type: 'integer' },
          marks: { type: 'integer' },
          fee: { type: 'integer' },
          status: { type: 'string' }
        }
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: { type: 'string' },
          message: { type: 'string' }
        }
      }
    }
  },
  paths: {
    '/health': {
      get: {
        summary: 'Platform Health Check',
        responses: {
          200: {
            description: 'API and database health status'
          }
        }
      }
    },
    '/auth/register': {
      post: {
        summary: 'Public Student Registration',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'email', 'password'],
                properties: {
                  name: { type: 'string' },
                  email: { type: 'string' },
                  password: { type: 'string', minLength: 6 },
                  target: { type: 'string' },
                  city: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          201: { description: 'Registration successful, returns user and JWT tokens' },
          400: { description: 'Validation error' },
          409: { description: 'Email already exists' }
        }
      }
    },
    '/auth/login': {
      post: {
        summary: 'User Login',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string' },
                  password: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Returns authenticated user and signed JWT' },
          401: { description: 'Invalid credentials' }
        }
      }
    },
    '/auth/me': {
      get: {
        summary: 'Get Active User Profile',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Current authenticated user profile' },
          401: { description: 'Unauthenticated' }
        }
      }
    },
    '/me/dashboard': {
      get: {
        summary: 'Student Dashboard Data',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Registered exams, attempts history, and wallet summary' }
        }
      }
    },
    '/me/wallet': {
      get: {
        summary: 'Student Wallet Balance & Transactions',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Current available balance and ledger history' }
        }
      }
    },
    '/exams': {
      get: {
        summary: 'List Available Examinations',
        responses: {
          200: { description: 'Array of published mock examinations' }
        }
      }
    },
    '/exams/{id}': {
      get: {
        summary: 'Get Examination Details',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          200: { description: 'Examination configuration and schedule' },
          404: { description: 'Examination not found' }
        }
      }
    },
    '/exams/register': {
      post: {
        summary: 'Register for Examination',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['examId'],
                properties: {
                  examId: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Registration confirmed, fee deducted atomically from wallet' }
        }
      }
    },
    '/attempts/start': {
      post: {
        summary: 'Start or Resume Examination Attempt',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['examId'],
                properties: {
                  examId: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Attempt initialized with server deadline and questions snapshot' }
        }
      }
    },
    '/attempts/save': {
      post: {
        summary: 'Autosave Examination Answers',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Progress successfully saved on server' }
        }
      }
    },
    '/attempts/submit': {
      post: {
        summary: 'Final Examination Submission',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Server-side evaluation completed and result generated' }
        }
      }
    },
    '/proctoring/warning': {
      post: {
        summary: 'Log Proctoring Rule Violation Warning',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Progressive warning recorded' }
        }
      }
    },
    '/leaderboards/{examId}': {
      get: {
        summary: 'Exam Deterministic Merit Leaderboard',
        parameters: [
          { name: 'examId', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          200: { description: 'Rankings, Podium top 3, metrics, and candidate rank' }
        }
      }
    },
    '/admin/overview': {
      get: {
        summary: 'Administrator Command Center Overview',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Platform statistics, active candidates, and audit records' }
        }
      }
    },
    '/admin/finance/overview': {
      get: {
        summary: 'Finance & Treasury Command Metrics',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Collections, payouts, wallet liabilities, and reconciliations' }
        }
      }
    }
  }
};

export function setupSwagger(app) {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
  app.get('/api-docs.json', (req, res) => res.json(swaggerDocument));
}
