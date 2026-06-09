import { inject, injectable } from 'inversify';
import { TYPES } from '@Core/Types/Constants';
import { HttpClientFactory } from '../Http/HttpClientFactory';
import { UserResponseDTO } from '@Core/Application/DTOs/UserDTO';
import type { IUser } from '@Core/Application/Interface/Entities/auth-and-user/IUser';
import { UserRepository } from '../Repository/SQL/users/UserRepository';
import { UserRole } from '@Core/Application/Enums/UserRole';
import { DatabaseIsolationLevel, TransactionManager } from 'peculiar-orm';
import { BaseService } from './base/BaseService';

@injectable()
export class UserService extends BaseService {
    constructor(
        @inject(TYPES.HttpClientFactory) private readonly httpClientFactory: HttpClientFactory,
        @inject(TYPES.UserRepository) private userRepository: UserRepository,
        @inject(TYPES.TransactionManager) protected readonly transactionManager: TransactionManager
    ) {
        super(transactionManager);
    }

    async getAllUsers(): Promise<UserResponseDTO[]> {
        const users = await this.withTransaction(
            () => this.userRepository.findAll(),
            DatabaseIsolationLevel.READ_COMMITTED,
            true
        );
        return users.map((user: IUser) => this.constructUserObject(user));
    }

    // Method for making authenticated API calls to external services
    async makeExternalApiCall(token: string) {
        const authenticatedClient = this.httpClientFactory.createAuthenticatedClient(
            { baseURL: process.env.API_BASE_URL! },
            token
        );
        return await authenticatedClient.get('/some-external-endpoint');
    }

    private constructUserObject(user: IUser): UserResponseDTO {
        return {
            id: user._id as string,
            first_name: user.first_name as string,
            last_name: user.last_name as string,
            email: user.email as string,
            phone: user.phone as string,
            profile_image: user.profile_image as string,
            roles: user.roles as UserRole[],
            status: user.status as string,
            is_active: user.is_active,
            created_at: user.created_at as string,
            updated_at: user.updated_at as string,
        };
    }
}

