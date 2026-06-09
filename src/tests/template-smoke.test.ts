import 'reflect-metadata';
import { beforeAll, describe, expect, test } from 'bun:test';
import { Hono } from 'hono';
import { IsNotEmpty, IsString } from 'class-validator';
import { ResponseHelper } from '@Core/Application/Response/ResponseHelper';
import { ValidationError } from '@Core/Application/Error/AppError';
import { validationMiddleware } from '@Presentation/Http/APIs/Middleware/ValidationMiddleware';

class SmokeDTO {
  @IsString()
  @IsNotEmpty()
  name!: string;
}

beforeAll(() => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_ACCESS_SECRET = 'test-access-secret';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
  process.env.JWT_RESET_SECRET = 'test-reset-secret';
  process.env.TWILIO_ACCOUNT_SID = 'AC00000000000000000000000000000000';
  process.env.TWILIO_AUTH_TOKEN = 'test-token';
  process.env.TWILIO_VERIFY_SERVICE_SID = 'VA00000000000000000000000000000000';
  process.env.TWILIO_PHONE_NUMBER = '+10000000000';
  process.env.TWILIO_WHATSAPP_NUMBER = '+10000000000';
  process.env.DB_HOST = 'localhost';
  process.env.DB_NAME = 'template_test';
  process.env.DB_USER = 'template_test';
  process.env.DB_PASSWORD = 'template_test';
  process.env.DB_PORT = '5432';
  process.env.DATABASE_URL = '';
});

describe('template smoke coverage', () => {
  test('ResponseHelper returns the canonical success envelope', async () => {
    const app = new Hono();
    app.get('/ok', (c) => ResponseHelper.success(c, { id: '1' }, 'OK'));

    const response = await app.request('/ok');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      message: 'OK',
      data: { id: '1' },
    });
  });

  test('ResponseHelper returns the canonical error envelope', async () => {
    const app = new Hono();
    app.get('/error', (c) => ResponseHelper.error(c, new ValidationError('Invalid input')));

    const response = await app.request('/error');

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      success: false,
      message: 'Invalid input',
      error_code: 100,
      data: null,
    });
  });

  test('validation middleware rejects invalid JSON bodies with the shared envelope', async () => {
    const app = new Hono();
    app.post('/validate', validationMiddleware(SmokeDTO), (c) => {
      return ResponseHelper.success(c, {}, 'Validated');
    });

    const response = await app.request('/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '' }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      success: false,
      message: 'Validation failed',
      error_code: 100,
      data: null,
    });
  });

  test('auth middleware rejects missing bearer tokens with the shared envelope', async () => {
    const { AuthMiddleware } = await import('@Presentation/Http/APIs/Middleware/AuthMiddleware');
    const app = new Hono();
    app.get('/protected', AuthMiddleware.authenticate(), (c) => ResponseHelper.success(c, {}, 'OK'));

    const response = await app.request('/protected');
    const body = await response.json() as { success: boolean; data: null };

    expect(response.status).toBe(401);
    expect(body.success).toBe(false);
    expect(body.data).toBe(null);
  });

  test('DI container exposes the core template bindings', async () => {
    const { DIContainer } = await import('@Core/DI/DIContainer');
    const { TYPES } = await import('@Core/Types/Constants');
    const container = DIContainer.getInstance();

    expect(container.isBound(TYPES.AuthUseCase)).toBe(true);
    expect(container.isBound(TYPES.AccountUseCase)).toBe(true);
    expect(container.isBound(TYPES.FileUseCase)).toBe(true);
    expect(container.isBound(TYPES.AuthenticationService)).toBe(true);
    expect(container.isBound(TYPES.RegistrationService)).toBe(true);
    expect(container.isBound(TYPES.UserProfileService)).toBe(true);
    expect(container.isBound(TYPES.PaymentTransactionRepository)).toBe(true);
    expect(container.isBound(TYPES.PaymentGateway)).toBe(false);
  });
});
