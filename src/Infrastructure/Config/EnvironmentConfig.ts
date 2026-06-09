import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

export class EnvironmentConfig {
    private static initialized = false;

    private static envFiles = {
        test: ['.env', '.env.staging', '.env.production'],
        staging: ['.env.staging', '.env.production'],
        production: ['.env.production']
    };

    static initialize(): void {
        // Prevent multiple initializations
        if (this.initialized) {
            return;
        }
        this.initialized = true;

        // Load env files first
        const nodeEnv = process.env.NODE_ENV || 'test';
        if (nodeEnv === 'production') {
            this.loadEnvFile('.env.production');
        } else {
            // For test/staging, try multiple env files in order
            const envFilesToTry = this.envFiles[nodeEnv as keyof typeof this.envFiles] || ['.env'];

            let loaded = false;
            for (const envFile of envFilesToTry) {
                if (this.loadEnvFile(envFile)) {
                    loaded = true;
                    break;
                }
            }

            if (!loaded) {
                return;
            }
        }
    }

    private static loadEnvFile(filename: string): boolean {
        const envPath = path.resolve(process.cwd(), filename);

        try {
            if (fs.existsSync(envPath)) {
                const result = dotenv.config({ path: envPath });

                if (result.error) {
                    return false;
                }

                // Validate required environment variables
                this.validateRequiredVariables();
                return true;
            }
        } catch {
            return false;
        }

        return false;
    }

    private static validateRequiredVariables(): void {}

    static get(key: string, defaultValue?: string): string {
        const value = process.env[key];

        return value || defaultValue || '';
    }

    static getNumber(key: string, defaultValue: number): number {
        const value = process.env[key];
        if (value === undefined) {
            return defaultValue;
        }

        const numValue = parseInt(value, 10);
        if (isNaN(numValue)) {
            return defaultValue;
        }

        return numValue;
    }

    static getBoolean(key: string, defaultValue: boolean): boolean {
        const value = process.env[key]?.toLowerCase();

        if (value === undefined) {
            return defaultValue;
        }

        if (value !== 'true' && value !== 'false') {
            return defaultValue;
        }

        return value === 'true';
    }

    static isDevelopment(): boolean {
        return this.get('NODE_ENV', 'development') === 'development';
    }

    static isProduction(): boolean {
        return this.get('NODE_ENV') === 'production';
    }

    static isTest(): boolean {
        return this.get('NODE_ENV') === 'test';
    }

    static isStaging(): boolean {
        return this.get('NODE_ENV') === 'staging';
    }
} 
