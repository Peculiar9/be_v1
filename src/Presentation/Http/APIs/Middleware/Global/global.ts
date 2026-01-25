import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";

export function applyGlobalMiddleware(app: Hono) {
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