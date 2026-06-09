import type { Context } from "hono";
import { controller, httpGet, ctx } from "hono-injector";
import { BaseController } from "./BaseController";

@controller("/health")
export class HealthController extends BaseController {
    @httpGet("/")
    public async check(@ctx() c: Context) {
        return this.success(c, {
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV || "development",
            uptime: process.uptime()
        }, "Service is healthy");
    }
}
