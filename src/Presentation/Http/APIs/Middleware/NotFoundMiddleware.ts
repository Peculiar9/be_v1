import { injectable } from 'inversify';
import { Console } from '@Infrastructure/Utils/Console';
import type { Context } from 'hono';
import { ResponseHelper } from '@Core/Application/Response/ResponseHelper';

@injectable()
export class NotFoundMiddleware {
    public static handleNotFound(c: Context) {
        Console.warn(`Route not found: ${c.req.method} ${c.req.path}`, {
            method: c.req.method,
            url: c.req.path,
            time: new Date().toISOString()
        });
        
        return ResponseHelper.errorMessage(c, `Route not found: ${c.req.method} ${c.req.path}`, 404, 404);
    }
}
