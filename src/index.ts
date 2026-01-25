import "reflect-metadata";
import { EnvironmentConfig } from "@Infrastructure/Config/EnvironmentConfig";

console.log("Starting application...");
// Initialize environment before anything else
EnvironmentConfig.initialize();

import App from "./App";

const startServer = async () => {
    try {
        console.log("Initializing App...");
        const app = await App.initialize();
        const port = EnvironmentConfig.getNumber("PORT", 3000);

        console.log(`Starting server in ${process.env.NODE_ENV} environment`);
        console.log(`Server will run on port ${port}`);

        return {
            port,
            fetch: app.fetch,
        };

    } catch (error) {
        console.error("CRITICAL: Failed to start server:", error);
        process.exit(1);
    }
};

const server = await startServer();
console.log(`Server successfully started on port ${server.port}`);

export default server;
