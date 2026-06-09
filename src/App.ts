import 'reflect-metadata';
import { Container } from 'inversify';
import { DatabaseService } from '@Infrastructure/Database/DatabaseService';

import { DIContainer } from '@Core/DI/DIContainer';
import { Hono } from 'hono';
import { Console } from '@Infrastructure/Utils/Console';

import { applyGlobalMiddleware } from '@Presentation/Http/APIs/Middleware/Global/global';
import { registerControllers, RegisterOptions } from "hono-injector";
import { HealthController } from '@Presentation/Http/APIs/Controllers/HealthController';
import { InitController } from '@Presentation/Http/APIs/Controllers/InitController';
import { AuthController } from '@Presentation/Http/APIs/Controllers/auth/AuthController';
import { AccountController } from '@Presentation/Http/APIs/Controllers/auth/AccountController';
import { FileController } from '@Presentation/Http/APIs/Controllers/FileController';
import { FileUploadController } from '@Presentation/Http/APIs/Controllers/FileUploadController';
import { MediaController } from '@Presentation/Http/APIs/Controllers/media/MediaController';
import { API_PATH } from '@Core/Types/Constants';
import { NotFoundMiddleware } from '@Presentation/Http/APIs/Middleware/NotFoundMiddleware';
import { ErrorHandlerMiddleware } from '@Presentation/Http/APIs/Middleware/ErrorHandlerMiddleware';

class App {
    private container: Container;
    private app: Hono;

    constructor() {
        this.container = DIContainer.getInstance();
        this.app = new Hono();
    }

    public async initialize(): Promise<Hono> {
        try {
            Console.info('Logging initialized successfully');

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
                MediaController
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
            return NotFoundMiddleware.handleNotFound(c);
        });

        // Global error handler
        this.app.onError((err, c) => {
            return ErrorHandlerMiddleware.handleError(err, c);
        });
    }

    private setupGracefulShutdown() {
        const shutdown = async () => {
            Console.info('Shutting down gracefully...');
            await DatabaseService.shutdown(this.container);
            process.exit(0);
        };

        process.on('SIGTERM', shutdown);
        process.on('SIGINT', shutdown);
    }
}

export default new App();
