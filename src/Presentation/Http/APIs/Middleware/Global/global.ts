import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { Console } from "@Infrastructure/Utils/Console";

export function applyGlobalMiddleware(app: Hono) {
    // 1. Performance / Timing Middleware (Should be first to capture full duration)
    app.use('*', async (c, next) => {
        const start = performance.now();
        await next();
        const end = performance.now();
        const duration = (end - start).toFixed(2);
        
        c.header('X-Response-Time', `${duration}ms`);
        
        // Log slow requests (> 500ms) as warnings, others as info/debug
        if (Number(duration) > 500) {
            Console.warn(`[Slow Request] ${c.req.method} ${c.req.path} took ${duration}ms`);
        } else {
           // Optional: Uncomment for verbose logging
           // Console.info(`[Perf] ${c.req.method} ${c.req.path} took ${duration}ms`);
        }
    });

    // 2. Security & CORS
    app.use(cors(corsOptions()));
    app.use('*', secureHeaders());
}

function corsOptions(): {
    origin: string[];
    allowMethods: string[];
    allowHeaders: string[];
    exposeHeaders: string[];
    maxAge: number;
    credentials: boolean;
} {
    return {
        origin: ['*'],
        allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowHeaders: ['Content-Type', 'Authorization'],
        exposeHeaders: ['Content-Length'],
        maxAge: 60 * 60 * 24,
        credentials: true,
    };
}