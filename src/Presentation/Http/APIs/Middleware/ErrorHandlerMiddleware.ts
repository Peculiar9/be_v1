import { injectable } from 'inversify';
import { Console } from '@Infrastructure/Utils/Console';
import { AppError } from '@Core/Application/Error/AppError';
import * as Sentry from '@sentry/node';
import type { Context } from 'hono';
import { ResponseHelper, errorDetails } from '@Core/Application/Response/ResponseHelper';

@injectable()
export class ErrorHandlerMiddleware {
    public static handleError(err: Error, c: Context) {
        const details = errorDetails(err);
        
        const errorContext = {
            url: c.req.path,
            method: c.req.method,
            statusCode: details.statusCode,
            errorName: err.name,
            errorCode: err instanceof AppError ? err.errorCode : details.errorCode,
            stack: err.stack
        };
        
        if (details.statusCode >= 500) {
            Console.error(err, errorContext);
            Sentry.captureException(err);
        } else {
            Console.warn(err.message, errorContext);
        }
        
        return ResponseHelper.error(c, err);
    }
}
