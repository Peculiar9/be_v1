import { injectable } from 'inversify';
import { AxiosHttpClient } from './AxiosHttpClient';
import type { IHttpClient } from '@Core/Application/Interface/Infrastructure/IHttpClient';

export interface ApiConfig {
    baseURL: string;
    headers?: Record<string, string>;
    timeout?: number;
    retryAttempts?: number;
}

@injectable()
export class HttpClientFactory {
    createClient(config?: ApiConfig): IHttpClient {
        return new AxiosHttpClient(config?.baseURL, {
            headers: config?.headers,
            timeout: config?.timeout,
        });
    }

    createAuthenticatedClient(config: ApiConfig, token: string): IHttpClient {
        const headers = {
            Authorization: `Bearer ${token}`,
            ...config.headers,
        };

        return new AxiosHttpClient(config.baseURL, {
            headers,
            timeout: config.timeout,
        });
    }

    createServiceClient(serviceName: string): IHttpClient {
        // Load service-specific configuration
        const config = this.getServiceConfig(serviceName);
        return this.createClient(config);
    }

    private getServiceConfig(serviceName: string): ApiConfig {
        // This could be loaded from environment variables or a configuration file
        const configs: Record<string, ApiConfig> = {
            'notification-service': {
                baseURL: process.env.NOTIFICATION_SERVICE_URL!,
                timeout: 3000
            }
            // Add more service configurations as needed
        };

        return configs[serviceName] || { baseURL: process.env.API_BASE_URL! };
    }
}
