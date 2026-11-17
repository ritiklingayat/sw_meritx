// Global BigInt JSON serialization support
if (!BigInt.prototype.toJSON) {
  BigInt.prototype.toJSON = function () {
    const intVal = Number(this);
    return Number.isSafeInteger(intVal) ? intVal : this.toString();
  };
}

import app from './app.js';
import { env } from './config/env.js';
import { checkDatabaseConnection, prisma } from './config/prisma.js';
import { logger } from './utils/logger.js';

const PORT = env.PORT || 5000;

async function bootstrap() {
  const server = app.listen(PORT, '0.0.0.0', async () => {
    logger.info(`🚀 MERITX Backend Server running on http://localhost:${PORT}`);
    logger.info(`📚 Swagger OpenAPI Documentation available at http://localhost:${PORT}/api-docs`);

    const dbStatus = await checkDatabaseConnection();
    if (dbStatus.ok) {
      logger.info('🐘 Neon PostgreSQL connected successfully via Prisma ORM.');
    } else {
      logger.warn(`⚠️ Database check notice: ${dbStatus.error}`);
      logger.warn('ℹ️ Ensure DATABASE_URL in backend/.env is pointing to your active Neon PostgreSQL database.');
    }
  });

  const shutdown = async (signal) => {
    logger.info(`Received ${signal}. Shutting down gracefully...`);
    server.close(async () => {
      await prisma.$disconnect();
      logger.info('Closed HTTP server and disconnected Prisma database connection.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  logger.error('Failed to start server:', { error: err.message, stack: err.stack });
  process.exit(1);
});
