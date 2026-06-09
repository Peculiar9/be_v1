import { inject, injectable } from "inversify";
import { TYPES } from "@Core/Types/Constants";
import type { IKYCUseCase } from "../Interface/UseCases/IKYCUseCase";
import { KYCStage, KYCStatus } from "../Interface/Entities/auth-and-user/IVerification";
import type { IUserKYC } from "../Interface/Entities/auth-and-user/IVerification";
import { UserKYCRepository } from "@Infrastructure/Repository/SQL/auth/UserKYCRepository";
import { UserRepository } from "@Infrastructure/Repository/SQL/users/UserRepository";
import { RegistrationError } from "../Error/AppError";

@injectable()
export class KYCUseCase implements IKYCUseCase {
    constructor(
        @inject(TYPES.UserKYCRepository) private readonly userKYCRepository: UserKYCRepository,
        @inject(TYPES.UserRepository) private readonly userRepository: UserRepository
    ) {}

    async checkOrInitializeKYC(userId: string): Promise<IUserKYC> {
        const userKYC = await this.userKYCRepository.findByUserId(userId);
        if (userKYC) {
            return userKYC;
        }

        const user = await this.userRepository.findById(userId);
        if (!user) {
            throw new RegistrationError("User not found");
        }

        return await this.userKYCRepository.create({
            user_id: userId,
            status: KYCStatus.PENDING,
            current_stage: KYCStage.IDENTITY,
            stage_metadata: {},
        });
    }

    async updateStage(userId: string, stage: KYCStage, status: KYCStatus, metadata?: Record<string, unknown>): Promise<IUserKYC> {
        const userKYC = await this.userKYCRepository.updateStage(userId, stage, status, metadata);
        if (!userKYC) {
            throw new RegistrationError("KYC record not found");
        }
        return userKYC;
    }

    async markFailed(userId: string, reason: string): Promise<IUserKYC> {
        const userKYC = await this.userKYCRepository.setFailure(userId, reason);
        if (!userKYC) {
            throw new RegistrationError("KYC record not found");
        }
        return userKYC;
    }
}
