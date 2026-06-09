import type { Context } from 'hono';
import { injectable } from 'inversify';
import { BaseMiddleware } from '../Middleware/BaseMiddleware';
import { ResponseHelper, toStatusCode } from '@Core/Application/Response/ResponseHelper';

@injectable()
export class BaseController extends BaseMiddleware {
  protected created<T>(c: Context, data: T, message: string = 'Success') {
    return ResponseHelper.created(c, data, message);
  }
 
  protected success<T>(c: Context, data: T, message: string = 'Success') {
    return ResponseHelper.success(c, data, message);
  }

  protected error(c: Context, message: string, status: number = 500, error?: unknown) {
    if (error) {
      return ResponseHelper.error(c, error, message, toStatusCode(status, 500));
    }
    return ResponseHelper.errorMessage(c, message, toStatusCode(status, 500));
  }
}
