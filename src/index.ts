import "reflect-metadata";
import { EnvironmentConfig } from "@Infrastructure/Config/EnvironmentConfig";
import { Console } from "@Infrastructure/Utils/Console";

Console.info("Starting application...");
// Initialize environment before anything else
EnvironmentConfig.initialize();

import App from "./App";

const startServer = async () => {
    try {
        Console.info("Initializing App...");
        const app = await App.initialize();
        const port = EnvironmentConfig.getNumber("PORT", 3000);

        Console.info(`Starting server in ${process.env.NODE_ENV} environment`);
        Console.info(`Server will run on port ${port}`);

        return {
            port,
            fetch: app.fetch,
        };

    } catch (error) {
        Console.error(error instanceof Error ? error : new Error(String(error)), {
            message: "Critical failure while starting server",
        });
        process.exit(1);
    }
};

const server = await startServer();
Console.info(`Server successfully started on port ${server.port}`);

export default server;
