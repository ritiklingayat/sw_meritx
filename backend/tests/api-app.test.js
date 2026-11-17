import test from 'node:test';
import assert from 'node:assert';
import app from '../src/app.js';
import { swaggerDocument } from '../src/config/swagger.js';
import { PaymentService } from '../src/services/payment.service.js';

test('Express App - Swagger OpenAPI Spec Generation', () => {
  assert.strictEqual(swaggerDocument.openapi, '3.0.0');
  assert.strictEqual(swaggerDocument.info.title, 'MERITX Online Examination Platform API');
  assert(swaggerDocument.paths['/auth/login'], 'Must document /auth/login');
  assert(swaggerDocument.paths['/attempts/start'], 'Must document /attempts/start');
  assert(swaggerDocument.paths['/me/wallet'], 'Must document /me/wallet');
  assert(swaggerDocument.paths['/leaderboards/{examId}'], 'Must document leaderboards');
  assert(swaggerDocument.paths['/admin/overview'], 'Must document admin overview');
  assert(swaggerDocument.paths['/admin/finance/overview'], 'Must document finance overview');
});

test('Express App - Payments Configuration Service', () => {
  const config = PaymentService.getConfiguration();
  assert.strictEqual(config.configured, true);
  assert.strictEqual(config.mode, 'test');
  assert(config.keyId, 'Must return test keyId');
});

test('Express App - Route and Handler Dispatch', async () => {
  const mockReq = {
    method: 'GET',
    url: '/health',
    originalUrl: '/health',
    headers: {},
    ip: '127.0.0.1',
    socket: { remoteAddress: '127.0.0.1' }
  };

  let capturedStatus = 200;
  let capturedJson = null;

  const mockRes = {
    status(code) {
      capturedStatus = code;
      return this;
    },
    json(data) {
      capturedJson = data;
      return this;
    },
    setHeader() {},
    getHeader() {},
    removeHeader() {},
    on() {}
  };

  await new Promise((resolve) => {
    app.handle(mockReq, mockRes, () => resolve());
    setTimeout(resolve, 50);
  });

  assert.strictEqual(capturedStatus, 200);
  assert.strictEqual(capturedJson?.status, 'ok');
});

test('Express App - 404 Handler for Unknown Route', async () => {
  const mockReq = {
    method: 'GET',
    url: '/non-existent-random-endpoint',
    originalUrl: '/non-existent-random-endpoint',
    headers: {},
    ip: '127.0.0.1',
    socket: { remoteAddress: '127.0.0.1' }
  };

  let capturedStatus = 404;
  let capturedJson = null;

  const mockRes = {
    status(code) {
      capturedStatus = code;
      return this;
    },
    json(data) {
      capturedJson = data;
      return this;
    },
    setHeader() {},
    getHeader() {},
    removeHeader() {},
    on() {}
  };

  await new Promise((resolve) => {
    app.handle(mockReq, mockRes, () => resolve());
    setTimeout(resolve, 50);
  });

  assert.strictEqual(capturedStatus, 404);
  assert.strictEqual(capturedJson?.error, 'NOT_FOUND');
});
