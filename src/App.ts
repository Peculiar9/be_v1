import 'reflect-metadata';
import { Container } from 'inversify';
import { DatabaseService } from '@Infrastructure/Database/DatabaseService';
import { getRouteInfo } from 'inversify-express-utils';

import { DIContainer } from '@Core/DI/DIContainer';
import { Hono, HonoRequest } from 'hono';
import { Console } from '@Infrastructure/Utils/Console';
import { LoggingConfig } from '@Infrastructure/Config/LoggingConfig';

import { applyGlobalMiddleware } from '@Presentation/Http/APIs/Middleware/Global/global';
import { applyRoutes } from '@Presentation/Http/APIs/Middleware/Global/routes';
import { registerControllers, RegisterOptions } from "hono-injector";
import { HealthController } from '@Presentation/Http/APIs/Controllers/HealthController';
import { InitController } from '@Presentation/Http/APIs/Controllers/InitController';
import { AuthController } from '@Presentation/Http/APIs/Controllers/auth/AuthController';
import { AccountController } from '@Presentation/Http/APIs/Controllers/auth/AccountController';
import { FileController } from '@Presentation/Http/APIs/Controllers/FileController';
import { FileUploadController } from '@Presentation/Http/APIs/Controllers/FileUploadController';
import { MediaController } from '@Presentation/Http/APIs/Controllers/media/MediaController';
import { PaymentController } from '@Presentation/Http/APIs/Controllers/payment/PaymentController';
import { StripeWebhookController } from '@Presentation/Http/APIs/Controllers/payment/StripeWebhookController';
import { API_PATH } from '@Core/Types/Constants';

class App {
    private container: Container;
    private app: Hono;

    constructor() {
        this.container = DIContainer.getInstance();
        this.app = new Hono();
    }

    public async initialize(): Promise<Hono> {
        try {
            // Initialize logging first
            // LoggingConfig.getInstance().initialize(this.hono);
            Console.info('✅ Logging initialized successfully');

            // Initialize database
            await DatabaseService.initialize(this.container);
            Console.info('✅ Database initialized successfully');

            // Setup honoServer and middleware
            applyGlobalMiddleware(this.app);

            const options: RegisterOptions = { prefix: `${API_PATH}`, debug: true };

            // Register Routes
            registerControllers(this.app, this.container, [
                HealthController,
                InitController,
                AuthController,
                AccountController,
                FileController,
                FileUploadController,
                MediaController,
                PaymentController,
                StripeWebhookController
            ], options);


            this.initErrorHandling();

            return this.app;
        } catch (error: any) {
            const errorMessage = error.message || 'Unknown error';
            Console.error(error, { message: errorMessage });
            throw error;
        }
    }

    private initErrorHandling() {
        // 404 handler - must be added after all routes are defined
        this.app.notFound((c) => {
            return c.json({ success: false, message: "Route not found", path: c.req.path }, 404);
        });

        // Global error handler
        this.app.onError((err, c) => {
            console.error(err);
            return c.json({ success: false, message: err.message || "Internal Server Error" }, 500);
        });
    }

    private setupGracefulShutdown() {
        const shutdown = async () => {
            console.log('Shutting down gracefully...');
            await DatabaseService.shutdown(this.container);
            process.exit(0);
        };

        process.on('SIGTERM', shutdown);
        process.on('SIGINT', shutdown);
    }
}

export default new App();