import { Context, Next } from 'hono';
import { ValidationError } from '@Core/Application/Error/AppError';
import { ResponseMessage } from '@Core/Application/Response/ResponseFormat';
import { injectable } from 'inversify';

@injectable()
export class BaseMiddleware {

  protected static requestCounts: { [key: string]: RequestCount } = {};

  // In Hono, body is obtained via await c.req.json() or c.req.parseBody().
  // If validation middleware ran, it might be in c.get('validated_body').
  // This method is likely synchronous in legacy code, but body parsing is async in Hono.
  // We should rely on validationMiddleware or ensure body is parsed before calling this.
  protected HandleEmptyReqBody(body: any): void {
    if (!body || Object.keys(body).length === 0) {
      throw new ValidationError(ResponseMessage.MISSING_REQUIRED_FIELDS);
    }
  }

  protected validateRequiredFields(data: any, fields: string[]): void {
    for (const field of fields) {
      if (!data[field]) {
        throw new ValidationError(`${field} is required`);
      }
    }
  }

  protected static rateLimitingPipeline(paramKey: string, { windowMs, maxRequests }: RateLimitOptions) {
    // Using a shared in-memory object; TODO: in production consider using a distributed store.
    const requestCounts = BaseMiddleware.requestCounts || {};
    // Convert windowMs (minutes) to milliseconds.
    const rateLimitWindow = windowMs * 60 * 1000;

    return async function rateLimiter(c: Context, next: Next) {
      // Extract the query parameter for additional identification.
      const paramValue = String(c.req.query(paramKey) ?? '');
      const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown'; // Hono doesn't have c.ip directly without middleware or adapter
      const identifier = `${ip}-${paramValue}`;

      // Initialize or update the request count.
      if (!requestCounts[identifier]) {
        requestCounts[identifier] = { count: 1, startTime: Date.now() };
      } else {
        requestCounts[identifier].count += 1;
      }

      const elapsedTime = Date.now() - requestCounts[identifier].startTime;

      // Check if within the current window.
      if (elapsedTime < rateLimitWindow) {
        if (requestCounts[identifier].count > maxRequests) {
          // Respond with rate limit error and return early.
          return c.json({
            success: false,
            message: ResponseMessage.RATE_LIMIT_ERROR,
            data: {},
            error: {
              code: 12
            }
          }, 429);
        }
      } else {
        // Reset counter if time window has passed.
        requestCounts[identifier] = { count: 1, startTime: Date.now() };
      }

      // Proceed to next middleware/handler.
      await next();
    };
  }


}

export interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
}

export interface RequestCount {
  count: number;
  startTime: number;
}

