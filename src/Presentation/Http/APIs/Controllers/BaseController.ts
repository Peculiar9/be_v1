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

    // Ensure status is within valid range (100-599). If 0 or invalid, default to 500.
    const validStatus = (status && status >= 100 && status < 600) ? status : 500;

    // DEBUG LOG
    if (status !== validStatus || !status) {
      console.error(`[BaseController] Invalid status detected: ${status}. Defaulting to ${validStatus}. Message: ${message}`);
    } else {
      console.log(`[BaseController] Returning response with status: ${validStatus}`);
    }

    return c.json(response, validStatus as any);
  }
}