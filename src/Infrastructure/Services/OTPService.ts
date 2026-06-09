import { inject, injectable } from "inversify";
import type { IOTPService } from "@Core/Application/Interface/Services/IOTPService";
import { TYPES } from "@Core/Types/Constants";
import type { IVerification } from "@Core/Application/Interface/Entities/auth-and-user/IVerification";
import CryptoService from "@Core/Services/CryptoService";
import { UtilityService } from "@Core/Services/UtilityService";
import { VerificationRepository } from "../Repository/SQL/auth/VerificationRepository";
import { TransactionManager } from "peculiar-orm";
import { AppError, AuthenticationError } from "@Core/Application/Error/AppError";
import { VerificationStatus } from "@Core/Application/Interface/Entities/auth-and-user/IUser";
import { ResponseMessage } from "@Core/Application/Response/ResponseFormat";
import { BaseService } from "./base/BaseService";

type OtpValidationResult = {
    valid: true;
} | {
    valid: false;
    error: AuthenticationError;
};

@injectable()
export class OTPService extends BaseService implements IOTPService {
    constructor(
        @inject(TYPES.VerificationRepository) private readonly verificationRepository: VerificationRepository,
        @inject(TYPES.TransactionManager) protected readonly transactionManager: TransactionManager,
    ) {
        super(transactionManager);
    }


    public async createOtpInstance(otp: string, salt: string): Promise<IVerification> {
        try {
            return await this.withTransaction(async () => {
                return await this.verificationRepository.create({
                    user_id: undefined,
                    otp: {
                        code: CryptoService.hashString(otp, salt),
                        expiry: UtilityService.dateToUnix(new Date(Date.now() + 10 * 60 * 1000)),
                        attempts: 0,
                        last_attempt: UtilityService.dateToUnix(new Date()) || null,
                        verified: false
                    },
                    reference: UtilityService.generateUUID()
                }) as IVerification;
            });
        } catch (error) {
            if (error instanceof AppError) {
                throw error;
            }
            throw new AppError("Failed to create OTP instance");
        }
    }

    public async updateOtpInstance(verificationId: string, otp: string, salt: string): Promise<IVerification> {
        try {
            return await this.withTransaction(async () => {
                const updated = await this.verificationRepository.updateOtpInstance(verificationId, {
                    code: CryptoService.hashString(otp, salt),
                    expiry: UtilityService.dateToUnix(new Date(Date.now() + 10 * 60 * 1000)),
                    attempts: 0,
                    last_attempt: UtilityService.dateToUnix(new Date()) || null,
                    verified: false
                });

                if (!updated) {
                    throw new AuthenticationError("Verification not found");
                }

                return updated;
            });
        } catch (error) {
            if (error instanceof AppError) {
                throw error;
            }
            throw new AppError("Failed to update OTP instance");
        }
    }

    public async validOTP(code: string, token: string, salt: string): Promise<boolean> {
        try {
            const result = await this.withTransaction(async (): Promise<OtpValidationResult> => {
                const verification = await this.verificationRepository.findByToken(token);

                if (!verification) {
                    throw new AuthenticationError("Verification not found");
                }

                const otpState = verification.otp;
                const storedOTPCode = otpState?.code;
                const expiryTime = otpState?.expiry;
                const currentTime = UtilityService.dateToUnix(new Date());

                if (!expiryTime || currentTime > expiryTime) {
                    await this.verificationRepository.updateVerification(verification._id as string, {
                        status: VerificationStatus.EXPIRED
                    });
                    return {
                        valid: false,
                        error: new AuthenticationError(ResponseMessage.FAILED_PHONE_VERIFICATION_MESSAGE)
                    };
                }

                if (!storedOTPCode || !CryptoService.verifyHash(code, storedOTPCode, salt)) {
                    const attempts = (otpState?.attempts || 0) + 1;
                    if (otpState) {
                        await this.verificationRepository.updateVerification(verification._id as string, {
                            otp: {
                                ...otpState,
                                attempts,
                                last_attempt: currentTime
                            }
                        });
                    }
                    return {
                        valid: false,
                        error: new AuthenticationError("Invalid verification or expired OTP")
                    };
                }

                if (!otpState) {
                    return {
                        valid: false,
                        error: new AuthenticationError("Invalid verification or expired OTP")
                    };
                }

                await this.verificationRepository.updateVerification(verification._id as string, {
                    status: VerificationStatus.VERIFIED,
                    otp: {
                        ...otpState,
                        verified: true
                    }
                });

                return { valid: true };
            });

            if (!result.valid) {
                throw result.error;
            }

            return true;
        } catch (error) {
            if (error instanceof AppError) {
                throw error;
            }
            throw new AuthenticationError("Failed to validate OTP");
        }
    }
}
