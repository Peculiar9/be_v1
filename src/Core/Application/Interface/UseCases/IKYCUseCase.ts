import type { IUserKYC } from "../Entities/auth-and-user/IVerification";
import { KYCStage, KYCStatus } from "../Entities/auth-and-user/IVerification";

export interface IKYCUseCase {
  checkOrInitializeKYC(userId: string): Promise<IUserKYC>;
  updateStage(userId: string, stage: KYCStage, status: KYCStatus, metadata?: Record<string, unknown>): Promise<IUserKYC>;
  markFailed(userId: string, reason: string): Promise<IUserKYC>;
}
