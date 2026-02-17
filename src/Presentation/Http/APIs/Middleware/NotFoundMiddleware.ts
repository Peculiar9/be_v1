import { injectable } from 'inversify';
import { Console } from '@Infrastructure/Utils/Console';

@injectable()
export class NotFoundMiddleware {
    public static handleNotFound(req: any, res: any, next: any) {
        // Log the not found route for monitoring
        Console.warn(`Route not found: ${req.method} ${req.originalUrl}`, {
            method: req.method,
            url: req.originalUrl,
            ip: req.ip,
            headers: req.headers,
            time: new Date().toISOString()
        });
        
        return res.status(404).json({
            success: false,
            message: `Route not found: ${req.method} ${req.originalUrl}`,
            data: null
        });
    }
}
