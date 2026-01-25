import { Context } from "hono";

export class HealthController {
    public async check(c: Context) {
        return c.json({
            status: "ok",
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV || "development",
            uptime: process.uptime()
        });
    }
}
