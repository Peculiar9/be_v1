import { Hono } from "hono";
import { HealthController } from "../../Controllers/HealthController";

export function applyRoutes(app: Hono) {
    const healthController = new HealthController();

    // Health Check
    app.get("/health", (c) => healthController.check(c));
}