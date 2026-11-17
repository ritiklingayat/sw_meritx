import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { env } from './config/env.js';
import { globalRateLimiter } from './middleware/rateLimiter.middleware.js';
import { errorHandler } from './middleware/errorHandler.middleware.js';
import { setupSwagger } from './config/swagger.js';
import apiRoutes from './routes/index.js';
import { logger } from './utils/logger.js';

// Global BigInt JSON serialization support for Express
if (!BigInt.prototype.toJSON) {
  BigInt.prototype.toJSON = function () {
    const intVal = Number(this);
    return Number.isSafeInteger(intVal) ? intVal : this.toString();
  };
}

const app = express();

// Security Headers
app.use(helmet({
  contentSecurityPolicy: false, // Allows Temml & Swagger UI assets
  crossOriginEmbedderPolicy: false
}));

// CORS Configuration
const allowedOrigins = [
  env.FRONTEND_URL,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173'
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser requests or matching origins
    if (!origin || allowedOrigins.includes(origin) || origin.startsWith('http://localhost:')) {
      callback(null, true);
    } else {
      callback(null, true); // Permissive in dev, configurable in prod
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Body Parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Global Rate Limiter
app.use(globalRateLimiter);

// Request Logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (req.originalUrl !== '/health') {
      logger.info(`${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
});

// Swagger API Documentation
setupSwagger(app);

// Mount API routes under both /api and root paths for maximum frontend flexibility
app.use('/api', apiRoutes);
app.use('/', apiRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'NOT_FOUND',
    message: `Cannot ${req.method} ${req.originalUrl}`
  });
});

// Centralized Error Handler
app.use(errorHandler);

export default app;
