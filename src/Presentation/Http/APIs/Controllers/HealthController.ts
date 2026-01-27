import type { Context } from "hono";
import { controller, httpGet, ctx } from "hono-injector";

@controller("/health")
export class HealthController {
    @httpGet("/")
    public async check(@ctx() c: Context) {
        return c.json({
            status: "ok",
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV || "development",
            uptime: process.uptime()
        });
    }
}
