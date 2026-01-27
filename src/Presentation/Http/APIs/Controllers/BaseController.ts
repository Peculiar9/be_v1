import { Context } from 'hono';
import { injectable } from 'inversify';
import { BaseMiddleware } from '../Middleware/BaseMiddleware';
import { AppError } from '@Core/Application/Error/AppError';

@injectable()
export class BaseController extends BaseMiddleware {
  protected success(c: Context, data: any, message: string = 'Success') {
    return c.json({
      success: true,
      message,
      data
    }, 200);
  }

  protected error(c: Context, message: string, status: number = 500, error?: Error) {
    console.log("BaseController::error - ", error);
    console.log("BaseController::instance of error - ", error instanceof AppError);

    let response: any = {
      success: false,
      message: message || error?.message,
      error_code: 9999, // Generic internal error code
      data: null
    };

    if (error instanceof AppError) {
      response = {
        success: false,
        message: error.message,
        error_code: error.errorCode,
        data: null,
      };
    }

    // Hono status code must be a valid StatusCode type, so we might need casting or careful typing
    // specific status codes like 400, 401 etc are fine.
    return c.json(response, status as any); // cast to any to avoid strict StatusCode type errors for dynamic status
  }
}